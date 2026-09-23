import { Characteristic, CharacteristicSetCallback, CharacteristicValue, Service, WithUUID } from 'homebridge';
import { hap } from '../hap';
import { getOrAddCharacteristic, setValidValuesOnCharacteristic } from '../helpers';
import {
  ExposesEntry,
  ExposesEntryWithBinaryProperty,
  ExposesEntryWithEnumProperty,
  ExposesEntryWithFeatures,
  ExposesEntryWithNumericRangeProperty,
  ExposesKnownTypes,
  exposesCanBeGet,
  exposesCanBeSet,
  exposesHasBinaryProperty,
  exposesHasEnumProperty,
  exposesHasFeatures,
  exposesHasNumericRangeProperty,
  exposesIsPublished,
} from '../z2mModels';
import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import { CharacteristicMonitor, MappingCharacteristicMonitor, NumericTransformCharacteristicMonitor } from './monitor';

export class AirPurifierCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes
      .filter(
        (e) =>
          e.type === ExposesKnownTypes.FAN &&
          exposesHasFeatures(e) &&
          AirPurifierHandler.hasRequiredFeatures(e) &&
          !accessory.isServiceHandlerIdKnown(AirPurifierHandler.generateIdentifier(e.endpoint))
      )
      .forEach((e) => this.createService(e as ExposesEntryWithFeatures, accessory, exposes));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    try {
      const fanSpeedExpose = exposes.find(
        (x) => x.endpoint === expose.endpoint && x.name === 'fan_speed' && exposesHasNumericRangeProperty(x)
      ) as ExposesEntryWithNumericRangeProperty | undefined;

      const handler = new AirPurifierHandler(expose, accessory, fanSpeedExpose);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(
        `Failed to setup air purifier for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`
      );
    }
  }
}

class AirPurifierHandler implements ServiceHandler {
  private static readonly NAME_STATE = 'state';
  private static readonly NAME_MODE = 'mode';
  private readonly stateExpose: ExposesEntryWithBinaryProperty;
  private readonly modeExpose: ExposesEntryWithEnumProperty | undefined;
  private readonly service: Service;
  private readonly monitors: CharacteristicMonitor[] = [];
  private readonly modeValues: string[];
  private readonly numericModes: string[];
  private readonly supportsAuto: boolean;
  private readonly supportsManual: boolean;
  private lastManualMode: string | undefined;

  public mainCharacteristics: Characteristic[];

  static hasRequiredFeatures(expose: ExposesEntry): boolean {
    if (!exposesHasFeatures(expose)) {
      return false;
    }
    return expose.features.some((f) => f.name === AirPurifierHandler.NAME_STATE && exposesHasBinaryProperty(f) && exposesIsPublished(f));
  }

  constructor(
    expose: ExposesEntryWithFeatures,
    private readonly accessory: BasicAccessory,
    fanSpeedExpose: ExposesEntryWithNumericRangeProperty | undefined
  ) {
    const endpoint = expose.endpoint;
    this.identifier = AirPurifierHandler.generateIdentifier(endpoint);

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);
    this.service = accessory.getOrAddService(new hap.Service.AirPurifier(serviceName, endpoint));
    accessory.log.debug(`Configuring AirPurifier for ${serviceName}`);

    const stateFeature = expose.features.find(
      (f) => f.name === AirPurifierHandler.NAME_STATE && exposesHasBinaryProperty(f) && exposesIsPublished(f)
    ) as ExposesEntryWithBinaryProperty | undefined;
    if (stateFeature === undefined) {
      throw new Error('Required "state" feature not found for Air Purifier.');
    }
    this.stateExpose = stateFeature;

    this.modeExpose = expose.features.find((f) => f.name === AirPurifierHandler.NAME_MODE && exposesHasEnumProperty(f)) as
      | ExposesEntryWithEnumProperty
      | undefined;
    this.modeValues = this.modeExpose?.values ?? [];
    this.numericModes = this.modeValues.filter((v) => /^\d+$/.test(v));
    this.supportsAuto = this.modeValues.includes('auto');
    this.supportsManual = this.modeValues.some((v) => v !== 'auto');
    this.lastManualMode = this.getDefaultManualMode();

    this.mainCharacteristics = [getOrAddCharacteristic(this.service, hap.Characteristic.Active).on('set', this.handleSetActive.bind(this))];

