import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet,
  exposesCanBeSet,
  ExposesEntry,
  ExposesEntryWithEnumProperty,
  ExposesEntryWithFeatures,
  ExposesEntryWithProperty,
  exposesHasAllRequiredFeatures,
  exposesHasEnumProperty,
  exposesHasFeatures,
  exposesHasProperty,
  exposesIsPublished,
  ExposesKnownTypes,
  ExposesPredicate,
} from '../z2mModels';
import { hap } from '../hap';
import { CharacteristicMonitor, MappingCharacteristicMonitor, PassthroughCharacteristicMonitor } from './monitor';
import {
  allowSingleValueForCharacteristic,
  copyExposesRangeToCharacteristic,
  getOrAddCharacteristic,
  setValidValuesOnCharacteristic,
} from '../helpers';
import { Characteristic, CharacteristicSetCallback, CharacteristicValue } from 'homebridge';

export class ThermostatCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes
      .filter(
        (e) =>
          e.type === ExposesKnownTypes.CLIMATE &&
          exposesHasFeatures(e) &&
          ThermostatHandler.hasRequiredFeatures(accessory, e) &&
          !accessory.isServiceHandlerIdKnown(ThermostatHandler.generateIdentifier(e.endpoint))
      )
      .forEach((e) => this.createService(e as ExposesEntryWithFeatures, accessory));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory): void {
    try {
      const handler = new ThermostatHandler(expose, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(
        `Failed to setup thermostat for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}":` + error
      );
    }
  }
}

class ThermostatHandler implements ServiceHandler {
  private static readonly NAMES_SETPOINT = new Set(['current_heating_setpoint', 'occupied_heating_setpoint']);

  private static readonly NAME_TARGET_MODE = 'system_mode';
  private static readonly NAME_CURRENT_STATE = 'running_state';
  private static readonly NAME_LOCAL_TEMPERATURE = 'local_temperature';

  private static readonly PREDICATE_TARGET_MODE: ExposesPredicate = (f) =>
    f.name === ThermostatHandler.NAME_TARGET_MODE && exposesHasEnumProperty(f) && exposesCanBeSet(f) && exposesIsPublished(f);

  private static readonly PREDICATE_CURRENT_STATE: ExposesPredicate = (f) =>
    f.name === ThermostatHandler.NAME_CURRENT_STATE && exposesHasEnumProperty(f) && exposesIsPublished(f);

  private static readonly PREDICATE_LOCAL_TEMPERATURE: ExposesPredicate = (f) =>
    f.name === ThermostatHandler.NAME_LOCAL_TEMPERATURE && exposesHasProperty(f) && exposesIsPublished(f);

  private static readonly PREDICATE_SETPOINT: ExposesPredicate = (f) =>
    f.name !== undefined &&
    ThermostatHandler.NAMES_SETPOINT.has(f.name) &&
    exposesHasProperty(f) &&
    exposesCanBeSet(f) &&
    exposesIsPublished(f);

  private static getCurrentStateFromMqttMapping(values: string[]): Map<string, CharacteristicValue> {
    const mapping = new Map<string, CharacteristicValue>();
    if (values.includes('idle')) {
      mapping.set('idle', hap.Characteristic.CurrentHeatingCoolingState.OFF);
    }
    if (values.includes('heat')) {
      mapping.set('heat', hap.Characteristic.CurrentHeatingCoolingState.HEAT);
    }
    if (values.includes('cool')) {
      mapping.set('cool', hap.Characteristic.CurrentHeatingCoolingState.COOL);
    }
    return mapping;
  }

  private static getTargetModeFromMqttMapping(values: string[]): Map<string, CharacteristicValue> {
    const mapping = new Map<string, CharacteristicValue>();
    // 'off', 'heat', 'cool', 'auto', 'dry', 'fan_only'
    if (values.includes('off')) {
      mapping.set('off', hap.Characteristic.TargetHeatingCoolingState.OFF);
    }
    if (values.includes('heat')) {
      mapping.set('heat', hap.Characteristic.TargetHeatingCoolingState.HEAT);
    }
    if (values.includes('cool')) {
      mapping.set('cool', hap.Characteristic.TargetHeatingCoolingState.COOL);
    }
    if (values.includes('auto')) {
      mapping.set('auto', hap.Characteristic.TargetHeatingCoolingState.AUTO);
    }

    // NOTE: MQTT values 'dry' and 'fan_only' cannot be mapped to/from HomeKit.
    return mapping;
  }

