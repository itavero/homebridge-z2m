import { ExposesEntry } from '../z2mModels';
import { BasicAccessory, ConverterConfigurationRegistry, ServiceCreator } from './interfaces';
import { BasicLogger } from '../logger';
import { BasicSensorCreator } from './basic_sensors';
import { BatteryCreator } from './battery';
import { CoverCreator } from './cover';
import { LightCreator } from './light';
import { LockCreator } from './lock';
import { SwitchCreator } from './switch';
import { StatelessProgrammableSwitchCreator } from './action';
import { ThermostatCreator } from './climate';
import { AirQualitySensorCreator } from './air_quality';
import { AirPurifierCreator } from './air_purifier';

export interface ServiceCreatorManager {
  createHomeKitEntitiesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void;
}

export interface ConverterConfigValidatorCollection {
  allConverterConfigurationsAreValid(configurations: object, logger: BasicLogger | undefined): boolean;
}

type ServiceCreatorConstructor = new (converterConfigRegistry: ConverterConfigurationRegistry) => ServiceCreator;

export class BasicServiceCreatorManager
  implements ServiceCreatorManager, ConverterConfigValidatorCollection, ConverterConfigurationRegistry
{
  private static readonly constructors: ServiceCreatorConstructor[] = [
    LightCreator,
    SwitchCreator,
    CoverCreator,
    LockCreator,
    BasicSensorCreator,
    AirQualitySensorCreator,
    AirPurifierCreator,
    StatelessProgrammableSwitchCreator,
    ThermostatCreator,
    BatteryCreator,
  ];

  private static instance: BasicServiceCreatorManager;

  private creators: ServiceCreator[];

  private converterConfigs: Map<string, (config: unknown, tag: string, logger: BasicLogger | undefined) => boolean>;

  private constructor() {
    this.converterConfigs = new Map();
    this.creators = BasicServiceCreatorManager.constructors.map((c) => new c(this));
  }

  allConverterConfigurationsAreValid(configurations: object, logger: BasicLogger | undefined): boolean {
    for (const key of Object.keys(configurations)) {
      const validator = this.converterConfigs.get(key);
      if (validator !== undefined) {
        if (!validator(configurations[key], key, logger)) {
          logger?.error(`Converter configuration "${key}" is not valid. Contents: ${JSON.stringify(configurations[key])}`);
          return false;
        }
      } else {
        logger?.error(`Unknown converter configuration tag detected: ${key} Contents: ${JSON.stringify(configurations[key])}`);
        return false;
      }
    }

    return true;
  }

  registerConverterConfiguration(tag: string, validator: (config: unknown, tag: string, logger: BasicLogger | undefined) => boolean): void {
    tag = tag.trim().toLocaleLowerCase();
    if (this.converterConfigs.has(tag)) {
      throw new Error(`Duplicate converter configuration tag detected: ${tag}`);
    }
    this.converterConfigs.set(tag, validator);
  }

  public static getInstance(): BasicServiceCreatorManager {
    if (BasicServiceCreatorManager.instance === undefined) {
      BasicServiceCreatorManager.instance = new BasicServiceCreatorManager();
    }
    return BasicServiceCreatorManager.instance;
  }

  createHomeKitEntitiesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    for (const c of this.creators) {
      try {
        c.createServicesFromExposes(accessory, exposes);
      } catch (e) {
        accessory.log.error(`Exception occurred when creating services for ${accessory.displayName}: ${e}`);
      }
    }
  }
}