    const currentState = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentAirPurifierState);
    setValidValuesOnCharacteristic(currentState, [
      hap.Characteristic.CurrentAirPurifierState.INACTIVE,
      hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR,
    ]);
    this.mainCharacteristics.push(currentState);

    const activeMapping = new Map<CharacteristicValue, CharacteristicValue>();
    activeMapping.set(this.stateExpose.value_on, hap.Characteristic.Active.ACTIVE);
    activeMapping.set(this.stateExpose.value_off, hap.Characteristic.Active.INACTIVE);
    this.monitors.push(new MappingCharacteristicMonitor(this.stateExpose.property, this.service, hap.Characteristic.Active, activeMapping));

    const currentStateMapping = new Map<CharacteristicValue, CharacteristicValue>();
    currentStateMapping.set(this.stateExpose.value_on, hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
    currentStateMapping.set(this.stateExpose.value_off, hap.Characteristic.CurrentAirPurifierState.INACTIVE);
    this.monitors.push(
      new MappingCharacteristicMonitor(
        this.stateExpose.property,
        this.service,
        hap.Characteristic.CurrentAirPurifierState,
        currentStateMapping
      )
    );

    if (this.modeExpose !== undefined && this.supportsAutoManualCharacteristic()) {
      const targetState = getOrAddCharacteristic(this.service, hap.Characteristic.TargetAirPurifierState).on(
        'set',
        this.handleSetTargetState.bind(this)
      );
      this.mainCharacteristics.push(targetState);

      const validValues: number[] = [];
      if (this.supportsManual) {
        validValues.push(hap.Characteristic.TargetAirPurifierState.MANUAL);
      }
      if (this.supportsAuto) {
        validValues.push(hap.Characteristic.TargetAirPurifierState.AUTO);
      }
      setValidValuesOnCharacteristic(targetState, validValues);

      const targetStateMapping = new Map<CharacteristicValue, CharacteristicValue>();
      if (this.supportsAuto) {
        targetStateMapping.set('auto', hap.Characteristic.TargetAirPurifierState.AUTO);
      }
      this.modeValues
        .filter((v) => v !== 'auto')
        .forEach((v) => targetStateMapping.set(v, hap.Characteristic.TargetAirPurifierState.MANUAL));
      this.monitors.push(
        new MappingCharacteristicMonitor(
          this.modeExpose.property,
          this.service,
          hap.Characteristic.TargetAirPurifierState,
          targetStateMapping
        )
      );
    }

    if (this.modeExpose !== undefined && exposesCanBeSet(this.modeExpose) && this.numericModes.length > 0) {
      const rotationSpeed = getOrAddCharacteristic(this.service, hap.Characteristic.RotationSpeed).on(
        'set',
        this.handleSetRotationSpeed.bind(this)
      );
      rotationSpeed.setProps({ minValue: 0, maxValue: 100, minStep: 1 });
      this.mainCharacteristics.push(rotationSpeed);

      const numberOfLevels = this.numericModes.length;
      this.monitors.push(
        new NumericTransformCharacteristicMonitor(this.modeExpose.property, this.service, hap.Characteristic.RotationSpeed, (value) => {
          if (typeof value !== 'string') {
            return undefined;
          }
          const idx = this.numericModes.indexOf(value);
          return idx >= 0 ? Math.round(((idx + 1) * 100) / numberOfLevels) : undefined;
        })
      );

      if (fanSpeedExpose !== undefined) {
        this.monitors.push(
          new NumericTransformCharacteristicMonitor(this.stateExpose.property, this.service, hap.Characteristic.RotationSpeed, (value) =>
            value === this.stateExpose.value_off ? 0 : undefined
          )
        );
        this.monitors.push(
          new NumericTransformCharacteristicMonitor(fanSpeedExpose.property, this.service, hap.Characteristic.RotationSpeed, (value) =>
            typeof value === 'number' ? Math.round((value * 100) / fanSpeedExpose.value_max) : undefined
          )
        );
      }
    }
  }

  identifier: string;
  get getableKeys(): string[] {
    const keys: string[] = [];
    if (exposesCanBeGet(this.stateExpose)) {
      keys.push(this.stateExpose.property);
    }
    if (this.modeExpose !== undefined && exposesCanBeGet(this.modeExpose)) {
      keys.push(this.modeExpose.property);
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    if (this.modeExpose !== undefined) {
      const modeValue = state[this.modeExpose.property];
      if (typeof modeValue === 'string' && modeValue !== 'auto' && this.modeValues.includes(modeValue)) {
        this.lastManualMode = modeValue;
      }
    }
    this.monitors.forEach((m) => m.callback(state, this.accessory.log));
  }

  private supportsAutoManualCharacteristic() {
    return this.modeExpose !== undefined && (this.supportsAuto || this.supportsManual);
  }

  private getDefaultManualMode(): string | undefined {
    const bestDefault = this.numericModes[0] ?? this.modeValues.find((v) => v !== 'auto' && v !== 'off');
    return bestDefault ?? this.modeValues.find((v) => v !== 'auto');
  }

  private handleSetActive(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data[this.stateExpose.property] = value === hap.Characteristic.Active.ACTIVE ? this.stateExpose.value_on : this.stateExpose.value_off;
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }

  private handleSetTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.modeExpose === undefined || !exposesCanBeSet(this.modeExpose)) {
      callback(null);
      return;
    }

    const data = {};
    if (value === hap.Characteristic.TargetAirPurifierState.AUTO && this.supportsAuto) {
      data[this.modeExpose.property] = 'auto';
    } else if (this.lastManualMode !== undefined) {
      data[this.modeExpose.property] = this.lastManualMode;
    } else if (this.modeValues.includes('off')) {
      data[this.modeExpose.property] = 'off';
    } else {
      callback(null);
      return;
    }
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }

  private handleSetRotationSpeed(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.modeExpose === undefined || !exposesCanBeSet(this.modeExpose) || this.numericModes.length === 0) {
      callback(null);
      return;
    }

    const data = {};
    const speed = value as number;
    if (speed <= 0) {
      data[this.stateExpose.property] = this.stateExpose.value_off;
    } else {
      const idx = Math.min(this.numericModes.length - 1, Math.max(0, Math.round((speed * this.numericModes.length) / 100) - 1));
      data[this.modeExpose.property] = this.numericModes[idx];
    }
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.AirPurifier.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
