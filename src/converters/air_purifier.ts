import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet,
  ExposesEntry,
  ExposesEntryWithProperty,
  exposesHasNumericProperty,
  exposesHasProperty,
  exposesIsPublished,
} from '../z2mModels';
import { hap } from '../hap';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic, groupByEndpoint } from '../helpers';
import { Characteristic, CharacteristicValue, Service, WithUUID } from 'homebridge';

export class AirPurifierCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    const endpointMap = groupByEndpoint(
      exposes
        .filter(
          (e) =>
            exposesHasProperty(e) &&
            exposesIsPublished(e) &&
            AirPurifierHandler.propertyFactories.find((f) => f.canUseExposesEntry(e)) !== undefined
        )
        .map((e) => e as ExposesEntryWithProperty)
    );
    endpointMap.forEach((value, key) => {
      if (!accessory.isServiceHandlerIdKnown(AirPurifierHandler.generateIdentifier(key))) {
        this.createService(key, value, accessory);
      }
    });
  }

  private createService(endpoint: string | undefined, exposes: ExposesEntryWithProperty[], accessory: BasicAccessory): void {
    try {
      const handler = new AirPurifierHandler(endpoint, exposes, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(
        'Failed to setup Air Purifier service ' + `for accessory ${accessory.displayName} for endpoint ${endpoint}: ${error}`
      );
    }
  }
}

export declare type WithExposesValidator<T> = T & {
  canUseExposesEntry(entry: ExposesEntry): boolean;
};

interface AirPurifierProperty {
  readonly expose: ExposesEntryWithProperty;
  readonly state: number;
  updateState(state: Record<string, unknown>): void;
}

abstract class PassthroughAirPurifierProperty implements AirPurifierProperty {
  public state: number;

  constructor(
    public expose: ExposesEntryWithProperty,
    protected accessory: BasicAccessory,
    protected service: Service,
    protected characteristic: WithUUID<new () => Characteristic>
  ) {
    this.state = 0;
    const c = getOrAddCharacteristic(service, characteristic);
    c.on('set', this.handleSetOn.bind(this));
    copyExposesRangeToCharacteristic(expose, c);
  }

  updateState(state: Record<string, unknown>): void {
    if (this.expose.property in state) {
      const sensorValue = state[this.expose.property] as CharacteristicValue;
      if (sensorValue !== null && sensorValue !== undefined) {
        this.service.updateCharacteristic(this.characteristic, sensorValue);
        this.state = this.convertToAirPurifier(sensorValue) ?? 0;
      }
    }
  }

  abstract convertToAirPurifier(sensorValue: CharacteristicValue): number | undefined;

  abstract handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
}

class CurrentAirPurifierStateProperty extends PassthroughAirPurifierProperty {
  private static readonly NAME = 'fan_state';

  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasNumericProperty(entry) && entry.name === CurrentAirPurifierStateProperty.NAME;
  }

  constructor(expose: ExposesEntryWithProperty, service: Service) {
    super(expose, service, hap.Characteristic.CurrentAirPurifierState);
  }

  convertToAirPurifier(sensorValue: CharacteristicValue): number | undefined {
    if (sensorValue === 'ON') {
      return hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
    }
    if (sensorValue === 'OFF') {
      return hap.Characteristic.CurrentAirPurifierState.IDLE;
    }

    return hap.Characteristic.CurrentAirPurifierState.INACTIVE;
  }

  handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data['fan_state'] = (value as boolean) ? 'ON' : 'OFF';
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }
}

class TargetAirPurifierStateProperty extends PassthroughAirPurifierProperty {
  private static readonly NAME = 'fan_mode';

  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasNumericProperty(entry) && entry.name === TargetAirPurifierStateProperty.NAME;
  }

  constructor(expose: ExposesEntryWithProperty, service: Service) {
    super(expose, service, hap.Characteristic.TargetAirPurifierState);
  }

  convertToAirPurifier(sensorValue: CharacteristicValue): number | undefined {
    if (sensorValue === 'auto') {
      return hap.Characteristic.TargetAirPurifierState.AUTO;
    }

    return hap.Characteristic.TargetAirPurifierState.MANUAL;
  }

  handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data['fan_mode'] = (value as boolean) ? 'auto' : 'off';
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }
}

class RotationSpeedProperty extends PassthroughAirPurifierProperty {
  private static readonly NAME = 'fan_speed';

  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasNumericProperty(entry) && entry.name === RotationSpeedProperty.NAME;
  }

  constructor(expose: ExposesEntryWithProperty, service: Service) {
    super(expose, service, hap.Characteristic.RotationSpeed);
  }

  convertToAirPurifier(sensorValue: CharacteristicValue): number | undefined {
    if (typeof sensorValue !== 'number') {
      return 0;
    }

    return Math.ceil(sensorValue * 11.11);
  }

  handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    const speed = Math.floor((value as boolean) / 11.11);
    if (speed > 0) {
      data['fan_mode'] = speed;
    } else {
      data['fan_mode'] = 'off';
    }
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }
}

class LockPhysicalControlsProperty extends PassthroughAirPurifierProperty {
  private static readonly NAME = 'child_lock';

  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasNumericProperty(entry) && entry.name === LockPhysicalControlsProperty.NAME;
  }

  constructor(expose: ExposesEntryWithProperty, service: Service) {
    super(expose, service, hap.Characteristic.LockPhysicalControls);
  }

  convertToAirPurifier(sensorValue: CharacteristicValue): number | undefined {
    if (typeof sensorValue === 'undefined' || sensorValue === null) {
      return Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
    }

    return Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED;
  }

  handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data['child_lock'] = (value as boolean) ? 'LOCK' : 'UNLOCK';
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }
}

class AirPurifierHandler implements ServiceHandler {
  public static readonly propertyFactories: WithExposesValidator<
    new (expose: ExposesEntryWithProperty, service: Service) => AirPurifierProperty
  >[] = [CurrentAirPurifierStateProperty, TargetAirPurifierStateProperty, RotationSpeedProperty, LockPhysicalControlsProperty];

  private readonly properties: AirPurifierProperty[] = [];
  private readonly service: Service;

  public mainCharacteristics: Characteristic[] = [];

  constructor(
    endpoint: string | undefined,
    exposes: ExposesEntryWithProperty[],
    private readonly accessory: BasicAccessory
  ) {
    this.identifier = AirPurifierHandler.generateIdentifier(endpoint);

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);
    accessory.log.debug(`Configuring Air Purifier for ${serviceName}`);
    this.service = accessory.getOrAddService(new hap.Service.AirPurifier(serviceName, endpoint));
    this.mainCharacteristics.push(getOrAddCharacteristic(this.service, hap.Characteristic.AirPurifier));

    for (const e of exposes) {
      const factory = AirPurifierHandler.propertyFactories.find((f) => f.canUseExposesEntry(e));
      if (factory === undefined) {
        accessory.log.warn(`Air Purifier does not know how to handle ${e.property} (on ${serviceName})`);
        continue;
      }
      this.properties.push(new factory(e, accessory, this.service));
    }

    if (this.properties.length === 0) {
      throw new Error(`Air Purifier (${serviceName}) did not receive any suitable exposes entries.`);
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
    for (const p of this.properties) {
      p.updateState(state);
    }
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.AirPurifier.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
