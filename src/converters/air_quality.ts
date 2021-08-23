import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet, ExposesEntry, ExposesEntryWithProperty, exposesHasNumericProperty, exposesHasProperty, exposesIsPublished,
} from '../z2mModels';
import { hap } from '../hap';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../helpers';
import { Characteristic, CharacteristicValue, Service, WithUUID } from 'homebridge';

export class AirQualitySensorCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    const endpointMap = new Map<string | undefined, ExposesEntryWithProperty[]>();
    exposes.filter(e =>
      exposesHasProperty(e) && exposesIsPublished(e) && !accessory.isPropertyExcluded(e.property) &&
      AirQualitySensorHandler.propertyFactories.find((f) => f.canUseExposesEntry(e)) !== undefined,
    ).map(e => e as ExposesEntryWithProperty).forEach((item) => {
      const collection = endpointMap.get(item.endpoint);
      if (!collection) {
        endpointMap.set(item.endpoint, [item]);
      } else {
        collection.push(item);
      }
    });
    endpointMap.forEach((value, key) => {
      if (!accessory.isServiceHandlerIdKnown(AirQualitySensorHandler.generateIdentifier(key))) {
        this.createService(key, value, accessory);
      }
    });
  }

  private createService(endpoint: string | undefined, exposes: ExposesEntryWithProperty[], accessory: BasicAccessory): void {
    try {
      const handler = new AirQualitySensorHandler(endpoint, exposes, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn('Failed to setup Air Quality Sensor service ' +
        `for accessory ${accessory.displayName} for endpoint ${endpoint}: ${error}`);
    }
  }
}

export declare type WithExposesValidator<T> = T & {
  canUseExposesEntry(entry: ExposesEntry): boolean;
};

interface AirQualityProperty {
  readonly expose: ExposesEntryWithProperty;
  readonly latestAirQuality: number;
  updateState(state: Record<string, unknown>): void;
}

abstract class PassthroughAirQualityProperty implements AirQualityProperty {
  public latestAirQuality: number;

  constructor(public expose: ExposesEntryWithProperty, protected service: Service,
    protected characteristic: WithUUID<{ new(): Characteristic }>) {
    this.latestAirQuality = hap.Characteristic.AirQuality.UNKNOWN;
    const c = getOrAddCharacteristic(service, characteristic);
    copyExposesRangeToCharacteristic(expose, c);
  }

  updateState(state: Record<string, unknown>): void {
    if (this.expose.property in state) {
      const sensorValue = state[this.expose.property] as CharacteristicValue;
      if (sensorValue !== null && sensorValue !== undefined) {
        this.service.updateCharacteristic(this.characteristic, sensorValue);
        this.latestAirQuality = this.convertToAirQuality(sensorValue) ?? hap.Characteristic.AirQuality.UNKNOWN;
      }
    }
  }

  abstract convertToAirQuality(sensorValue: CharacteristicValue): number | undefined;
}

class VolatileOrganicCompoundsProperty extends PassthroughAirQualityProperty {
  private static readonly NAME = 'voc';
  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasNumericProperty(entry) && entry.name === VolatileOrganicCompoundsProperty.NAME;
  }

  constructor(expose: ExposesEntryWithProperty, service: Service) {
    super(expose, service, hap.Characteristic.VOCDensity);
  }

  convertToAirQuality(sensorValue: CharacteristicValue): number | undefined {
    if (sensorValue <= 333) {
      return hap.Characteristic.AirQuality.EXCELLENT;
    }

    if (sensorValue <= 1000) {
      return hap.Characteristic.AirQuality.GOOD;
    }

    if (sensorValue <= 3333) {
      return hap.Characteristic.AirQuality.FAIR;
    }

    if (sensorValue <= 8332) {
      return hap.Characteristic.AirQuality.INFERIOR;
    }

    return hap.Characteristic.AirQuality.POOR;
  }
}

