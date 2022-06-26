import { BasicAccessory, ConverterConfigurationRegistry, ServiceCreator, ServiceHandler } from './interfaces';
import {
  ExposesEntry, ExposesEntryWithBinaryProperty, ExposesEntryWithProperty,
  exposesHasBinaryProperty, exposesHasProperty, exposesIsPublished, ExposesKnownTypes,
} from '../z2mModels';
import { Logger } from 'homebridge';
import { groupByEndpoint } from '../helpers';
import { HumiditySensorHandler } from './basic_sensors/humidity';
import { AirPressureSensorHandler } from './basic_sensors/air_pressure';
import { LightSensorHandler } from './basic_sensors/light';
import { TemperatureSensorHandler } from './basic_sensors/temperature';
import { ContactSensorHandler } from './basic_sensors/contact';
import { WaterLeakSensorHandler, GasLeakSensorHandler } from './basic_sensors/leak';
import { CarbonMonoxideSensorHandler } from './basic_sensors/carbon_monoxide';
import { SmokeSensorHandler } from './basic_sensors/smoke';
import { VibrationSensorHandler } from './basic_sensors/vibration';
import { PresenceSensorHandler } from './basic_sensors/presence';
import { OccupancySensorHandler } from './basic_sensors/occupancy';
import { IdentifierGenerator } from './basic_sensors/basic';

interface ExposeToHandlerFunction {
  (expose: ExposesEntryWithProperty): ServiceHandler;
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