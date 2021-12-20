import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet,
  exposesCanBeSet,
  ExposesEntry, ExposesEntryWithBinaryProperty, ExposesEntryWithEnumProperty, ExposesEntryWithFeatures, exposesHasBinaryProperty, exposesHasEnumProperty, exposesHasFeatures,
  exposesIsPublished,
  ExposesKnownTypes,
  ExposesPredicate,
} from '../z2mModels';
import { hap } from '../hap';
import { BinaryConditionCharacteristicMonitor, CharacteristicMonitor, MappingCharacteristicMonitor } from './monitor';
import { getOrAddCharacteristic } from '../helpers';
import { CharacteristicSetCallback, CharacteristicValue } from 'homebridge';

export class FanCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes.filter(e => e.type === ExposesKnownTypes.FAN && exposesHasFeatures(e)
      && e.features.findIndex(f => FanV2Handler.FanStatePredicate(f) && accessory.isPropertyExcluded(f.property)) >= 0
      && !accessory.isServiceHandlerIdKnown(FanV2Handler.generateIdentifier(e.endpoint)))
      .forEach(e => this.createService(e as ExposesEntryWithFeatures, accessory));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory): void {
    try {
      const handler = new FanV2Handler(expose, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup fan for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`);
    }
  }
}

class FanV2Handler implements ServiceHandler {
  public static readonly KEY_FAN_STATE = 'fan_state';
  public static readonly KEY_FAN_MODE = 'fan_mode';

  public static FanStatePredicate: ExposesPredicate = f => f.name === FanV2Handler.KEY_FAN_STATE
    && exposesHasBinaryProperty(f) && exposesCanBeSet(f) && exposesIsPublished(f);

  private static FanModePredicate: ExposesPredicate = f => f.name === FanV2Handler.KEY_FAN_MODE
    && exposesHasEnumProperty(f) && exposesCanBeSet(f) && exposesIsPublished(f);

  private static readonly automaticFanModes = ['auto', 'smart'];
  private static readonly inactiveFanModes = ['off'];
  private static readonly idleFanModes = ['on'];
  private static readonly fanSpeedMapping = new Map<string, number>([
    ['low', 1],
    ['medium', 2],
    ['high', 3],
  ]);

  private readonly fanStateExpose: ExposesEntryWithBinaryProperty;
  private readonly fanModeExpose: ExposesEntryWithEnumProperty | undefined;
  private readonly monitors: CharacteristicMonitor[] = [];
  private readonly identifier: string;
  private readonly speedMapping: Map<string, number> | undefined;
  private speedStepSize = 1;

  constructor(expose: ExposesEntryWithFeatures, private readonly accessory: BasicAccessory) {
    const endpoint = expose.endpoint;
    this.identifier = FanV2Handler.generateIdentifier(endpoint);
    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);
    accessory.log.debug(`Configuring Fan v2 Service for ${serviceName}`);

    const features = expose.features.filter(f => !accessory.isPropertyExcluded(f.property));

    // Active?
    const fanStateExposeEntry = features.find(FanV2Handler.FanStatePredicate) as ExposesEntryWithBinaryProperty;
    if (fanStateExposeEntry === undefined) {
      throw new Error('Required "fan_state" property not found for Fan.');
    }
    this.fanStateExpose = fanStateExposeEntry;
    const service = accessory.getOrAddService(new hap.Service.Fanv2(serviceName, endpoint));
    getOrAddCharacteristic(service, hap.Characteristic.Active);

    const fanStates = new Map<CharacteristicValue, CharacteristicValue>();
    fanStates.set(this.fanStateExpose.value_on, hap.Characteristic.Active.ACTIVE);
    fanStates.set(this.fanStateExpose.value_off, hap.Characteristic.Active.INACTIVE);
    this.monitors.push(new MappingCharacteristicMonitor(this.fanStateExpose.property, service, hap.Characteristic.Active,
      fanStates));

    // Modes
    this.fanModeExpose = features.find(FanV2Handler.FanModePredicate) as ExposesEntryWithEnumProperty | undefined;
    if (this.fanModeExpose !== undefined) {
      // Current fan state mapping
      const currentFanStates = new Map<CharacteristicValue, CharacteristicValue>();
      const usedModes = new Set<CharacteristicValue>();
      for (const mode of this.fanModeExpose.values.filter(v => FanV2Handler.inactiveFanModes.includes(v))) {
        currentFanStates.set(mode, hap.Characteristic.CurrentFanState.INACTIVE);
        usedModes.add(mode);
      }
      for (const mode of this.fanModeExpose.values.filter(v => FanV2Handler.idleFanModes.includes(v))) {
        currentFanStates.set(mode, hap.Characteristic.CurrentFanState.IDLE);
        usedModes.add(mode);
      }
      for (const mode of this.fanModeExpose.values.filter(v => !usedModes.has(v))) {
        currentFanStates.set(mode, hap.Characteristic.CurrentFanState.BLOWING_AIR);
      }
      getOrAddCharacteristic(service, hap.Characteristic.CurrentFanState);
      this.monitors.push(new MappingCharacteristicMonitor(this.fanModeExpose.property, service, hap.Characteristic.CurrentFanState,
        currentFanStates));

      // Target fan state mapping (for reporting the value)
      if (this.fanModeExpose.values.findIndex(v => FanV2Handler.automaticFanModes.includes(v)) >= 0) {
        // Fan supports an automatic mode
        getOrAddCharacteristic(service, hap.Characteristic.TargetFanState)
          .on('set', this.handleSetTargetFanState.bind(this));
        this.monitors.push(new BinaryConditionCharacteristicMonitor(this.fanModeExpose.property, service, hap.Characteristic.TargetFanState,
          v => (FanV2Handler.automaticFanModes.findIndex(m => m === v) >= 0),
          hap.Characteristic.TargetFanState.AUTO,
          hap.Characteristic.TargetFanState.MANUAL));
      }

      // Fan speed supported?
      const tempMapping = FanV2Handler.findSpeedMapping(this.fanModeExpose.values);
      if (tempMapping !== undefined && tempMapping.size > 1) {
        this.speedMapping = tempMapping;

        // Determine step size
        const maxMappingValue = Math.max(...this.speedMapping.values());
        this.speedStepSize = Math.floor(100.0 / maxMappingValue);

        const speedCharacteristic = getOrAddCharacteristic(service, hap.Characteristic.RotationSpeed);
        speedCharacteristic.setProps({
          minStep: this.speedStepSize,
        });


      } else {
        this.speedMapping = undefined;
      }
    } else {
      this.speedMapping = undefined;
    }
  }

  get getableKeys(): string[] {
    const keys: string[] = [];
    if (exposesCanBeGet(this.fanStateExpose)) {
      keys.push(this.fanStateExpose.property);
    }
    if (this.fanModeExpose !== undefined && exposesCanBeGet(this.fanModeExpose)) {
      keys.push(this.fanModeExpose.property);
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach(m => m.callback(state));
  }

  private static findSpeedMapping(values: string[]): Map<string, number> | undefined {
    const remainingValues = values.filter(v => !FanV2Handler.automaticFanModes.includes(v) && !FanV2Handler.inactiveFanModes.includes(v)
      && !FanV2Handler.idleFanModes.includes(v));

    if (remainingValues.length === 0) {
      return undefined;
    }

    // Either all values are in the predefined mapping or they are numerical
    let hasMappingValue = false;
    let hasNumericValue = false;
    const result = new Map<string, number>();
    for (const value of remainingValues) {
      // Numeric?
      const numeric = Number(value);
      if (!isNaN(numeric)) {
        hasNumericValue = true;

        if (hasMappingValue) {
          // Inconsistent values
          return undefined;
        }
        result.set(value, numeric);
        continue;
      }

      // Known mapping?
      if (FanV2Handler.fanSpeedMapping.has(value)) {
        hasMappingValue = true;
        if (hasNumericValue) {
          // Inconsistent values
          return undefined;
        }
        result.set(value, FanV2Handler.fanSpeedMapping.get(value)!);
        continue;
      }

      // Unknown value
      return undefined;
    }

    return result;
  }

  private handleSetTargetFanState(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.fanModeExpose !== undefined) {
      // TODO Store last non automatic mode somewhere to restore it
      switch (value) {
        case hap.Characteristic.TargetFanState.AUTO: {
          const mqttValue = this.fanModeExpose.values.find(v => FanV2Handler.automaticFanModes.includes(v));
          if (mqttValue !== undefined) {

            const data = {};
            data[this.fanModeExpose.property] = mqttValue;
            this.accessory.queueDataForSetAction(data);
          }
        }
          break;
        case hap.Characteristic.TargetFanState.MANUAL: {
          // TODO Figure out which value to send
          const mqttValue = this.fanModeExpose.values.find(v => !FanV2Handler.automaticFanModes.includes(v));
          if (mqttValue !== undefined) {

            const data = {};
            data[this.fanModeExpose.property] = mqttValue;
            this.accessory.queueDataForSetAction(data);
          }
        }
          break;
        default:
          // do nothing
          break;
      }
    }
    callback(null);
  }

  private handleSetRotationSpeed(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.fanModeExpose !== undefined && this.speedMapping !== undefined) {
      // Find nearest value
      const requestedSpeed = value as number;
      let mqttValue: string | undefined;
      let delta = 100;
      for (const [key, mappingValue] of this.speedMapping) {
        const speed = this.mappedValueToSpeed(mappingValue);
        const newDelta = Math.abs(requestedSpeed - speed);
        if (newDelta < delta) {
          delta = newDelta;
          mqttValue = key;
        }
      }

      if (mqttValue !== undefined) {
        const data = {};
        data[this.fanModeExpose.property] = mqttValue;
        this.accessory.queueDataForSetAction(data);
      }
    }
    callback(null);
  }

  private mappedValueToSpeed(value: number): number {
    return Math.min(100, value * this.speedStepSize);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.Fanv2.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}