  public static hasRequiredFeatures(accessory: BasicAccessory, e: ExposesEntryWithFeatures): boolean {
    if (e.features.findIndex((f) => f.name === 'occupied_cooling_setpoint') >= 0) {
      // For now ignore devices that have a cooling setpoint as I haven't figured our how to handle this correctly in HomeKit.
      return false;
    }

    return exposesHasAllRequiredFeatures(e, [ThermostatHandler.PREDICATE_SETPOINT, ThermostatHandler.PREDICATE_LOCAL_TEMPERATURE]);
  }

  public mainCharacteristics: Characteristic[];

  private monitors: CharacteristicMonitor[] = [];
  private localTemperatureExpose: ExposesEntryWithProperty;
  private setpointExpose: ExposesEntryWithProperty;
  private targetModeExpose?: ExposesEntryWithEnumProperty;
  private currentStateExpose?: ExposesEntryWithEnumProperty;
  private targetModeFromHomeKitMapping?: Map<CharacteristicValue, string>;

  constructor(
    expose: ExposesEntryWithFeatures,
    private readonly accessory: BasicAccessory
  ) {
    const endpoint = expose.endpoint;
    this.identifier = ThermostatHandler.generateIdentifier(endpoint);

    // Store all required features
    const possibleLocalTemp = expose.features.find(ThermostatHandler.PREDICATE_LOCAL_TEMPERATURE);
    if (possibleLocalTemp === undefined) {
      throw new Error('Local temperature feature not found.');
    }
    this.localTemperatureExpose = possibleLocalTemp as ExposesEntryWithProperty;

    const possibleSetpoint = expose.features.find(ThermostatHandler.PREDICATE_SETPOINT);
    if (possibleSetpoint === undefined) {
      throw new Error('Setpoint feature not found.');
    }
    this.setpointExpose = possibleSetpoint as ExposesEntryWithProperty;

    this.targetModeExpose = expose.features.find(ThermostatHandler.PREDICATE_TARGET_MODE) as ExposesEntryWithEnumProperty;
    this.currentStateExpose = expose.features.find(ThermostatHandler.PREDICATE_CURRENT_STATE) as ExposesEntryWithEnumProperty;
    if (this.targetModeExpose === undefined || this.currentStateExpose === undefined) {
      if (this.targetModeExpose !== undefined) {
        this.accessory.log.debug(`${accessory.displayName}: ignore ${this.targetModeExpose.property}; no current state exposed.`);
      }
      if (this.currentStateExpose !== undefined) {
        this.accessory.log.debug(`${accessory.displayName}: ignore ${this.currentStateExpose.property}; no current state exposed.`);
      }
      // If one of them is undefined, ignore the other one
      this.targetModeExpose = undefined;
      this.currentStateExpose = undefined;
    }

    // Setup service
    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);
    accessory.log.debug(`Configuring Thermostat for ${serviceName}`);
    const service = accessory.getOrAddService(new hap.Service.Thermostat(serviceName, endpoint));

    // Monitor local temperature
    const currentTemperature = getOrAddCharacteristic(service, hap.Characteristic.CurrentTemperature);
    this.mainCharacteristics = [currentTemperature];
    copyExposesRangeToCharacteristic(this.localTemperatureExpose, currentTemperature);
    this.monitors.push(
      new PassthroughCharacteristicMonitor(this.localTemperatureExpose.property, service, hap.Characteristic.CurrentTemperature)
    );

    // Setpoint
    const setpoint = getOrAddCharacteristic(service, hap.Characteristic.TargetTemperature).on('set', this.handleSetSetpoint.bind(this));
    copyExposesRangeToCharacteristic(this.setpointExpose, setpoint);
    this.monitors.push(new PassthroughCharacteristicMonitor(this.setpointExpose.property, service, hap.Characteristic.TargetTemperature));

