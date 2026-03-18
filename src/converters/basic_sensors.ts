import { groupByEndpoint } from '../helpers';
import { BasicLogger } from '../logger';
import {
  ExposesEntry,
  ExposesEntryWithBinaryProperty,
  ExposesEntryWithProperty,
  ExposesKnownTypes,
  exposesHasBinaryProperty,
  exposesHasProperty,
  exposesIsPublished,
} from '../z2mModels';
import { AirPressureSensorHandler } from './basic_sensors/air_pressure';
import { IdentifierGenerator } from './basic_sensors/basic';
import { CarbonDioxideSensorHandler } from './basic_sensors/carbon_dioxide';
import { CarbonMonoxideSensorHandler } from './basic_sensors/carbon_monoxide';
import { ContactSensorHandler } from './basic_sensors/contact';
import { DeviceTemperatureSensorHandler } from './basic_sensors/device_temperature';
import { HumiditySensorHandler } from './basic_sensors/humidity';
import { GasLeakSensorHandler, WaterLeakSensorHandler } from './basic_sensors/leak';
import { LightSensorHandler } from './basic_sensors/light';
import { MovingSensorHandler } from './basic_sensors/moving';
import { OccupancySensorHandler } from './basic_sensors/occupancy';
import { PresenceSensorHandler } from './basic_sensors/presence';
import { SmokeSensorHandler } from './basic_sensors/smoke';
import { TemperatureSensorHandler } from './basic_sensors/temperature';
import { VibrationSensorHandler } from './basic_sensors/vibration';
import { BasicAccessory, ConverterConfigurationRegistry, ServiceCreator, ServiceHandler } from './interfaces';

type ExposeToHandlerFunction = (expose: ExposesEntryWithProperty) => ServiceHandler;

interface BasicSensorConstructor {
  new (expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory);
}

declare type WithBasicSensorProperties<T> = T & {
  exposesName: string;
  fallbackExposesNames?: string[];
  exposesType: ExposesKnownTypes;
  generateIdentifier: IdentifierGenerator;
};

declare type WithConfigurableConverter<T> = T & {
  converterConfigTag: string;
  isValidConverterConfiguration(config: unknown, tag: string, logger: BasicLogger | undefined): boolean;
};

export class BasicSensorCreator implements ServiceCreator {
  private static handlers: WithBasicSensorProperties<BasicSensorConstructor>[] = [
    HumiditySensorHandler,
    TemperatureSensorHandler,
    LightSensorHandler,
    AirPressureSensorHandler,
    ContactSensorHandler,
    OccupancySensorHandler,
    PresenceSensorHandler,
    VibrationSensorHandler,
    MovingSensorHandler,
    SmokeSensorHandler,
    CarbonMonoxideSensorHandler,
    WaterLeakSensorHandler,
    GasLeakSensorHandler,
    DeviceTemperatureSensorHandler,
    CarbonDioxideSensorHandler,
  ];

  private static configs: WithConfigurableConverter<unknown>[] = [
    OccupancySensorHandler,
    TemperatureSensorHandler,
    HumiditySensorHandler,
    AirPressureSensorHandler,
    ContactSensorHandler,
    MovingSensorHandler,
    PresenceSensorHandler,
  ];

  constructor(converterConfigRegistry: ConverterConfigurationRegistry) {
    for (const config of BasicSensorCreator.configs) {
      converterConfigRegistry.registerConverterConfiguration(config.converterConfigTag, config.isValidConverterConfiguration);
    }
  }

  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    const endpointMap = groupByEndpoint(
      exposes.filter((e) => exposesHasProperty(e) && exposesIsPublished(e)).map((e) => e as ExposesEntryWithProperty)
    );

    endpointMap.forEach((value, key) => {
      const optionalProperties = value
        .filter((e) => exposesHasBinaryProperty(e) && (e.name === 'battery_low' || e.name === 'tamper'))
        .map((e) => e as ExposesEntryWithBinaryProperty);
      BasicSensorCreator.handlers.forEach((h) => {
        const possibleNames = [h.exposesName, ...(h.fallbackExposesNames ?? [])];
        let values: ExposesEntryWithProperty[] = [];
        for (const name of possibleNames) {
          values = value.filter((e) => e.name === name && e.type === h.exposesType);
          if (values.length > 0) {
            break;
          }
        }

        if (values.length > 0 && !accessory.isServiceHandlerIdKnown(h.generateIdentifier(key, accessory))) {
          for (const e of values) {
            this.createService(accessory, e, (x) => new h(x, optionalProperties, accessory));
          }
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
