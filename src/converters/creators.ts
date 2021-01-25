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

export interface ServiceCreatorManager {
   createHomeKitEntitiesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]) : void;
}

interface ServiceCreatorConstructor {
  new():ServiceCreator;
}

export class BasicServiceCreatorManager implements ServiceCreatorManager {
  private static readonly constructors : ServiceCreatorConstructor[] = [
    LightCreator,
    SwitchCreator,
    CoverCreator,
    LockCreator,
    BasicSensorCreator,
    StatelessProgrammableSwitchCreator,
    ThermostatCreator,
    BatteryCreator,
  ];

  private static instance : BasicServiceCreatorManager;

  private creators : ServiceCreator[];

  private constructor() {
    this.creators = BasicServiceCreatorManager.constructors.map(c => new c());
  }

  public static getInstance() : BasicServiceCreatorManager {
    if (BasicServiceCreatorManager.instance === undefined) {
      BasicServiceCreatorManager.instance = new BasicServiceCreatorManager();
    }
    return BasicServiceCreatorManager.instance;
  }

  createHomeKitEntitiesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    for (const c of this.creators) {
      c.createServicesFromExposes(accessory, exposes);
    }
  }
}