    // Map mode/state
    if (this.targetModeExpose !== undefined && this.currentStateExpose !== undefined) {
      // Current state
      const stateMapping = ThermostatHandler.getCurrentStateFromMqttMapping(this.currentStateExpose.values);
      if (stateMapping.size === 0) {
        throw new Error('Cannot map current state');
      }
      const stateValues = [...stateMapping.values()].map((x) => x as number);
      setValidValuesOnCharacteristic(getOrAddCharacteristic(service, hap.Characteristic.CurrentHeatingCoolingState), stateValues);
      this.monitors.push(
        new MappingCharacteristicMonitor(
          this.currentStateExpose.property,
          service,
          hap.Characteristic.CurrentHeatingCoolingState,
          stateMapping
        )
      );

      // Target state/mode
      const targetMapping = ThermostatHandler.getTargetModeFromMqttMapping(this.targetModeExpose.values);
      if (targetMapping.size === 0) {
        throw new Error('Cannot map target state/mode');
      }

      // Store reverse mapping for changing the state from HomeKit
      this.targetModeFromHomeKitMapping = new Map<CharacteristicValue, string>();
      for (const [mqtt, hk] of targetMapping) {
        this.targetModeFromHomeKitMapping.set(hk, mqtt);
      }

      const targetValues = [...targetMapping.values()].map((x) => x as number);
      setValidValuesOnCharacteristic(getOrAddCharacteristic(service, hap.Characteristic.TargetHeatingCoolingState), targetValues).on(
        'set',
        this.handleSetTargetState.bind(this)
      );
      this.monitors.push(
        new MappingCharacteristicMonitor(
          this.targetModeExpose.property,
          service,
          hap.Characteristic.TargetHeatingCoolingState,
          targetMapping
        )
      );
    } else {
      // Assume heat only device
      allowSingleValueForCharacteristic(
        getOrAddCharacteristic(service, hap.Characteristic.CurrentHeatingCoolingState),
        hap.Characteristic.CurrentHeatingCoolingState.HEAT
      ).updateValue(hap.Characteristic.CurrentHeatingCoolingState.HEAT);
      allowSingleValueForCharacteristic(
        getOrAddCharacteristic(service, hap.Characteristic.TargetHeatingCoolingState),
        hap.Characteristic.TargetHeatingCoolingState.HEAT
      ).updateValue(hap.Characteristic.TargetHeatingCoolingState.HEAT);
    }

    // Only support degrees Celsius
    allowSingleValueForCharacteristic(
      getOrAddCharacteristic(service, hap.Characteristic.TemperatureDisplayUnits),
      hap.Characteristic.TemperatureDisplayUnits.CELSIUS
    ).updateValue(hap.Characteristic.TemperatureDisplayUnits.CELSIUS);
  }

  identifier: string;
  get getableKeys(): string[] {
    const keys: string[] = [];
    if (exposesCanBeGet(this.localTemperatureExpose)) {
      keys.push(this.localTemperatureExpose.property);
    }
    if (exposesCanBeGet(this.setpointExpose)) {
      keys.push(this.setpointExpose.property);
    }
    if (this.targetModeExpose !== undefined && exposesCanBeGet(this.targetModeExpose)) {
      keys.push(this.targetModeExpose.property);
    }
    if (this.currentStateExpose !== undefined && exposesCanBeGet(this.currentStateExpose)) {
      keys.push(this.currentStateExpose.property);
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach((m) => m.callback(state));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.Thermostat.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }

  private handleSetTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (
      this.targetModeExpose !== undefined &&
      this.targetModeFromHomeKitMapping !== undefined &&
      this.targetModeFromHomeKitMapping.size > 0
    ) {
      const mqttValue = this.targetModeFromHomeKitMapping.get(value);
      if (mqttValue !== undefined) {
        const data = {};
        data[this.targetModeExpose.property] = mqttValue;
        this.accessory.queueDataForSetAction(data);
      }
      callback(null);
    } else {
      callback(new Error('Changing the target state is not supported for this device'));
    }
  }

  private handleSetSetpoint(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data[this.setpointExpose.property] = value;
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }
}
