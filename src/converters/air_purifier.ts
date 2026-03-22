import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet,
  ExposesEntry,
  ExposesEntryWithProperty,
  exposesHasFeatures,
  exposesHasNumericProperty,
  exposesHasProperty,
  exposesIsPublished,
  ExposesKnownTypes,
} from '../z2mModels';
import { hap } from '../hap';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic, groupByEndpoint } from '../helpers';
import { Characteristic, CharacteristicSetCallback, CharacteristicValue, Service, WithUUID } from 'homebridge';

export class AirPurifierCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    // Collect matching properties from both top-level entries and features inside "fan" type exposes
    const candidates: ExposesEntryWithProperty[] = [];
    for (const e of exposes) {
      if (exposesHasFeatures(e) && e.type === ExposesKnownTypes.FAN) {
        // Extract features from fan parent expose (fan_state, fan_mode are nested here)
        for (const f of e.features) {
          if (
            exposesHasProperty(f) &&
            exposesIsPublished(f) &&
            AirPurifierHandler.propertyFactories.find((pf) => pf.canUseExposesEntry(f)) !== undefined
          ) {
            candidates.push(f as ExposesEntryWithProperty);
          }
        }
      } else if (
        exposesHasProperty(e) &&
        exposesIsPublished(e) &&
        AirPurifierHandler.propertyFactories.find((f) => f.canUseExposesEntry(e)) !== undefined
      ) {
        candidates.push(e as ExposesEntryWithProperty);
      }
    }

    const endpointMap = groupByEndpoint(candidates);
    endpointMap.forEach((value, key) => {
      // Only create an Air Purifier service if at least one fan-specific property is present;
      // child_lock alone is too generic (appears on plugs, thermostats, etc.)
      const hasFanProperty = value.some((e) => e.property === 'fan_state' || e.property === 'fan_mode' || e.property === 'fan_speed');
      if (hasFanProperty && !accessory.isServiceHandlerIdKnown(AirPurifierHandler.generateIdentifier(key))) {
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
        this.state = this.convertToAirPurifier(sensorValue) ?? 0;
        this.service.updateCharacteristic(this.characteristic, this.state);
      }
    }
  }

  abstract convertToAirPurifier(sensorValue: CharacteristicValue): number | undefined;

  abstract handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
}

class FanStateProperty implements AirPurifierProperty {
  private static readonly PROPERTY = 'fan_state';
  public state: number;

  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasProperty(entry) && entry.property === FanStateProperty.PROPERTY;
  }

  constructor(
    public expose: ExposesEntryWithProperty,
    private accessory: BasicAccessory,
    private service: Service
  ) {
    this.state = 0;
    const c = getOrAddCharacteristic(service, hap.Characteristic.Active);
    c.on('set', this.handleSetActive.bind(this));
  }

  updateState(state: Record<string, unknown>): void {
    if (this.expose.property in state) {
      const sensorValue = state[this.expose.property] as CharacteristicValue;
      this.accessory.log.info(`Air Purifier: fan_state update received: ${JSON.stringify(sensorValue)}`);
      if (sensorValue !== null && sensorValue !== undefined) {
        const isOn = sensorValue === 'ON';
        this.service.updateCharacteristic(
          hap.Characteristic.Active,
          isOn ? hap.Characteristic.Active.ACTIVE : hap.Characteristic.Active.INACTIVE
        );
        if (isOn) {
          this.state = hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
        } else {
          this.state = hap.Characteristic.CurrentAirPurifierState.INACTIVE;
        }
        this.service.updateCharacteristic(hap.Characteristic.CurrentAirPurifierState, this.state);
      }
    }
  }

  private handleSetActive(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    if (value) {
      // Only send a command when actually turning on from off.
      // If already on (e.g. mode switch), other handlers manage fan_mode.
      const currentActive = this.service.getCharacteristic(hap.Characteristic.Active)?.value;
      if (currentActive === hap.Characteristic.Active.ACTIVE) {
        callback(null);
        return;
      }
      // Resume at current speed; fan_state:'ON' forces auto mode so avoid it.
      const currentPct = this.service.getCharacteristic(hap.Characteristic.RotationSpeed)?.value as number | undefined;
      if (currentPct !== undefined && currentPct > 0) {
        const speed = Math.max(1, Math.round((currentPct / 100) * 9));
        data['fan_mode'] = speed.toString();
      } else {
        data['fan_mode'] = 'auto';
      }
    } else {
      data['fan_mode'] = 'off';
    }
    this.accessory.log.info(`Air Purifier: Setting active to ${value ? 'ON' : 'OFF'} (${JSON.stringify(data)})`);
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }
}

