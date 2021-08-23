import { ExposesEntry } from '../z2mModels';
import { BasicAccessory, ServiceCreator } from './interfaces';
import { BasicSensorCreator } from './basic_sensors';
import { BatteryCreator } from './battery';
import { CoverCreator } from './cover';
import { LightCreator } from './light';
import { LockCreator } from './lock';
import { SwitchCreator } from './switch';
import { StatelessProgrammableSwitchCreator } from './action';
import { ThermostatCreator } from './climate';
import { AirQualitySensorCreator } from './air_quality';

export interface ServiceCreatorManager {
  createHomeKitEntitiesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void;
}

interface ServiceCreatorConstructor {
  new(): ServiceCreator;
}

export class BasicServiceCreatorManager implements ServiceCreatorManager {
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

  private constructor() {
    this.creators = BasicServiceCreatorManager.constructors.map(c => new c());
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