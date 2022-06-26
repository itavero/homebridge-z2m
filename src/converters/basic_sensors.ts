import { BasicAccessory, ConverterConfigurationRegistry, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet, ExposesEntry, ExposesEntryWithBinaryProperty, ExposesEntryWithProperty,
  exposesHasBinaryProperty, exposesHasProperty, exposesIsPublished, ExposesKnownTypes,
} from '../z2mModels';
import {
  CharacteristicMonitor, MappingCharacteristicMonitor, PassthroughCharacteristicMonitor,
} from './monitor';
import { Characteristic, CharacteristicValue, Logger, Service, WithUUID } from 'homebridge';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic, groupByEndpoint } from '../helpers';
import { hap } from '../hap';

interface ExposeToHandlerFunction {
  (expose: ExposesEntryWithProperty): ServiceHandler;
}

interface ServiceConstructor {
  (serviceName: string, subType: string | undefined): Service;
}

interface IdentifierGenerator {
  (endpoint: string | undefined, accessory: BasicAccessory): string;
}

interface BasicSensorConstructor {
  new(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory);
}

declare type WithIdGenerator<T> = T & {
  generateIdentifier: IdentifierGenerator;
};

declare type WithConfigurableConverter<T> = T & {
  converterConfigTag: string;
  isValidConverterConfiguration(config: unknown, tag: string, logger: Logger | undefined): boolean;
};

class BasicSensorMapping {
  constructor(public readonly name: string, public readonly type: ExposesKnownTypes,
    public readonly implementation: WithIdGenerator<BasicSensorConstructor>) { }
}

abstract class BasicSensorHandler implements ServiceHandler {
  protected monitors: CharacteristicMonitor[] = [];
  protected tamperExpose?: ExposesEntryWithBinaryProperty;
  protected lowBatteryExpose?: ExposesEntryWithBinaryProperty;
  protected service: Service;
  protected serviceName: string;
  identifier = '';

  constructor(accessory: BasicAccessory, protected readonly sensorExpose: ExposesEntryWithProperty,
    otherExposes: ExposesEntryWithBinaryProperty[], identifierGen: IdentifierGenerator, service: ServiceConstructor,
    additionalSubType?: string | undefined) {
    const endpoint = sensorExpose.endpoint;

    let sub = endpoint;
    if (additionalSubType !== undefined) {
      if (sub === undefined) {
        sub = additionalSubType;
      } else {
        sub += ' ' + additionalSubType;
      }
    }

    this.serviceName = accessory.getDefaultServiceDisplayName(sub);

    this.identifier = identifierGen(endpoint, accessory);
    this.service = accessory.getOrAddService(service(this.serviceName, sub));
    this.tryCreateLowBattery(otherExposes, this.service);
    this.tryCreateTamper(otherExposes, this.service);
  }

  get getableKeys(): string[] {
    const keys: string[] = [];
    if (exposesCanBeGet(this.sensorExpose)) {
      keys.push(this.sensorExpose.property);
    }
    if (this.tamperExpose !== undefined && exposesCanBeGet(this.tamperExpose)) {
      keys.push(this.tamperExpose.property);
    }
    if (this.lowBatteryExpose !== undefined && exposesCanBeGet(this.lowBatteryExpose)) {
      keys.push(this.lowBatteryExpose.property);
    }
    return keys;
  }

  protected createOptionalGenericCharacteristics(exposes: ExposesEntryWithBinaryProperty[], service: Service) {
    this.tryCreateTamper(exposes, service);
    this.tryCreateLowBattery(exposes, service);
  }