class TargetAirPurifierStateProperty extends PassthroughAirPurifierProperty {
  private static readonly PROPERTY = 'fan_mode';

  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasProperty(entry) && entry.property === TargetAirPurifierStateProperty.PROPERTY;
  }

  constructor(expose: ExposesEntryWithProperty, accessory: BasicAccessory, service: Service) {
    super(expose, accessory, service, hap.Characteristic.TargetAirPurifierState);
  }

  convertToAirPurifier(sensorValue: CharacteristicValue): number | undefined {
    if (sensorValue === 'auto') {
      return hap.Characteristic.TargetAirPurifierState.AUTO;
    }

    return hap.Characteristic.TargetAirPurifierState.MANUAL;
  }

  updateState(state: Record<string, unknown>): void {
    super.updateState(state);
    // When fan_mode is 'off', also set Active to INACTIVE.
    // Don't set ACTIVE here — let FanStateProperty handle that from fan_state,
    // since the device may report a non-off fan_mode (e.g. '5') even when off.
    if (this.expose.property in state) {
      const sensorValue = state[this.expose.property] as CharacteristicValue;
      if (sensorValue === 'off') {
        this.service.updateCharacteristic(hap.Characteristic.Active, hap.Characteristic.Active.INACTIVE);
        this.service.updateCharacteristic(hap.Characteristic.CurrentAirPurifierState, hap.Characteristic.CurrentAirPurifierState.INACTIVE);
      }
    }
  }

  handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (value) {
      const data = {};
      data['fan_mode'] = 'auto';
      this.accessory.log.info('Air Purifier: Setting target state to Auto (fan_mode: auto)');
      this.accessory.queueDataForSetAction(data);
    } else {
      this.accessory.log.info('Air Purifier: Setting target state to Manual (speed set via RotationSpeed)');
    }
    callback(null);
  }
}

class RotationSpeedProperty implements AirPurifierProperty {
  private static readonly PROPERTY = 'fan_speed';
  public state: number;
  private readonly inputMin: number;
  private readonly inputMax: number;

  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasNumericProperty(entry) && entry.property === RotationSpeedProperty.PROPERTY;
  }

  constructor(
    public expose: ExposesEntryWithProperty,
    private accessory: BasicAccessory,
    private service: Service
  ) {
    this.state = 0;
    this.inputMin = expose.value_min ?? 0;
    this.inputMax = expose.value_max ?? 9;
    // Don't call copyExposesRangeToCharacteristic — keep default 0-100 range.
    // Scale between device range and HomeKit percentage, like Brightness does.
    const c = getOrAddCharacteristic(service, hap.Characteristic.RotationSpeed);
    c.setProps({ minValue: 0, maxValue: 100, minStep: 1 });
    c.on('set', this.handleSetSpeed.bind(this));
  }

  updateState(state: Record<string, unknown>): void {
    if (this.expose.property in state) {
      const sensorValue = state[this.expose.property] as CharacteristicValue;
      if (sensorValue !== null && sensorValue !== undefined && typeof sensorValue === 'number') {
        // Scale device range to HomeKit 0-100
        if (sensorValue <= this.inputMin) {
          this.state = 0;
        } else if (sensorValue >= this.inputMax) {
          this.state = 100;
        } else {
          this.state = Math.round(((sensorValue - this.inputMin) / (this.inputMax - this.inputMin)) * 100);
        }
        this.service.updateCharacteristic(hap.Characteristic.RotationSpeed, this.state);
      }
    }
  }

  private handleSetSpeed(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    // Scale HomeKit 0-100 to device range, send via fan_mode (fan_speed is read-only)
    const pct = value as number;
    let speed: number;
    if (pct <= 0) {
      speed = this.inputMin;
    } else if (pct >= 100) {
      speed = this.inputMax;
    } else {
      speed = Math.round(this.inputMin + (pct / 100) * (this.inputMax - this.inputMin));
    }
    speed = Math.max(1, speed);
    data['fan_mode'] = speed.toString();
    this.accessory.log.info(`Air Purifier: Setting rotation speed: ${pct}% → fan_mode: '${speed}'`);
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }
}

class LockPhysicalControlsProperty extends PassthroughAirPurifierProperty {
  private static readonly PROPERTY = 'child_lock';

  static canUseExposesEntry(entry: ExposesEntry): boolean {
    return exposesHasProperty(entry) && entry.property === LockPhysicalControlsProperty.PROPERTY;
  }

  constructor(expose: ExposesEntryWithProperty, accessory: BasicAccessory, service: Service) {
    super(expose, accessory, service, hap.Characteristic.LockPhysicalControls);
  }

  convertToAirPurifier(sensorValue: CharacteristicValue): number | undefined {
    if (typeof sensorValue === 'undefined' || sensorValue === null || sensorValue === 'UNLOCK') {
      return hap.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
    }

    return hap.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED;
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
    new (expose: ExposesEntryWithProperty, accessory: BasicAccessory, service: Service) => AirPurifierProperty
  >[] = [FanStateProperty, TargetAirPurifierStateProperty, RotationSpeedProperty, LockPhysicalControlsProperty];

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
    this.mainCharacteristics.push(getOrAddCharacteristic(this.service, hap.Characteristic.CurrentAirPurifierState));

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
