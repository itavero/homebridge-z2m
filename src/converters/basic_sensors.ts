import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet, ExposesEntry, ExposesEntryWithBinaryProperty, ExposesEntryWithProperty,
  exposesHasBinaryProperty, exposesHasProperty, exposesIsPublished, ExposesKnownTypes,
} from '../z2mModels';
import {
  CharacteristicMonitor, MappingCharacteristicMonitor, PassthroughCharacteristicMonitor,
} from './monitor';
import { Characteristic, CharacteristicValue, Service, WithUUID } from 'homebridge';
import { getOrAddCharacteristic } from '../helpers';
import { hap } from '../hap';

interface ExposeToHandlerFunction {
  (expose: ExposesEntryWithProperty): ServiceHandler;
}

interface ServiceConstructor {
  (serviceName: string, subType: string | undefined): Service;
}

interface IdentifierGenerator {
  (endpoint: string | undefined): string;
}

interface BasicSensorConstructor {
  new(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory);
}

declare type WithIdGenerator<T> = T & {
  generateIdentifier: IdentifierGenerator;
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
    this.serviceName = accessory.displayName;
    if (endpoint !== undefined) {
      this.serviceName += ' ' + endpoint;
    }

    let sub = endpoint;
    if (additionalSubType !== undefined) {
      if (sub === undefined) {
        sub = additionalSubType;
      } else {
        sub += ' ' + additionalSubType;
      }
    }

    this.identifier = identifierGen(endpoint);
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

    getOrAddCharacteristic(this.service, hap.Characteristic.CurrentRelativeHumidity);
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
    const characteristic = new hap.Characteristic(AirPressureSensorHandler.CharacteristicName, AirPressureSensorHandler.CharacteristicUUID);
    characteristic.setProps({
      format: hap.Formats.UINT16,
      perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
      minValue: 700,
      maxValue: 1100,
      minStep: 1,
    });
    characteristic.value = characteristic.getDefaultValue();

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

    getOrAddCharacteristic(this.service, hap.Characteristic.CurrentTemperature);
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

    getOrAddCharacteristic(this.service, hap.Characteristic.CurrentAmbientLightLevel);
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

abstract class BinarySensorHandler extends BasicSensorHandler {
  constructor(accessory: BasicAccessory, expose: ExposesEntryWithBinaryProperty, otherExposes: ExposesEntryWithBinaryProperty[],
    identifierGen: IdentifierGenerator, logName: string, service: ServiceConstructor,
    characteristic: WithUUID<{ new(): Characteristic }>,
    hapOnValue: CharacteristicValue, hapOffValue: CharacteristicValue, additionalSubType?: string | undefined) {
    super(accessory, expose, otherExposes, identifierGen, service, additionalSubType);
    accessory.log.debug(`Configuring ${logName} for ${this.serviceName}`);

    getOrAddCharacteristic(this.service, characteristic);
    const mapping = new Map<CharacteristicValue, CharacteristicValue>();
    mapping.set(expose.value_on, hapOnValue);
    mapping.set(expose.value_off, hapOffValue);
    this.monitors.push(new MappingCharacteristicMonitor(expose.property, this.service, characteristic,
      mapping));
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

class OccupancySensorHandler extends BinarySensorHandler {
  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, OccupancySensorHandler.generateIdentifier, 'OccupancySensor',
      (n, t) => new hap.Service.OccupancySensor(n, t), hap.Characteristic.OccupancyDetected,
      hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED, hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.OccupancySensor.UUID;
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
    new BasicSensorMapping('smoke', ExposesKnownTypes.BINARY, SmokeSensorHandler),
    new BasicSensorMapping('carbon_monoxide', ExposesKnownTypes.BINARY, CarbonMonoxideSensorHandler),
    new BasicSensorMapping('water_leak', ExposesKnownTypes.BINARY, WaterLeakSensorHandler),
    new BasicSensorMapping('gas', ExposesKnownTypes.BINARY, GasLeakSensorHandler),
  ];

  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    const endpointMap = new Map<string | undefined, ExposesEntryWithProperty[]>();
    exposes.filter(e => exposesHasProperty(e) && !accessory.isPropertyExcluded(e.property)
    && exposesIsPublished(e)).map(e => e as ExposesEntryWithProperty)
      .forEach((item) => {
        const collection = endpointMap.get(item.endpoint);
        if (!collection) {
          endpointMap.set(item.endpoint, [item]);
        } else {
          collection.push(item);
        }
      });

    endpointMap.forEach((value, key) => {
      const optionalProperties = value.filter(e => exposesHasBinaryProperty(e) && (e.name === 'battery_low' || e.name === 'tamper'))
        .map(e => e as ExposesEntryWithBinaryProperty);
      BasicSensorCreator.mapping.forEach(m => {
        if (!accessory.isServiceHandlerIdKnown(m.implementation.generateIdentifier(key))) {
          value.filter(e => e.name === m.name && e.type === m.type)
            .forEach(e => this.createService(accessory, e, (x) => new m.implementation(x, optionalProperties, accessory)));
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