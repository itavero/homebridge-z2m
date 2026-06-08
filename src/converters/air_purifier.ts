import { Characteristic, CharacteristicSetCallback, CharacteristicValue } from 'homebridge';
import { hap } from '../hap';
import { getOrAddCharacteristic, setValidValuesOnCharacteristic } from '../helpers';
import {
  ExposesEntry,
  ExposesEntryWithBinaryProperty,
  ExposesEntryWithEnumProperty,
  ExposesEntryWithFeatures,
  ExposesKnownTypes,
  exposesCanBeGet,
  exposesHasBinaryProperty,
  exposesHasEnumProperty,
  exposesHasFeatures,
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
      .forEach((e) => {
        try {
          const handler = new AirPurifierHandler(e as ExposesEntryWithFeatures, accessory);
          accessory.registerServiceHandler(handler);
        } catch (error) {
          accessory.log.warn(
            `Failed to setup air purifier for accessory ${accessory.displayName} from expose "${JSON.stringify(e)}": ${error}`
          );
        }
      });
  }
}

class AirPurifierHandler implements ServiceHandler {
  private static readonly NAME_STATE = 'state';
  private static readonly NAME_MODE = 'mode';

  public static hasRequiredFeatures(expose: ExposesEntry): boolean {
    if (!exposesHasFeatures(expose)) {
      return false;
    }
    const e = expose as ExposesEntryWithFeatures;
    return e.features.some((f) => f.name === AirPurifierHandler.NAME_STATE && exposesHasBinaryProperty(f));
  }

  public mainCharacteristics: Characteristic[];

  identifier: string;

  private monitors: CharacteristicMonitor[] = [];
  private stateExpose: ExposesEntryWithBinaryProperty;
  private modeExpose?: ExposesEntryWithEnumProperty;
  private numericModes: string[] = [];
  private lastManualMode = '';

  constructor(
    expose: ExposesEntryWithFeatures,
    private readonly accessory: BasicAccessory
  ) {
    const endpoint = expose.endpoint;
    this.identifier = AirPurifierHandler.generateIdentifier(endpoint);

    const stateFeature = expose.features.find((f) => f.name === AirPurifierHandler.NAME_STATE && exposesHasBinaryProperty(f));
    if (stateFeature === undefined) {
      throw new Error('fan state feature not found');
    }
    this.stateExpose = stateFeature as ExposesEntryWithBinaryProperty;

    this.modeExpose = expose.features.find((f) => f.name === AirPurifierHandler.NAME_MODE && exposesHasEnumProperty(f)) as
      | ExposesEntryWithEnumProperty
      | undefined;

    if (this.modeExpose !== undefined) {
      this.numericModes = this.modeExpose.values.filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(a) - Number(b));
      this.lastManualMode = this.numericModes[0] ?? '';
    }

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);
    accessory.log.debug(`Configuring AirPurifier for ${serviceName}`);
    const service = accessory.getOrAddService(new hap.Service.AirPurifier(serviceName, endpoint));

    // Active characteristic (fan on/off)
    const activeChar = getOrAddCharacteristic(service, hap.Characteristic.Active).on('set', this.handleSetActive.bind(this));
    this.mainCharacteristics = [activeChar];

    const activeMapping = new Map<CharacteristicValue, CharacteristicValue>();
    activeMapping.set(this.stateExpose.value_on, hap.Characteristic.Active.ACTIVE);
    activeMapping.set(this.stateExpose.value_off, hap.Characteristic.Active.INACTIVE);
    this.monitors.push(new MappingCharacteristicMonitor(this.stateExpose.property, service, hap.Characteristic.Active, activeMapping));

    // CurrentAirPurifierState
    const currentStateChar = getOrAddCharacteristic(service, hap.Characteristic.CurrentAirPurifierState);
    setValidValuesOnCharacteristic(currentStateChar, [
      hap.Characteristic.CurrentAirPurifierState.INACTIVE,
      hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR,
    ]);
    const currentStateMapping = new Map<CharacteristicValue, CharacteristicValue>();
    currentStateMapping.set(this.stateExpose.value_on, hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
    currentStateMapping.set(this.stateExpose.value_off, hap.Characteristic.CurrentAirPurifierState.INACTIVE);
    this.monitors.push(
      new MappingCharacteristicMonitor(this.stateExpose.property, service, hap.Characteristic.CurrentAirPurifierState, currentStateMapping)
    );

    // TargetAirPurifierState and RotationSpeed: only when mode expose with numeric levels exists
    if (this.modeExpose !== undefined) {
      const targetStateChar = getOrAddCharacteristic(service, hap.Characteristic.TargetAirPurifierState).on(
        'set',
        this.handleSetTargetState.bind(this)
      );
      setValidValuesOnCharacteristic(targetStateChar, [
        hap.Characteristic.TargetAirPurifierState.MANUAL,
        hap.Characteristic.TargetAirPurifierState.AUTO,
      ]);

      const targetStateMapping = new Map<CharacteristicValue, CharacteristicValue>();
      targetStateMapping.set('auto', hap.Characteristic.TargetAirPurifierState.AUTO);
      for (const v of this.numericModes) {
        targetStateMapping.set(v, hap.Characteristic.TargetAirPurifierState.MANUAL);
      }
      targetStateMapping.set('off', hap.Characteristic.TargetAirPurifierState.MANUAL);
      this.monitors.push(
        new MappingCharacteristicMonitor(this.modeExpose.property, service, hap.Characteristic.TargetAirPurifierState, targetStateMapping)
      );

      if (this.numericModes.length > 0) {
        const numLevels = this.numericModes.length;
        const rotationChar = getOrAddCharacteristic(service, hap.Characteristic.RotationSpeed).on(
          'set',
          this.handleSetRotationSpeed.bind(this)
        );
        rotationChar.setProps({ minValue: 0, maxValue: 100, minStep: Math.floor(100 / numLevels) });
        // Monitor fan_mode for numeric values → rotation speed percentage
        this.monitors.push(
          new NumericTransformCharacteristicMonitor(this.modeExpose.property, service, hap.Characteristic.RotationSpeed, (value) => {
            const idx = this.numericModes.indexOf(value as string);
            return idx >= 0 ? Math.round(((idx + 1) * 100) / numLevels) : undefined;
          })
        );
      }
    }
  }

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
    // Cache last known manual mode for TargetAirPurifierState=MANUAL set operations
    if (this.modeExpose !== undefined) {
      const modeValue = state[this.modeExpose.property];
      if (typeof modeValue === 'string' && modeValue !== 'auto' && modeValue !== 'off') {
        this.lastManualMode = modeValue;
      }
    }
    this.monitors.forEach((m) => m.callback(state, this.accessory.log));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.AirPurifier.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }

  private handleSetActive(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data[this.stateExpose.property] = value === hap.Characteristic.Active.ACTIVE ? this.stateExpose.value_on : this.stateExpose.value_off;
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }

  private handleSetTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.modeExpose === undefined) {
      callback(new Error('Mode not supported'));
      return;
    }
    const data = {};
    if (value === hap.Characteristic.TargetAirPurifierState.AUTO) {
      data[this.modeExpose.property] = 'auto';
    } else {
      data[this.modeExpose.property] = this.lastManualMode;
    }
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }

  private handleSetRotationSpeed(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.modeExpose === undefined || this.numericModes.length === 0) {
      callback(new Error('Mode not supported'));
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
}
