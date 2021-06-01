import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet, exposesCanBeSet, ExposesEntry, ExposesEntryWithFeatures, ExposesEntryWithNumericRangeProperty, exposesHasFeatures,
  exposesHasNumericRangeProperty, exposesIsPublished, ExposesKnownTypes,
} from '../z2mModels';
import { hap } from '../hap';
import { getOrAddCharacteristic } from '../helpers';
import { CharacteristicSetCallback, CharacteristicValue, Service } from 'homebridge';
import { ExtendedTimer } from '../timer';
import { CharacteristicMonitor, NumericCharacteristicMonitor } from './monitor';

export class CoverCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes.filter(e => e.type === ExposesKnownTypes.COVER && exposesHasFeatures(e)
      && !accessory.isServiceHandlerIdKnown(CoverHandler.generateIdentifier(e.endpoint)))
      .forEach(e => this.createService(e as ExposesEntryWithFeatures, accessory));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory): void {
    try {
      const handler = new CoverHandler(expose, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup cover for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`);
    }
  }
}

class CoverHandler implements ServiceHandler {
  private readonly positionExpose: ExposesEntryWithNumericRangeProperty;
  private readonly tiltExpose: ExposesEntryWithNumericRangeProperty | undefined;
  private readonly service: Service;
  private positionCurrent = -1;
  private readonly updateTimer: ExtendedTimer;
  private waitingForUpdate: boolean;
  private readonly target_min: number;
  private readonly target_max: number;
  private readonly current_min: number;
  private readonly current_max: number;
  private readonly target_tilt_min: number;
  private readonly target_tilt_max: number;
  private monitors: CharacteristicMonitor[] = [];

  constructor(expose: ExposesEntryWithFeatures, private readonly accessory: BasicAccessory) {
    const endpoint = expose.endpoint;
    this.identifier = CoverHandler.generateIdentifier(endpoint);

    const positionExpose = expose.features.find(e => exposesHasNumericRangeProperty(e) && !accessory.isPropertyExcluded(e.property)
      && e.name === 'position' && exposesCanBeSet(e) && exposesIsPublished(e)) as ExposesEntryWithNumericRangeProperty;
    if (positionExpose === undefined) {
      throw new Error('Required "position" property not found for WindowCovering.');
    }
    this.positionExpose = positionExpose;

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);

    accessory.log.debug(`Configuring WindowCovering for ${serviceName}`);
    this.service = accessory.getOrAddService(new hap.Service.WindowCovering(serviceName, endpoint));

    const current = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentPosition);
    if (current.props.minValue === undefined || current.props.maxValue === undefined) {
      throw new Error('CurrentPosition for Cover does not hav a rang (minValue, maxValue) defined.');
    }
    this.current_min = current.props.minValue;
    this.current_max = current.props.maxValue;

    getOrAddCharacteristic(this.service, hap.Characteristic.PositionState);

    const target = getOrAddCharacteristic(this.service, hap.Characteristic.TargetPosition);
    if (target.props.minValue === undefined || target.props.maxValue === undefined) {
      throw new Error('TargetPosition for Cover does not have a rang (minValue, maxValue) defined.');
    }
    this.target_min = target.props.minValue;
    this.target_max = target.props.maxValue;
    target.on('set', this.handleSetTargetPosition.bind(this));

    // Tilt
    this.tiltExpose = expose.features.find(e => exposesHasNumericRangeProperty(e) && !accessory.isPropertyExcluded(e.property)
      && e.name === 'tilt' && exposesCanBeSet(e) && exposesIsPublished(e)) as ExposesEntryWithNumericRangeProperty | undefined;
    if (this.tiltExpose !== undefined) {
      getOrAddCharacteristic(this.service, hap.Characteristic.CurrentHorizontalTiltAngle);
      this.monitors.push(new NumericCharacteristicMonitor(this.tiltExpose.property, this.service,
        hap.Characteristic.CurrentHorizontalTiltAngle, this.tiltExpose.value_min, this.tiltExpose.value_max));

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

    this.updateTimer = new ExtendedTimer(this.requestPositionUpdate.bind(this), 2000);
    this.waitingForUpdate = false;
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
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach(m => m.callback(state));

    if (this.positionExpose.property in state) {
      this.waitingForUpdate = false;

      const latestPosition = state[this.positionExpose.property] as number;
      let positionState = hap.Characteristic.PositionState.STOPPED;

      if (latestPosition === this.positionCurrent) {
        // Stop requesting frequent updates if no change is detected.
        this.updateTimer.stop();
      } else if (this.positionCurrent >= 0) {
        if (latestPosition > this.positionCurrent && latestPosition < this.positionExpose.value_max) {
          positionState = hap.Characteristic.PositionState.INCREASING;
        } else if (latestPosition < this.positionCurrent && latestPosition > this.positionExpose.value_min) {
          positionState = hap.Characteristic.PositionState.DECREASING;
        }
      }

      this.service.updateCharacteristic(hap.Characteristic.PositionState, positionState);
      this.positionCurrent = latestPosition;
      this.scaleAndUpdateCurrentPosition(this.positionCurrent);
    }
  }

  private requestPositionUpdate() {
    if (this.waitingForUpdate) {
      // No update received after previous request.
      // Assume movement has stopped
      this.service.updateCharacteristic(hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED);
      this.updateTimer.stop();
      this.waitingForUpdate = false;
    } else {
      // Manually polling for the state, because that was needed with my Swedish blinds.
      this.waitingForUpdate = true;
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
    return output_min + (percentage * (output_max - output_min));
  }

  private scaleAndUpdateCurrentPosition(value: number): void {
    const characteristicValue = this.scaleNumber(value,
      this.positionExpose.value_min, this.positionExpose.value_max,
      this.current_min, this.current_max);

    this.service.updateCharacteristic(hap.Characteristic.CurrentPosition, characteristicValue);
  }

  private handleSetTargetPosition(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const target = this.scaleNumber(value as number,
      this.target_min, this.target_max,
      this.positionExpose.value_min, this.positionExpose.value_max);

    const data = {};
    data[this.positionExpose.property] = target;
    this.accessory.queueDataForSetAction(data);

    // Assume position state based on new target
    if (target > this.positionCurrent) {
      this.service.updateCharacteristic(hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING);
    } else if (target < this.positionCurrent) {
      this.service.updateCharacteristic(hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING);
    } else {
      this.service.updateCharacteristic(hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED);
    }

    // Start requesting frequent updates.
    this.updateTimer.start();

    callback(null);
  }

  private handleSetTargetHorizontalTilt(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.tiltExpose) {
      // map value: angle back to target: percentage
      // must be rounded for set action
      const targetTilt = Math.round(this.scaleNumber(value as number,
        this.target_tilt_min, this.target_tilt_max,
        this.tiltExpose.value_min, this.tiltExpose.value_max));

      const data = {};
      data[this.tiltExpose.property] = targetTilt;
      this.accessory.queueDataForSetAction(data);
      callback(null);
    } else {
      callback(new Error('tilt not supported'));
    }
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.WindowCovering.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
