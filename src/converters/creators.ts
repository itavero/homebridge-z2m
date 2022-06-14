import { ExposesEntry } from '../z2mModels';
import { BasicAccessory, ServiceConfigurationRegistry, ServiceConfigurationValidator, ServiceCreator } from './interfaces';
import { BasicSensorCreator } from './basic_sensors';
import { BatteryCreator } from './battery';
import { CoverCreator } from './cover';
import { LightCreator } from './light';
import { LockCreator } from './lock';
import { SwitchCreator } from './switch';
import { StatelessProgrammableSwitchCreator } from './action';
import { ThermostatCreator } from './climate';
import { AirQualitySensorCreator } from './air_quality';
import { Logger } from 'homebridge';

export interface ServiceCreatorManager {
  createHomeKitEntitiesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void;
}

export interface ServiceConfigValidatorCollection {
  allServiceConfigurationsAreValid(configurations: object, logger: Logger | undefined): boolean;
}

interface ServiceCreatorConstructor {
  new(serviceConfigRegistry: ServiceConfigurationRegistry): ServiceCreator;
}

export class BasicServiceCreatorManager implements ServiceCreatorManager, ServiceConfigValidatorCollection, ServiceConfigurationRegistry {
  private static readonly constructors: ServiceCreatorConstructor[] = [
    LightCreator,
    SwitchCreator,
    CoverCreator,
    LockCreator,
    BasicSensorCreator,
    AirQualitySensorCreator,
    StatelessProgrammableSwitchCreator,
    ThermostatCreator,
    BatteryCreator,
  ];

  private static instance: BasicServiceCreatorManager;

  private creators: ServiceCreator[];

  private serviceConfigs: Map<string, ServiceConfigurationValidator>;

  private constructor() {
    this.serviceConfigs = new Map();
    this.creators = BasicServiceCreatorManager.constructors.map(c => new c(this));
  }

  allServiceConfigurationsAreValid(configurations: object, logger: Logger | undefined): boolean {
    for (const key of Object.keys(configurations)) {
      const validator = this.serviceConfigs.get(key);
      if (validator !== undefined) {
        if (!validator.isValidServiceConfiguration(key, configurations[key], logger)) {
          logger?.error(`Service configuration "${key}" is not valid. Contents: ${JSON.stringify(configurations[key])}`);
          return false;
        }
      } else {
        logger?.error(`Unknown service configuration tag detected: ${key} Contents: ${JSON.stringify(configurations[key])}`);
        return false;
      }
    }

    return true;
  }

  registerServiceConfiguration(tag: string, validator: ServiceConfigurationValidator): void {
    tag = tag.trim().toLocaleLowerCase();
    if (this.serviceConfigs.has(tag)) {
      throw new Error(`Duplicate service configuration tag detected: ${tag}`);
    }
    this.serviceConfigs.set(tag, validator);
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