  private tryCreateTamper(exposes: ExposesEntryWithBinaryProperty[], service: Service) {
    this.tamperExpose = exposes.find(e => e.name === 'tamper' && exposesIsPublished(e));

    if (this.tamperExpose !== undefined) {
      getOrAddCharacteristic(service, hap.Characteristic.StatusTampered);
      const mapping = new Map<CharacteristicValue, CharacteristicValue>();
      mapping.set(this.tamperExpose.value_on, hap.Characteristic.StatusTampered.TAMPERED);
      mapping.set(this.tamperExpose.value_off, hap.Characteristic.StatusTampered.NOT_TAMPERED);
      this.monitors.push(new MappingCharacteristicMonitor(this.tamperExpose.property, service, hap.Characteristic.StatusTampered,
        mapping));
    }
  }

  private tryCreateLowBattery(exposes: ExposesEntryWithBinaryProperty[], service: Service) {
    this.lowBatteryExpose = exposes.find(e => e.name === 'battery_low' && exposesIsPublished(e));

    if (this.lowBatteryExpose !== undefined) {
      getOrAddCharacteristic(service, hap.Characteristic.StatusLowBattery);
      const mapping = new Map<CharacteristicValue, CharacteristicValue>();
      mapping.set(this.lowBatteryExpose.value_on, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
      mapping.set(this.lowBatteryExpose.value_off, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
      this.monitors.push(new MappingCharacteristicMonitor(this.lowBatteryExpose.property, service, hap.Characteristic.StatusLowBattery,
        mapping));
    }
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach(m => m.callback(state));
  }
}

class HumiditySensorHandler extends BasicSensorHandler {
  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, HumiditySensorHandler.generateIdentifier, (n, t) => new hap.Service.HumiditySensor(n, t));
    accessory.log.debug(`Configuring HumiditySensor for ${this.serviceName}`);

    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentRelativeHumidity);
    copyExposesRangeToCharacteristic(expose, characteristic);
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentRelativeHumidity));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.HumiditySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class AirPressureSensorHandler extends BasicSensorHandler {
  private static readonly ServiceUUID: string = 'E863F00A-079E-48FF-8F27-9C2605A29F52';
  private static readonly CharacteristicUUID: string = 'E863F10F-079E-48FF-8F27-9C2605A29F52';
  private static readonly CharacteristicName: string = 'Air Pressure';

  static AirPressureSensor(displayName: string, subtype?: string | undefined): Service {
    const service = new hap.Service(displayName, AirPressureSensorHandler.ServiceUUID, subtype);
    service.addCharacteristic(AirPressureSensorHandler.AirPressure);
    return service;
  }

  static get AirPressure(): Characteristic {
    const characteristic = new hap.Characteristic(AirPressureSensorHandler.CharacteristicName, AirPressureSensorHandler.CharacteristicUUID,
      {
        format: hap.Formats.UINT16,
        perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
        minValue: 700,
        maxValue: 1100,
        minStep: 1,
      });
    characteristic.value = 1013;
    return characteristic;
  }

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, AirPressureSensorHandler.generateIdentifier,
      (n, t) => AirPressureSensorHandler.AirPressureSensor(n, t));
    accessory.log.debug(`Configuring AirPressureSensor for ${this.serviceName}`);

    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, AirPressureSensorHandler.CharacteristicName));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = AirPressureSensorHandler.ServiceUUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class TemperatureSensorHandler extends BasicSensorHandler {
  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, TemperatureSensorHandler.generateIdentifier, (n, t) => new hap.Service.TemperatureSensor(n, t));
    accessory.log.debug(`Configuring TemperatureSensor for ${this.serviceName}`);
    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentTemperature);
    if (!copyExposesRangeToCharacteristic(expose, characteristic)) {
      // Cannot take over range from exposes entry -> Set default range
      characteristic.setProps({
        minValue: -100,
        maxValue: 100,
      });
    }
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentTemperature));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.TemperatureSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class LightSensorHandler extends BasicSensorHandler {
  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, LightSensorHandler.generateIdentifier, (n, t) => new hap.Service.LightSensor(n, t));
    accessory.log.debug(`Configuring LightSensor for ${this.serviceName}`);

    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentAmbientLightLevel);
    if (!copyExposesRangeToCharacteristic(expose, characteristic)) {
      // Cannot take over range from exposes entry -> Set default props
      characteristic.setProps({
        minValue: 0,
      });
    }

    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentAmbientLightLevel));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.LightSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class BinarySensorTypeDefinition {
  public constructor(
    public readonly service: ServiceConstructor,
    public readonly characteristic: WithUUID<{ new(): Characteristic }>,
    public readonly hapOnValue: CharacteristicValue,
    public readonly hapOffValue: CharacteristicValue,
    public readonly additionalSubType?: string | undefined) {
  }
}

