import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet,
  exposesCanBeSet,
  ExposesEntry,
  ExposesEntryWithEnumProperty,
  ExposesEntryWithFeatures,
  ExposesEntryWithNumericRangeProperty,
  exposesHasEnumProperty,
  exposesHasFeatures,
  exposesHasNumericRangeProperty,
  exposesIsPublished,
  ExposesKnownTypes,
} from '../z2mModels';
import { hap } from '../hap';
import { getOrAddCharacteristic } from '../helpers';
import { Characteristic, CharacteristicSetCallback, CharacteristicValue, Service } from 'homebridge';
import { ExtendedTimer } from '../timer';
import { CharacteristicMonitor, NumericCharacteristicMonitor } from './monitor';

export class CoverCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes
      .filter(
        (e) =>
          e.type === ExposesKnownTypes.COVER &&
          exposesHasFeatures(e) &&
          !accessory.isServiceHandlerIdKnown(CoverHandler.generateIdentifier(e.endpoint))
      )
      .forEach((e) => {
        const motorStateExpose = exposes.find(
          (m) =>
            m.endpoint === e.endpoint &&
            m.name === 'motor_state' &&
            exposesHasEnumProperty(m) &&
            exposesIsPublished(m) &&
            m.values.includes(CoverHandler.MOTOR_STATE_OPENING) &&
            m.values.includes(CoverHandler.MOTOR_STATE_CLOSING) &&
            m.values.includes(CoverHandler.MOTOR_STATE_STOPPED)
        );
        this.createService(e as ExposesEntryWithFeatures, accessory, motorStateExpose as ExposesEntryWithEnumProperty);
      });
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory, motorStateExpose: ExposesEntryWithEnumProperty): void {
    try {
      const handler = new CoverHandler(expose, accessory, motorStateExpose);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup cover for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`);
    }
  }
}

class CoverHandler implements ServiceHandler {
  private static readonly STATE_HOLD_POSITION = 'STOP';
  public static readonly MOTOR_STATE_OPENING = 'opening';
  public static readonly MOTOR_STATE_CLOSING = 'closing';
  public static readonly MOTOR_STATE_STOPPED = 'stopped';
  private readonly positionExpose: ExposesEntryWithNumericRangeProperty;
  private readonly tiltExpose: ExposesEntryWithNumericRangeProperty | undefined;
  private readonly stateExpose: ExposesEntryWithEnumProperty | undefined;
  private readonly service: Service;
  private readonly updateTimer: ExtendedTimer | undefined;
  private readonly target_min: number;
  private readonly target_max: number;
  private readonly current_min: number;
  private readonly current_max: number;
  private readonly target_tilt_min: number;
  private readonly target_tilt_max: number;
  private monitors: CharacteristicMonitor[] = [];
  private waitingForUpdate: boolean;
  private ignoreNextUpdateIfEqualToTarget: boolean;
  private lastPositionSet = -1;
  private positionCurrent = -1;
  private motorState: string | undefined;
  private motorStatePrevious: string | undefined;
  private setTargetPositionHandled: boolean;

  public readonly mainCharacteristics: Characteristic[] = [];

  constructor(
    expose: ExposesEntryWithFeatures,
    private readonly accessory: BasicAccessory,
    private readonly motorStateExpose: ExposesEntryWithEnumProperty | undefined
  ) {
    const endpoint = expose.endpoint;
    this.identifier = CoverHandler.generateIdentifier(endpoint);

    let positionExpose = expose.features.find(
      (e) => exposesHasNumericRangeProperty(e) && e.name === 'position' && exposesCanBeSet(e) && exposesIsPublished(e)
    ) as ExposesEntryWithNumericRangeProperty;
    this.tiltExpose = expose.features.find(
      (e) => exposesHasNumericRangeProperty(e) && e.name === 'tilt' && exposesCanBeSet(e) && exposesIsPublished(e)
    ) as ExposesEntryWithNumericRangeProperty | undefined;
    this.stateExpose = expose.features.find(
      (e) =>
        e.type === ExposesKnownTypes.ENUM &&
        e.name === 'state' &&
        exposesCanBeSet(e) &&
        exposesHasEnumProperty(e) &&
        e.values.includes(CoverHandler.STATE_HOLD_POSITION)
    ) as ExposesEntryWithEnumProperty;

    if (positionExpose === undefined) {
      if (this.tiltExpose !== undefined) {
        // Tilt only device
        positionExpose = this.tiltExpose;
        this.tiltExpose = undefined;
      } else {
        throw new Error('Required "position" property not found for WindowCovering and no "tilt" as backup.');
      }
    }
    this.positionExpose = positionExpose;

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);

    accessory.log.debug(`Configuring WindowCovering for ${serviceName}`);
    this.service = accessory.getOrAddService(new hap.Service.WindowCovering(serviceName, endpoint));

    const current = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentPosition);
    this.mainCharacteristics.push(current);
    if (current.props.minValue === undefined || current.props.maxValue === undefined) {
      throw new Error('CurrentPosition for Cover does not hav a rang (minValue, maxValue) defined.');
    }
    this.current_min = current.props.minValue;
    this.current_max = current.props.maxValue;

    this.mainCharacteristics.push(getOrAddCharacteristic(this.service, hap.Characteristic.PositionState));

    const target = getOrAddCharacteristic(this.service, hap.Characteristic.TargetPosition);
    if (target.props.minValue === undefined || target.props.maxValue === undefined) {
      throw new Error('TargetPosition for Cover does not have a rang (minValue, maxValue) defined.');
    }
    this.target_min = target.props.minValue;
    this.target_max = target.props.maxValue;
    target.on('set', this.handleSetTargetPosition.bind(this));

    if (this.target_min !== this.current_min || this.target_max !== this.current_max) {
      this.accessory.log.error(accessory.displayName + ': cover: TargetPosition and CurrentPosition do not have the same range!');
    }

    // Tilt
    if (this.tiltExpose !== undefined) {
      getOrAddCharacteristic(this.service, hap.Characteristic.CurrentHorizontalTiltAngle);
      this.monitors.push(
        new NumericCharacteristicMonitor(
          this.tiltExpose.property,
          this.service,
          hap.Characteristic.CurrentHorizontalTiltAngle,
          this.tiltExpose.value_min,
          this.tiltExpose.value_max
        )
      );

      const target_tilt = getOrAddCharacteristic(this.service, hap.Characteristic.TargetHorizontalTiltAngle);
      if (target_tilt.props.minValue === undefined || target_tilt.props.maxValue === undefined) {
        throw new Error('TargetHorizontalTiltAngle for Cover does not have a rang (minValue, maxValue) defined.');
      }
      this.target_tilt_min = target_tilt.props.minValue;
      this.target_tilt_max = target_tilt.props.maxValue;
      target_tilt.on('set', this.handleSetTargetHorizontalTilt.bind(this));
    } else {
      this.target_tilt_min = -90;
      this.target_tilt_max = 90;
    }

    // Hold Position
    if (this.stateExpose !== undefined) {
      getOrAddCharacteristic(this.service, hap.Characteristic.HoldPosition).on('set', this.handleSetHoldPosition.bind(this));
    }

    if (exposesCanBeGet(this.positionExpose) && this.motorStateExpose === undefined) {
      this.updateTimer = new ExtendedTimer(this.requestPositionUpdate.bind(this), 4000);
    }
    this.waitingForUpdate = false;
    this.ignoreNextUpdateIfEqualToTarget = false;
    this.setTargetPositionHandled = false;
    this.motorState = undefined;
    this.motorStatePrevious = undefined;
  }

  identifier: string;
  get getableKeys(): string[] {
    const keys: string[] = [];
    if (exposesCanBeGet(this.positionExpose)) {
      keys.push(this.positionExpose.property);
    }
    if (this.tiltExpose !== undefined && exposesCanBeGet(this.tiltExpose)) {
      keys.push(this.tiltExpose.property);
    }
    if (this.motorStateExpose !== undefined && exposesCanBeGet(this.motorStateExpose)) {
      keys.push(this.motorStateExpose.property);
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach((m) => m.callback(state));

    if (this.motorStateExpose !== undefined && this.motorStateExpose.property in state) {
      const latestMotorState = state[this.motorStateExpose.property] as string;
      switch (latestMotorState) {
        case CoverHandler.MOTOR_STATE_OPENING:
        case CoverHandler.MOTOR_STATE_CLOSING:
          this.motorState = latestMotorState;
          break;
        default:
          this.motorState = CoverHandler.MOTOR_STATE_STOPPED;
          break;
      }
    }

    if (this.positionExpose.property in state) {
      const latestPosition = state[this.positionExpose.property] as number;

      // Ignore "first" update?
      const doIgnoreIfEqual = this.ignoreNextUpdateIfEqualToTarget;
      this.ignoreNextUpdateIfEqualToTarget = false;
      if (latestPosition === this.lastPositionSet && doIgnoreIfEqual) {
        this.accessory.log.debug(`${this.accessory.displayName}: cover: ignore position update (equal to last target)`);
        return;
      }

      // Received an update: Reset flag
      this.waitingForUpdate = false;

      // If we cannot retrieve the position or we were not expecting an update,
      // always assume the state is "stopped".
      let didStop = true;

      // As long as the update timer is running, we are expecting updates.
      if (this.updateTimer !== undefined && this.updateTimer.isActive) {
        if (latestPosition === this.positionCurrent) {
          // Stop requesting frequent updates if no change is detected.
          this.updateTimer.stop();
        } else {
          // Assume cover is still moving as the position is still changing
          didStop = false;
          this.startOrRestartUpdateTimer();
        }
      }

      // Update current position
      this.positionCurrent = latestPosition;
      this.scaleAndUpdateCurrentPosition(this.positionCurrent, didStop);
    }
  }

  private startOrRestartUpdateTimer(): void {
    if (this.updateTimer === undefined) {
      return;
    }

    this.waitingForUpdate = true;
    if (this.updateTimer.isActive) {
      this.updateTimer.restart();
    } else {
      this.updateTimer.start();
    }
  }

  private requestPositionUpdate() {
    if (!exposesCanBeGet(this.positionExpose)) {
      return;
    }
    if (this.waitingForUpdate) {
      // Manually polling for the state, as we have not yet received an update.
      this.accessory.queueKeyForGetAction(this.positionExpose.property);
    }
  }

  private scaleNumber(value: number, input_min: number, input_max: number, output_min: number, output_max: number): number {
    if (value <= input_min) {
      return output_min;
    }
    if (value >= input_max) {
      return output_max;
    }
    const percentage = (value - input_min) / (input_max - input_min);
    return output_min + percentage * (output_max - output_min);
  }

  private scaleAndUpdateCurrentPosition(value: number, isStopped: boolean): void {
    const characteristicValue = this.scaleNumber(
      value,
      this.positionExpose.value_min,
      this.positionExpose.value_max,
      this.current_min,
      this.current_max
    );
    if (this.motorStateExpose === undefined) {
      this.service.updateCharacteristic(hap.Characteristic.CurrentPosition, characteristicValue);
      if (isStopped) {
        // Update target position and position state
        // This should improve the UX in the Home.app
        this.accessory.log.debug(`${this.accessory.displayName}: cover: assume movement stopped`);
        this.service.updateCharacteristic(hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED);
        this.service.updateCharacteristic(hap.Characteristic.TargetPosition, characteristicValue);
      }
    } else {
      if (this.motorState !== this.motorStatePrevious) {
        let newPositionState: number;
        let newTargetPosition: number;
        switch (this.motorState) {
          case CoverHandler.MOTOR_STATE_CLOSING:
            newPositionState = hap.Characteristic.PositionState.DECREASING;
            newTargetPosition = 0;
            this.accessory.log.debug(`${this.accessory.displayName}: cover: closing via motor_state`);
            break;
          case CoverHandler.MOTOR_STATE_OPENING:
            newPositionState = hap.Characteristic.PositionState.INCREASING;
            newTargetPosition = 100;
            this.accessory.log.debug(`${this.accessory.displayName}: cover: opening via motor_state`);
            break;
          default:
            newPositionState = hap.Characteristic.PositionState.STOPPED;
            newTargetPosition = characteristicValue;
            this.accessory.log.debug(`${this.accessory.displayName}: cover: stopped via motor_state`);
            break;
        }
        this.service.updateCharacteristic(hap.Characteristic.PositionState, newPositionState);
        if (newPositionState === hap.Characteristic.PositionState.STOPPED) {
          this.service.updateCharacteristic(hap.Characteristic.CurrentPosition, characteristicValue);
        }
        if (newPositionState === hap.Characteristic.PositionState.STOPPED || !this.setTargetPositionHandled) {
          this.service.updateCharacteristic(hap.Characteristic.TargetPosition, newTargetPosition);
        }
        this.motorStatePrevious = this.motorState;
        this.setTargetPositionHandled = false;
      }
    }
  }

  private handleSetTargetPosition(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const target = this.scaleNumber(
      value as number,
      this.target_min,
      this.target_max,
      this.positionExpose.value_min,
      this.positionExpose.value_max
    );

    const data = {};
    data[this.positionExpose.property] = target;
    this.accessory.queueDataForSetAction(data);

    if (this.motorStateExpose === undefined) {
      // Assume position state based on new target
      if (target > this.positionCurrent) {
        this.service.updateCharacteristic(hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING);
      } else if (target < this.positionCurrent) {
        this.service.updateCharacteristic(hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING);
      } else {
        this.service.updateCharacteristic(hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED);
      }
    } else {
      this.service.updateCharacteristic(hap.Characteristic.TargetPosition, target);
      this.setTargetPositionHandled = true;
    }
    // Store last sent position for future reference
    this.lastPositionSet = target;

    // Ignore next status update if it is equal to the target position set here
    // and the position can be get.
    // This was needed for my Swedish blinds when reporting was enabled.
    // (First update would contain the target position that was sent, followed by the actual position.)
    if (exposesCanBeGet(this.positionExpose)) {
      this.ignoreNextUpdateIfEqualToTarget = true;
    }

    // Start requesting frequent updates (if we do not receive them automatically)
    this.startOrRestartUpdateTimer();

    callback(null);
  }

  private handleSetTargetHorizontalTilt(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.tiltExpose) {
      // map value: angle back to target: percentage
      // must be rounded for set action
      const targetTilt = Math.round(
        this.scaleNumber(value as number, this.target_tilt_min, this.target_tilt_max, this.tiltExpose.value_min, this.tiltExpose.value_max)
      );

      const data = {};
      data[this.tiltExpose.property] = targetTilt;
      this.accessory.queueDataForSetAction(data);
      callback(null);
    } else {
      callback(new Error('tilt not supported'));
    }
  }

  private handleSetHoldPosition(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const doHold = value as boolean;
    if (doHold && this.stateExpose) {
      const data = {};
      data[this.stateExpose.property] = CoverHandler.STATE_HOLD_POSITION;
      this.accessory.queueDataForSetAction(data);
    }
    callback(null);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.WindowCovering.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