class ParticulateMatter10Property extends PassthroughAirQualityProperty {
  private static readonly NAME = 'pm10';
  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasNumericProperty(entry) && entry.name === ParticulateMatter10Property.NAME;
  }

  constructor(expose: ExposesEntryWithProperty, service: Service) {
    super(expose, service, hap.Characteristic.PM10Density);
  }

  convertToAirQuality(sensorValue: CharacteristicValue): number | undefined {
    if (sensorValue <= 25) {
      return hap.Characteristic.AirQuality.EXCELLENT;
    }

    if (sensorValue <= 50) {
      return hap.Characteristic.AirQuality.GOOD;
    }

    if (sensorValue <= 100) {
      return hap.Characteristic.AirQuality.FAIR;
    }

    if (sensorValue <= 300) {
      return hap.Characteristic.AirQuality.INFERIOR;
    }

    return hap.Characteristic.AirQuality.POOR;
  }
}

class ParticulateMatter2_5Property extends PassthroughAirQualityProperty {
  private static readonly NAME = 'pm25';
  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasNumericProperty(entry) && entry.name === ParticulateMatter2_5Property.NAME;
  }

  constructor(expose: ExposesEntryWithProperty, service: Service) {
    super(expose, service, hap.Characteristic.PM10Density);
  }

  convertToAirQuality(sensorValue: CharacteristicValue): number | undefined {
    if (sensorValue <= 15) {
      return hap.Characteristic.AirQuality.EXCELLENT;
    }

    if (sensorValue <= 35) {
      return hap.Characteristic.AirQuality.GOOD;
    }

    if (sensorValue <= 55) {
      return hap.Characteristic.AirQuality.FAIR;
    }

    if (sensorValue <= 75) {
      return hap.Characteristic.AirQuality.INFERIOR;
    }

    return hap.Characteristic.AirQuality.POOR;
  }
}

class AirQualitySensorHandler implements ServiceHandler {
  public static readonly propertyFactories:
    WithExposesValidator<{ new(expose: ExposesEntryWithProperty, service: Service): AirQualityProperty }>[] = [
      VolatileOrganicCompoundsProperty,
      ParticulateMatter10Property,
      ParticulateMatter2_5Property,
    ];

  private readonly properties: AirQualityProperty[] = [];
  private readonly service: Service;

  constructor(endpoint: string | undefined, exposes: ExposesEntryWithProperty[], private readonly accessory: BasicAccessory) {
    this.identifier = AirQualitySensorHandler.generateIdentifier(endpoint);

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);
    accessory.log.debug(`Configuring Air Quality Sensor for ${serviceName}`);
    this.service = accessory.getOrAddService(new hap.Service.AirQualitySensor(serviceName, endpoint));
    getOrAddCharacteristic(this.service, hap.Characteristic.AirQuality);

    for (const e of exposes) {
      const factory = AirQualitySensorHandler.propertyFactories.find((f) => f.canUseExposesEntry(e));
      if (factory === undefined) {
        accessory.log.warn(`Air Quality Sensor does not know how to handle ${e.property} (on ${serviceName})`);
        continue;
      }
      this.properties.push(new factory(e, this.service));
    }

    if (this.properties.length === 0) {
      throw new Error(`Air Quality Sensor (${serviceName}) did not receive any suitable exposes entries.`);
    }
  }

  identifier: string;
  get getableKeys(): string[] {
    const keys: string[] = [];
    for (const property of this.properties) {
      if (exposesCanBeGet(property.expose)) {
        keys.push(property.expose.property);
      }
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    let airQuality: CharacteristicValue = hap.Characteristic.AirQuality.UNKNOWN;
    for (const p of this.properties) {
      p.updateState(state);
      airQuality = AirQualitySensorHandler.getWorstAirQuality(airQuality, p.latestAirQuality);
    }
    this.service.updateCharacteristic(hap.Characteristic.AirQuality, airQuality);
  }

  static getWorstAirQuality(a: number, b: number): number {
    return (a > b) ? a : b;
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.AirQualitySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}