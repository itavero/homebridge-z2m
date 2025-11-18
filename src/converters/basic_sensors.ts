import { BasicAccessory, ConverterConfigurationRegistry, ServiceCreator, ServiceHandler } from './interfaces';
import {
  ExposesEntry,
  ExposesEntryWithBinaryProperty,
  ExposesEntryWithProperty,
  exposesHasBinaryProperty,
  exposesHasProperty,
  exposesIsPublished,
  ExposesKnownTypes,
} from '../z2mModels';
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
import { MovingSensorHandler } from './basic_sensors/moving';
import { PresenceSensorHandler } from './basic_sensors/presence';
import { OccupancySensorHandler } from './basic_sensors/occupancy';
import { IdentifierGenerator } from './basic_sensors/basic';
import { DeviceTemperatureSensorHandler } from './basic_sensors/device_temperature';
import { CarbonDioxideSensorHandler } from './basic_sensors/carbon_dioxide';
import { SoilMoistureSensorHandler } from './basic_sensors/soil_moisture';
import { DrySensorHandler } from './basic_sensors/dry';
import { BasicLogger } from '../logger';

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
    SoilMoistureSensorHandler,
    DrySensorHandler,
  ];

  private static configs: WithConfigurableConverter<unknown>[] = [OccupancySensorHandler];

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
          values = value.filter((e) => {
            if (e.name === name && e.type === h.exposesType) {
              // For binary types, ensure we have the required binary properties
              if (h.exposesType === ExposesKnownTypes.BINARY) {
                return exposesHasBinaryProperty(e);
              }
              return true;
            }
            return false;
          });
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