interface BinarySensorConfig {
  type?: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isBinarySensorConfig = (x: any): x is BinarySensorConfig => (
  x !== undefined && (
    x.type === undefined
    || (typeof x.type === 'string' && x.type.length > 0)
  ));

abstract class ConfigurableBinarySensorHandler extends BasicSensorHandler {
  constructor(accessory: BasicAccessory, expose: ExposesEntryWithBinaryProperty, otherExposes: ExposesEntryWithBinaryProperty[],
    identifierGen: IdentifierGenerator, logName: string,
    configTag: string | undefined, defaultType: string,
    typeDefinitions: Map<string, BinarySensorTypeDefinition>) {
    let definition = typeDefinitions.get(defaultType);
    if (definition === undefined) {
      throw new Error(`Unknown default binary sensor type ${defaultType} for ${logName}`);
    }

    if (configTag !== undefined) {
      const converterConfig = accessory.getConverterConfiguration(configTag);
      if (isBinarySensorConfig(converterConfig) && converterConfig.type !== undefined) {
        const chosenDefinition = typeDefinitions.get(converterConfig.type);
        if (chosenDefinition !== undefined) {
          definition = chosenDefinition;
        } else {
          accessory.log.error(`Invalid type chosen for ${logName}: ${converterConfig.type} (${accessory.displayName})`);
        }
      }
    }

    super(accessory, expose, otherExposes, identifierGen, definition.service, definition.additionalSubType);
    accessory.log.debug(`Configuring ${logName} for ${this.serviceName}`);

    getOrAddCharacteristic(this.service, definition.characteristic);
    const mapping = new Map<CharacteristicValue, CharacteristicValue>();
    mapping.set(expose.value_on, definition.hapOnValue);
    mapping.set(expose.value_off, definition.hapOffValue);
    this.monitors.push(new MappingCharacteristicMonitor(expose.property, this.service, definition.characteristic,
      mapping));
  }
}

abstract class BinarySensorHandler extends ConfigurableBinarySensorHandler {
  constructor(accessory: BasicAccessory, expose: ExposesEntryWithBinaryProperty, otherExposes: ExposesEntryWithBinaryProperty[],
    identifierGen: IdentifierGenerator, logName: string,
    service: ServiceConstructor,
    characteristic: WithUUID<{ new(): Characteristic }>,
    hapOnValue: CharacteristicValue,
    hapOffValue: CharacteristicValue,
    additionalSubType?: string | undefined) {

    super(accessory, expose, otherExposes, identifierGen, logName, undefined, '', new Map<string, BinarySensorTypeDefinition>([
      ['', new BinarySensorTypeDefinition(service, characteristic, hapOnValue, hapOffValue, additionalSubType)],
    ]));
  }
}

class ContactSensorHandler extends BinarySensorHandler {
  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, ContactSensorHandler.generateIdentifier, 'ContactSensor',
      (n, t) => new hap.Service.ContactSensor(n, t), hap.Characteristic.ContactSensorState,
      hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED, hap.Characteristic.ContactSensorState.CONTACT_DETECTED);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.ContactSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class OccupancySensorHandler extends ConfigurableBinarySensorHandler {

  public static readonly converterConfigTag = 'occupancy';
  private static readonly defaultType: string = 'occupancy';
  private static readonly typeMotion: string = 'motion';
  public static isValidConverterConfiguration(config: unknown, tag: string, logger: Logger | undefined): boolean {
    if (!isBinarySensorConfig(config)) {
      return false;
    }
    if (config.type !== undefined && !this.getTypeDefinitions().has(config.type)) {
      logger?.error(`Invalid type chosen for ${tag} converter: ${config.type}`);
      return false;
    }
    return true;
  }

  private static getTypeDefinitions(): Map<string, BinarySensorTypeDefinition> {
    return new Map<string, BinarySensorTypeDefinition>([
      [OccupancySensorHandler.defaultType, new BinarySensorTypeDefinition((n, t) => new hap.Service.OccupancySensor(n, t),
        hap.Characteristic.OccupancyDetected,
        hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED, hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED)],
      [OccupancySensorHandler.typeMotion, new BinarySensorTypeDefinition((n, t) => new hap.Service.MotionSensor(n, t),
        hap.Characteristic.MotionDetected, true, false, 'occupancy')],
    ]);
  }

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, OccupancySensorHandler.generateIdentifier, 'OccupancySensor',
      OccupancySensorHandler.converterConfigTag, OccupancySensorHandler.defaultType, OccupancySensorHandler.getTypeDefinitions());
  }

  static generateIdentifier(endpoint: string | undefined, accessory: BasicAccessory) {
    const config = accessory.getConverterConfiguration(OccupancySensorHandler.converterConfigTag);
    let identifier = (isBinarySensorConfig(config) && config.type === OccupancySensorHandler.typeMotion) ?
      `${OccupancySensorHandler.converterConfigTag}_${hap.Service.MotionSensor.UUID}` : hap.Service.OccupancySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class PresenceSensorHandler extends BinarySensorHandler {
  public static readonly NAME = 'presence';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, PresenceSensorHandler.generateIdentifier,
      'Occupancy Sensor (presence)',
      (n, t) => new hap.Service.OccupancySensor(n, (PresenceSensorHandler.NAME + ' ' + (t ?? '')).trim()),
      hap.Characteristic.OccupancyDetected,
      hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED, hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = PresenceSensorHandler.NAME + '_' + hap.Service.OccupancySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class VibrationSensorHandler extends BinarySensorHandler {
  public static readonly NAME = 'vibration';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, VibrationSensorHandler.generateIdentifier,
      'Motion Sensor (vibration)', (n, t) => new hap.Service.MotionSensor(n, (VibrationSensorHandler.NAME + ' ' + (t ?? '')).trim()),
      hap.Characteristic.MotionDetected, true, false);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = VibrationSensorHandler.NAME + '_' + hap.Service.MotionSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class SmokeSensorHandler extends BinarySensorHandler {
  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, SmokeSensorHandler.generateIdentifier, 'SmokeSensor',
      (n, t) => new hap.Service.SmokeSensor(n, t),
      hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_DETECTED,
      hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.SmokeSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class CarbonMonoxideSensorHandler extends BinarySensorHandler {
  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, CarbonMonoxideSensorHandler.generateIdentifier,
      'CarbonMonoxideSensor', (n, t) => new hap.Service.CarbonMonoxideSensor(n, t), hap.Characteristic.CarbonMonoxideDetected,
      hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL, hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.CarbonMonoxideSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

abstract class LeakSensorHandler extends BinarySensorHandler {
  constructor(subType: string, identifierGen: IdentifierGenerator, expose: ExposesEntryWithProperty,
    otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, identifierGen, subType + ' LeakSensor',
      (n, t) => new hap.Service.LeakSensor(n, t), hap.Characteristic.LeakDetected,
      hap.Characteristic.LeakDetected.LEAK_DETECTED, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED, subType);
  }

  static generateIdentifier(endpoint: string | undefined, additionalSubType: string) {
    let identifier = `${additionalSubType}_${hap.Service.LeakSensor.UUID}`;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class WaterLeakSensorHandler extends LeakSensorHandler {
  private static readonly SUBTYPE = 'water';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(WaterLeakSensorHandler.SUBTYPE, WaterLeakSensorHandler.generateIdentifier, expose, otherExposes, accessory);
  }

  static generateIdentifier(endpoint: string | undefined) {
    return LeakSensorHandler.generateIdentifier(endpoint, WaterLeakSensorHandler.SUBTYPE);
  }
}

class GasLeakSensorHandler extends LeakSensorHandler {
  private static readonly SUBTYPE = 'gas';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(GasLeakSensorHandler.SUBTYPE, GasLeakSensorHandler.generateIdentifier, expose, otherExposes, accessory);
  }

  static generateIdentifier(endpoint: string | undefined) {
    return LeakSensorHandler.generateIdentifier(endpoint, GasLeakSensorHandler.SUBTYPE);
  }
}

export class BasicSensorCreator implements ServiceCreator {
  private static mapping: BasicSensorMapping[] = [
    new BasicSensorMapping('humidity', ExposesKnownTypes.NUMERIC, HumiditySensorHandler),
    new BasicSensorMapping('temperature', ExposesKnownTypes.NUMERIC, TemperatureSensorHandler),
    new BasicSensorMapping('illuminance_lux', ExposesKnownTypes.NUMERIC, LightSensorHandler),
    new BasicSensorMapping('pressure', ExposesKnownTypes.NUMERIC, AirPressureSensorHandler),
    new BasicSensorMapping('contact', ExposesKnownTypes.BINARY, ContactSensorHandler),
    new BasicSensorMapping('occupancy', ExposesKnownTypes.BINARY, OccupancySensorHandler),
    new BasicSensorMapping(PresenceSensorHandler.NAME, ExposesKnownTypes.BINARY, PresenceSensorHandler),
    new BasicSensorMapping(VibrationSensorHandler.NAME, ExposesKnownTypes.BINARY, VibrationSensorHandler),
    new BasicSensorMapping('smoke', ExposesKnownTypes.BINARY, SmokeSensorHandler),
    new BasicSensorMapping('carbon_monoxide', ExposesKnownTypes.BINARY, CarbonMonoxideSensorHandler),
    new BasicSensorMapping('water_leak', ExposesKnownTypes.BINARY, WaterLeakSensorHandler),
    new BasicSensorMapping('gas', ExposesKnownTypes.BINARY, GasLeakSensorHandler),
  ];

  private static configs: WithConfigurableConverter<unknown>[] = [
    OccupancySensorHandler,
  ];

  constructor(converterConfigRegistry: ConverterConfigurationRegistry) {
    for (const config of BasicSensorCreator.configs) {
      converterConfigRegistry.registerConverterConfiguration(config.converterConfigTag, config.isValidConverterConfiguration);
    }
  }

  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    const endpointMap = groupByEndpoint(exposes.filter(e => exposesHasProperty(e) && !accessory.isPropertyExcluded(e.property)
      && exposesIsPublished(e)).map(e => e as ExposesEntryWithProperty));

    endpointMap.forEach((value, key) => {
      const optionalProperties = value.filter(e => exposesHasBinaryProperty(e) && (e.name === 'battery_low' || e.name === 'tamper'))
        .map(e => e as ExposesEntryWithBinaryProperty);
      BasicSensorCreator.mapping.forEach(m => {
        const values = value.filter(e => e.name === m.name && e.type === m.type);
        if (values.length > 0 && !accessory.isServiceHandlerIdKnown(m.implementation.generateIdentifier(key, accessory))) {
          values.forEach(e => this.createService(accessory, e, (x) => new m.implementation(x, optionalProperties, accessory)));
        }
      });
    });
  }

  private createService(accessory: BasicAccessory, expose: ExposesEntryWithProperty, creator: ExposeToHandlerFunction): void {
    try {
      const handler = creator(expose);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup sensor for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`);
    }
  }
}