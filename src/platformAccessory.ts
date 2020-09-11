import { Service, PlatformAccessory, WithUUID, Characteristic, CharacteristicValue, CharacteristicSetCallback, Logger } from 'homebridge';

import { Zigbee2mqttPlatform } from './platform';
import { Zigbee2mqttDeviceInfo } from './models';
import { ExtendedTimer } from './timer';
import { hap } from './hap';
import { CustomServices, ServiceFactory } from './customServices';

import * as color_convert from 'color-convert';

export class Zigbee2mqttAccessory {
  public static readonly IGNORED_STATE_KEYS: Set<string> = new Set<string>(
    ['last_seen', 'linkquality', 'voltage', 'smoke_density', 'illuminance', 'update_available']);

  private readonly services: ServiceWrapper[] = [];
  private readonly updateTimer: ExtendedTimer;

  private pendingPublishData: Record<string, unknown>;
  private publishIsScheduled: boolean;

  get log(): Logger {
    return this.platform.log;
  }

  constructor(
    private readonly platform: Zigbee2mqttPlatform,
    public readonly accessory: PlatformAccessory,
  ) {
    // Setup delayed publishing
    this.pendingPublishData = {};
    this.publishIsScheduled = false;

    this.updateDeviceInformation(accessory.context.device);

    // Recreate ServiceWrappers from restored services
    for (const srv of this.accessory.services) {
      const uuid = srv.getServiceId();

      switch (uuid) {
        case hap.Service.TemperatureSensor.UUID:
          this.createServiceForKey('temperature');
          break;
        case hap.Service.HumiditySensor.UUID:
          this.createServiceForKey('humidity');
          break;
        case hap.Service.ContactSensor.UUID:
          this.createServiceForKey('contact');
          break;
        case hap.Service.LightSensor.UUID:
          this.createServiceForKey('illuminance_lux');
          break;
        case hap.Service.OccupancySensor.UUID:
          this.createServiceForKey('occupancy');
          break;
        case hap.Service.SmokeSensor.UUID:
          this.createServiceForKey('smoke');
          break;
        case hap.Service.LeakSensor.UUID:
          this.createServiceForKey('water_leak');
          break;
        case hap.Service.CarbonMonoxideSensor.UUID:
          this.createServiceForKey('carbon_monoxide');
          break;
        case hap.Service.Lightbulb.UUID:
          this.createServiceForKey('brightness');
          break;
        case hap.Service.Switch.UUID:
          if (srv.subtype) {
            this.createServiceForKey('state_' + srv.subtype);
          } else {
            // Pass map with example value for state, to make sure that a Switch is created.
            const example = new Map<string, CharacteristicValue>();
            example.set('state', SwitchServiceWrapper.OFF);
            this.createServiceForKey('state', example);
          }
          break;
        case hap.Service.LockMechanism.UUID:
        {
          // Pass map with example value for state, to make sure that a Lock Mechanism is created.
          const example = new Map<string, CharacteristicValue>();
          example.set('state', LockMechanismServiceWrapper.UNLOCKED);
          this.createServiceForKey('state', example);
          break;
        }
        case hap.Service.WindowCovering.UUID:
          this.createServiceForKey('position');
          break;
        case hap.Service.BatteryService.UUID:
          this.createServiceForKey('battery');
          break;
        case CustomServices.AirPressureSensorUUID:
          this.createServiceForKey('pressure');
          break;
        default:
          //ignore this service.
          break;
      }
    }

    // Ask Zigbee2mqtt for a status update at least once an hour.
    this.updateTimer = new ExtendedTimer(() => {
      this.publishGet();
    }, (60 * 60 * 1000));

    // Immediately request an update to start off.
    this.publishGet();
  }

  get UUID(): string {
    return this.accessory.UUID;
  }

  get ieeeAddress(): string {
    return this.accessory.context.device.ieeeAddr;
  }

  matchesIdentifier(id: string): boolean {
    return (id === this.ieeeAddress || this.accessory.context.device.friendly_name === id);
  }

  updateDeviceInformation(info: Zigbee2mqttDeviceInfo) {
    this.accessory.context.device = info;

    let manufacturer: string = info.manufacturerName ?? 'zigbee2mqtt';
    if (info.vendor && info.vendor !== '-') {
      manufacturer = info.vendor;
    }

    this.accessory.getService(hap.Service.AccessoryInformation)!
      .updateCharacteristic(hap.Characteristic.Manufacturer, manufacturer)
      .updateCharacteristic(hap.Characteristic.Model, info.modelID ?? 'unknown')
      .updateCharacteristic(hap.Characteristic.SerialNumber, info.ieeeAddr)
      .updateCharacteristic(hap.Characteristic.HardwareRevision, info.hardwareVersion ?? '?')
      .updateCharacteristic(hap.Characteristic.FirmwareRevision, info.softwareBuildID ?? '?');

    this.platform.api.updatePlatformAccessories([this.accessory]);
  }

  updateStates(state: Record<string, unknown>) {
    // Restart timer
    this.updateTimer.restart();

    // Generate map
    const map = new Map<string, CharacteristicValue>();
    for (const key in state) {
      map.set(key, state[key] as CharacteristicValue);
    }

    this.handleServices(map);
  }

  private handleServices(state: Map<string, CharacteristicValue>) {
    const handledKeys = new Set<string>();

    // Iterate over existing services
    for (let i = this.services.length - 1; i >= 0; i--) {
      const srv = this.services[i];
      const keysUsed = this.callServiceWrapper(srv, state);

      if (keysUsed.size > 0) {
        keysUsed.forEach((key) => handledKeys.add(key));
      } else {
        // Get rid of old service (assumption: every update in MQTT contains all available fields)
        srv.remove(this.accessory);
        this.services.splice(i, 1);
      }
    }

    // Create new services for unhandled keys
    const unhandledKeys: Set<string> = new Set([...state.keys()]
      .filter(k => !handledKeys.has(k) && !Zigbee2mqttAccessory.IGNORED_STATE_KEYS.has(k)));
    const initialNumberOfUnhandledKeys = unhandledKeys.size;
    for (const key of unhandledKeys) {
      if (handledKeys.has(key)) {
        // might have been handled in the mean time by another service
        continue;
      }

      this.createServiceForKey(key, state, handledKeys);
    }

    if (initialNumberOfUnhandledKeys !== unhandledKeys.size) {
      // New services added
      // TODO: Figure out if this call is needed.
      this.platform.api.updatePlatformAccessories([this.accessory]);
    }

    const remainingKeys = [...unhandledKeys].filter(k => !handledKeys.has(k));
    if (remainingKeys.length > 0) {
      this.log.debug('Unhandled keys for accessory '.concat(this.accessory.context.device.friendly_name, ': ',
        remainingKeys.join(', ')));
    }
  }

  private createServiceForKey(key: string, state: Map<string, CharacteristicValue> | undefined = undefined,
    handledKeys: Set<string> | undefined = undefined) {
    // Create new service (if possible)
    switch (key) {
      case 'humidity':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('humidity',
          this.getOrAddService(hap.Service.HumiditySensor),
          hap.Characteristic.CurrentRelativeHumidity);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'temperature':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('temperature',
          this.getOrAddService(hap.Service.TemperatureSensor),
          hap.Characteristic.CurrentTemperature);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'illuminance_lux':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('illuminance_lux',
          this.getOrAddService(hap.Service.LightSensor),
          hap.Characteristic.CurrentAmbientLightLevel);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'pressure':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('pressure',
          this.getOrAddServiceById(CustomServices.AirPressureSensorUUID, CustomServices.AirPressureSensor),
          'Air Pressure');
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'contact':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('contact',
          this.getOrAddService(hap.Service.ContactSensor),
          hap.Characteristic.ContactSensorState,
          (key, value) => value as boolean
            ? hap.Characteristic.ContactSensorState.CONTACT_DETECTED
            : hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'occupancy':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('occupancy',
          this.getOrAddService(hap.Service.OccupancySensor),
          hap.Characteristic.OccupancyDetected,
          (key, value) => value as boolean
            ? hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
            : hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'smoke':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('smoke',
          this.getOrAddService(hap.Service.SmokeSensor),
          hap.Characteristic.SmokeDetected,
          (key, value) => value as boolean
            ? hap.Characteristic.SmokeDetected.SMOKE_DETECTED
            : hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'carbon_monoxide':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('carbon_monoxide',
          this.getOrAddService(hap.Service.CarbonMonoxideSensor),
          hap.Characteristic.CarbonMonoxideDetected,
          (key, value) => value as boolean
            ? hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL
            : hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'water_leak':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('water_leak',
          this.getOrAddService(hap.Service.LeakSensor),
          hap.Characteristic.LeakDetected,
          (key, value) => value as boolean
            ? hap.Characteristic.LeakDetected.LEAK_DETECTED
            : hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'battery':
      {
        const wrapper = new BatteryServiceWrapper(this.getOrAddService(hap.Service.BatteryService));
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'state':
      {
        let isLock = false;
        if (state) {
          const value = state.get(key);
          isLock = (value === LockMechanismServiceWrapper.LOCKED || value === LockMechanismServiceWrapper.UNLOCKED);
        }
        if (isLock) {
          const wrapper = new LockMechanismServiceWrapper(this.getOrAddService(hap.Service.LockMechanism),
            this.queuePublishData.bind(this));
          this.addService(wrapper, state, handledKeys);
        } else {
          const wrapper = new SwitchServiceWrapper(this.getOrAddService(hap.Service.Switch),
            this.queuePublishData.bind(this), key);
          this.addService(wrapper, state, handledKeys);
        }
        break;
      }
      case 'state_left':
      case 'state_right':
      case 'state_center':
      case 'state_top_left':
      case 'state_center_left':
      case 'state_bottom_left':
      case 'state_top_right':
      case 'state_center_right':
      case 'state_bottom_right':
      {
        const subType = SwitchServiceWrapper.getSubTypeFromKey(key);
        const wrapper = new SwitchServiceWrapper(this.getOrAddService(hap.Service.Switch, subType),
          this.queuePublishData.bind(this), key);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'brightness':
      case 'color_temp':
      case 'color':
      {
        if (state === undefined || state.has('state')) {
          // Only add a light bulb if the `state` is also available.
          this.removeOtherServicesUsingKey('state');
          const wrapper = new LightbulbServiceWrapper(this.getOrAddService(hap.Service.Lightbulb),
            this.queuePublishData.bind(this));
          this.addService(wrapper, state, handledKeys);
        }
        break;
      }
      case 'position':
      {
        const wrapper = new WindowCoveringServiceWrapper(this.getOrAddService(hap.Service.WindowCovering),
          this.queuePublishData.bind(this), this.publishGet.bind(this));
        this.addService(wrapper, state, handledKeys);
        break;
      }
      default:
        // All remaining unhandled keys will be logged a few lines down.
        break;
    }
  }

  private addService(srv: ServiceWrapper, state: Map<string, CharacteristicValue> | undefined, handledKeys: Set<string> | undefined) {
    this.log.debug(`Adding ${srv.displayName} to accessory ${this.accessory.displayName}.`);
    this.services.push(srv);
    let used_keys: Set<string> = new Set<string>();
    if (state !== undefined) {
      used_keys = this.callServiceWrapper(srv, state);
    }
    this.platform.api.updatePlatformAccessories([this.accessory]);

    if (handledKeys !== undefined) {
      // Add keys that have been handled by this service to the given set
      for (const key of used_keys) {
        handledKeys.add(key);
      }
    }
  }

  private removeOtherServicesUsingKey(key: string): void {
    for (let i = this.services.length - 1; i >= 0; i--) {
      const srv = this.services[i];

      if (srv.appliesToKey(key)) {
        this.log.debug(`Remove service ${srv.displayName} from ${this.accessory.displayName} (because it uses key '${key}').`);
        srv.remove(this.accessory);
        this.services.splice(i, 1);
      }
    }
  }

  private callServiceWrapper(srv: ServiceWrapper, state: Map<string, CharacteristicValue>): Set<string> {
    const handledKeys = new Set<string>();
    for (const key of state.keys()) {
      if (srv.appliesToKey(key)) {
        srv.updateValueForKey(key, state.get(key) as CharacteristicValue);
        handledKeys.add(key);
      }
    }
    return handledKeys;
  }

  private getOrAddServiceById(uuid: string, factory: ServiceFactory, subType?: string, name?: string): Service {
    let existingService: Service | undefined = undefined;

    if (subType) {
      existingService = this.accessory.getServiceById(uuid, subType);
    } else {
      existingService = this.accessory.services.find((srv) => srv.UUID === uuid);
    }

    if (existingService !== undefined) {
      return existingService;
    }

    if (!name) {
      name = this.accessory.displayName;
      if (subType) {
        name += ' ' + subType;
      }
    }

    return this.accessory.addService(factory(name, subType));
  }

  private getOrAddService<T extends WithUUID<typeof Service>>(service: T, subType?: string, name?: string): Service {
    const existingService = subType ? this.accessory.getServiceById(service, subType) : this.accessory.getService(service);
    if (existingService !== undefined) {
      return existingService;
    }

    if (!name) {
      name = this.accessory.displayName;
      if (subType) {
        name += ' ' + subType;
      }
    }

    return this.accessory.addService(service, name, subType);
  }

  private queuePublishData(data: Record<string, unknown>): void {
    this.pendingPublishData = { ...this.pendingPublishData, ...data };

    if (!this.publishIsScheduled) {
      this.publishIsScheduled = true;
      process.nextTick(() => {
        this.publishPendingData();
      });
    }
  }

  private publishPendingData() {
    this.publishIsScheduled = false;
    this.platform.publishMessage(`${this.accessory.context.device.ieeeAddr}/set`, JSON.stringify(this.pendingPublishData), { qos: 2 });
    this.pendingPublishData = {};
  }

  private publishGet(keys: string[] | undefined = undefined): void {
    const data = {};
    if (keys !== undefined) {
      for (const k of keys as string[]) {
        data[k] = '';
      }
    }

    // Publish using ieeeAddr, as that will never change and the friendly_name might.
    this.platform.publishMessage(`${this.accessory.context.device.ieeeAddr}/get`,
      (keys !== undefined && keys.length > 0) ? JSON.stringify(data) : '', { qos: 1 });
  }
}

export interface ServiceWrapper {
  readonly displayName: string;
  appliesToKey(key: string): boolean;
  updateValueForKey(key: string, value: unknown): void;
  remove(accessory: PlatformAccessory): void;
}

export interface MqttValueTransformer {
  (key: string, value: CharacteristicValue): CharacteristicValue;
}

export interface MqttSetPublisher {
  (data: Record<string, unknown>): void;
}

export interface MqttGetPublisher {
  (keys: string[] | undefined): void
}

export class SingleReadOnlyValueServiceWrapper implements ServiceWrapper {

  constructor(
    private readonly key: string,
    private readonly service: Service,
    private readonly characteristic: string | WithUUID<new () => Characteristic>,
    private readonly transformMqttValue: MqttValueTransformer | undefined = undefined,
  ) {
  }

  get displayName(): string {
    return `${this.key} (${this.service.UUID})`;
  }

  updateValueForKey(key: string, value: unknown): void {
    if (this.key === key) {
      if (this.transformMqttValue !== undefined) {
        value = this.transformMqttValue(key, value as CharacteristicValue);
      }
      this.service.updateCharacteristic(this.characteristic, value as CharacteristicValue);
    }
  }

  appliesToKey(key: string): boolean {
    return this.key === key;
  }

  remove(accessory: PlatformAccessory): void {
    accessory.removeService(this.service);
  }
}

export class BatteryServiceWrapper implements ServiceWrapper {
  constructor(
    private readonly service: Service) {
    this.service.updateCharacteristic(hap.Characteristic.ChargingState, hap.Characteristic.ChargingState.NOT_CHARGEABLE);
  }

  get displayName(): string {
    return 'BatteryService';
  }

  appliesToKey(key: string): boolean {
    return key === 'battery';
  }

  updateValueForKey(key: string, value: unknown): void {
    if (key === 'battery') {
      this.service.updateCharacteristic(hap.Characteristic.BatteryLevel, value as number);
      this.service.updateCharacteristic(hap.Characteristic.StatusLowBattery, (value as number < 30)
        ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }
  }

  remove(accessory: PlatformAccessory): void {
    accessory.removeService(this.service);
  }
}

export class WindowCoveringServiceWrapper implements ServiceWrapper {
  private currentPosition: number;
  private targetPosition: number;

  private readonly updateTimer: ExtendedTimer;

  constructor(
    private readonly service: Service, private readonly setPublisher: MqttSetPublisher,
    private readonly getPublisher: MqttGetPublisher) {
    this.currentPosition = -1;
    this.targetPosition = -1;

    this.updateTimer = new ExtendedTimer(this.requestPositionUpdate.bind(this), 2000);

    service.getCharacteristic(hap.Characteristic.TargetPosition)
      .on('set', this.setTargetPosition.bind(this));

    service.getCharacteristic(hap.Characteristic.PositionState)
      .setValue(hap.Characteristic.PositionState.STOPPED);
  }

  get displayName(): string {
    return 'WindowCovering';
  }

  private setTargetPosition(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.targetPosition = value as number;
    this.setPublisher({ position: this.targetPosition });

    // Assume state of cover
    if (this.targetPosition > this.currentPosition) {
      this.service.getCharacteristic(hap.Characteristic.PositionState)
        .setValue(hap.Characteristic.PositionState.INCREASING);
    } else if (this.targetPosition < this.currentPosition) {
      this.service.getCharacteristic(hap.Characteristic.PositionState)
        .setValue(hap.Characteristic.PositionState.DECREASING);
    }

    // Start requesting frequent updates.
    this.updateTimer.start();

    callback(null);
  }

  private requestPositionUpdate() {
    // Manually polling for the state, because that was needed with my Swedish blinds.
    this.getPublisher(['position']);
  }

  appliesToKey(key: string): boolean {
    return key === 'position';
  }

  updateValueForKey(key: string, value: unknown): void {
    if (key === 'position') {
      const newPosition = value as number;
      let state = hap.Characteristic.PositionState.STOPPED;
      if (this.currentPosition >= 0) {
        if (newPosition > this.currentPosition && newPosition < 100) {
          state = hap.Characteristic.PositionState.INCREASING;
        } else if (newPosition < this.currentPosition && newPosition > 0) {
          state = hap.Characteristic.PositionState.DECREASING;
        } else {
          // Stop requesting frequent updates
          this.updateTimer.stop();
        }
      }

      this.service.getCharacteristic(hap.Characteristic.PositionState)
        .updateValue(state);

      this.service.getCharacteristic(hap.Characteristic.CurrentPosition)
        .updateValue(newPosition);

      this.currentPosition = newPosition;
    }
  }

  remove(accessory: PlatformAccessory): void {
    accessory.removeService(this.service);
  }

}

export class LockMechanismServiceWrapper implements ServiceWrapper {
  static readonly LOCKED = 'LOCK';
  static readonly UNLOCKED = 'UNLOCK';

  private lockStateIsAvailable: boolean;

  constructor(
    private readonly service: Service, private readonly setPublisher: MqttSetPublisher) {
    this.lockStateIsAvailable = false;

    service.getCharacteristic(hap.Characteristic.LockTargetState)
      .on('set', this.setTargetState.bind(this));

    service.getCharacteristic(hap.Characteristic.LockCurrentState)
      .setValue(hap.Characteristic.LockCurrentState.UNKNOWN);
  }

  get displayName(): string {
    return 'LockMechanism';
  }

  private setTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const shouldBeLocked = (value as number) !== hap.Characteristic.LockTargetState.UNSECURED;
    this.setPublisher({ state: shouldBeLocked ? LockMechanismServiceWrapper.LOCKED : LockMechanismServiceWrapper.UNLOCKED });
    callback(null);
  }

  appliesToKey(key: string): boolean {
    return key === 'state' || key === 'lock_state';
  }

  updateValueForKey(key: string, value: unknown): void {
    let updatedState: CharacteristicValue;
    switch (key) {
      case 'lock_state':
        this.lockStateIsAvailable = true;
        switch (value as string) {
          case 'not_fully_locked':
            updatedState = hap.Characteristic.LockCurrentState.JAMMED;
            break;
          case 'locked':
            updatedState = hap.Characteristic.LockCurrentState.SECURED;
            break;
          case 'unlocked':
            updatedState = hap.Characteristic.LockCurrentState.UNSECURED;
            break;
          default:
            updatedState = hap.Characteristic.LockCurrentState.UNKNOWN;
            break;
        }
        this.service.getCharacteristic(hap.Characteristic.LockCurrentState)
          .updateValue(updatedState);
        break;
      case 'state':
        if (this.lockStateIsAvailable) {
          // Don't use this value if `lock_state` is also reported.
          return;
        }
        switch (value as string) {
          case LockMechanismServiceWrapper.LOCKED:
            updatedState = hap.Characteristic.LockCurrentState.SECURED;
            break;
          case LockMechanismServiceWrapper.UNLOCKED:
            updatedState = hap.Characteristic.LockCurrentState.UNSECURED;
            break;
          default:
            updatedState = hap.Characteristic.LockCurrentState.UNKNOWN;
            break;
        }
        this.service.getCharacteristic(hap.Characteristic.LockCurrentState)
          .updateValue(updatedState);
        break;
      default:
        // Ignore other keys.
        break;
    }
  }

  remove(accessory: PlatformAccessory): void {
    accessory.removeService(this.service);
  }
}

export class SwitchServiceWrapper implements ServiceWrapper {
  static readonly ON = 'ON';
  static readonly OFF = 'OFF';

  constructor(
    protected readonly service: Service, protected readonly setPublisher: MqttSetPublisher,
    private readonly key: string = 'state') {
    service.getCharacteristic(hap.Characteristic.On)
      .on('set', this.setOn.bind(this));
  }

  static getSubTypeFromKey(key: string): string | undefined {
    if (!key.startsWith('state_')) {
      return undefined;
    }

    return (key.substr(6));
  }

  get displayName(): string {
    return `Switch (${this.key})`;
  }

  appliesToKey(key: string): boolean {
    return key === this.key;
  }

  updateValueForKey(key: string, value: unknown): void {
    if (key === this.key) {
      const actualValue: boolean = (value === SwitchServiceWrapper.ON);
      this.service.updateCharacteristic(hap.Characteristic.On, actualValue);
    }
  }

  private setOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data[this.key] = (value as boolean) ? SwitchServiceWrapper.ON : SwitchServiceWrapper.OFF;
    this.setPublisher(data);
    callback(null);
  }

  remove(accessory: PlatformAccessory): void {
    accessory.removeService(this.service);
  }
}

export class LightbulbServiceWrapper extends SwitchServiceWrapper {
  private hasBrightness: boolean;
  private hasColorTemperature: boolean;
  private hasColors: boolean;

  private receivedHue: boolean;
  private receivedSaturation: boolean;
  private hue: number;
  private saturation: number;

  constructor(
    protected readonly service: Service, publish: MqttSetPublisher) {
    super(service, publish);
    this.hasBrightness = false;
    this.hasColorTemperature = false;
    this.hasColors = false;
    this.hue = 0;
    this.saturation = 0;
    this.receivedHue = false;
    this.receivedSaturation = false;
  }

  static convertXyToHueSat(x: number, y: number): [number, number] {
    // TODO Improve conversion?
    // Based on: https://gist.github.com/popcorn245/30afa0f98eea1c2fd34d
    const z: number = 1.0 - x - y;
    const Y = 0.5; // brightness; fixed at 50% for now
    const X: number = (Y / y) * x;
    const Z: number = (Y / y) * z;

    let r: number = (X * 1.4628067) - (Y * 0.1840623) - (Z * 0.2743606);
    let g: number = (-X * 0.5217933) + (Y * 1.4472381) + (Z * 0.0677227);
    let b: number = (X * 0.0349342) - (Y * 0.0968930) + (Z * 1.2884099);

    // Apply reverse gamma correction
    r = (r <= 0.0031308) ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055;
    g = (g <= 0.0031308) ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055;
    b = (b <= 0.0031308) ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055;

    const hsl = color_convert.rgb.hsl(r, g, b);

    return [hsl[0], hsl[1]];
  }

  static convertHueSatToXy(hue: number, saturation: number): [number, number] {
    // TODO Improve conversion?
    // Based on: https://gist.github.com/popcorn245/30afa0f98eea1c2fd34d
    const rgb = color_convert.hsl.rgb(hue, saturation, 50);

    let red: number = rgb[0] / 255;
    red = (red > 0.04045) ? Math.pow((red + 0.055) / (1.0 + 0.055), 2.4) : (red / 12.92);

    let green: number = rgb[1] / 255;
    green = (green > 0.04045) ? Math.pow((green + 0.055) / (1.0 + 0.055), 2.4) : (green / 12.92);

    let blue: number = rgb[2] / 255;
    blue = (blue > 0.04045) ? Math.pow((blue + 0.055) / (1.0 + 0.055), 2.4) : (blue / 12.92);

    const X: number = (red * 0.649926) + (green * 0.103455) + (blue * 0.197109);
    const Y: number = (red * 0.234327) + (green * 0.743075) + (blue * 0.022598);
    const Z: number = (red * 0.0000000) + (green * 0.053077) + (blue * 1.035763);


    const x: number = X / (X + Y + Z);
    const y: number = Y / (X + Y + Z);

    return [x, y];
  }

  get displayName(): string {
    return 'Lightbulb';
  }

  private addBrightness() {
    if (!this.hasBrightness) {
      this.service.getCharacteristic(hap.Characteristic.Brightness)
        .on('set', this.setBrightness.bind(this));
      this.hasBrightness = true;
    }
  }

  private addColors() {
    if (!this.hasColors) {
      this.service.getCharacteristic(hap.Characteristic.Hue)
        .on('set', this.setHue.bind(this));
      this.service.getCharacteristic(hap.Characteristic.Saturation)
        .on('set', this.setSaturation.bind(this));

      this.receivedHue = false;
      this.receivedSaturation = false;
      this.hasColors = true;
    }
  }

  private addColorTemperature() {
    if (!this.hasColorTemperature) {
      this.service.getCharacteristic(hap.Characteristic.ColorTemperature)
        .on('set', this.setColorTemperature.bind(this));
      this.hasColorTemperature = true;
    }
  }

  private setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = { brightness: Math.ceil((value as number) * (255 / 100)) };
    this.setPublisher(data);
    callback(null);
  }

  private setColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = { color_temp: value as number };

    this.setPublisher(data);
    callback(null);
  }

  private tryPublishColor() {
    if (this.receivedHue && this.receivedSaturation) {
      this.receivedHue = false;
      this.receivedSaturation = false;

      const xy = LightbulbServiceWrapper.convertHueSatToXy(this.hue, this.saturation);
      const data = { color: { x: xy[0], y: xy[1] } };
      this.setPublisher(data);
    }
  }

  private setHue(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.receivedHue = true;
    this.hue = value as number;
    this.tryPublishColor();
    callback(null);
  }

  private setSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.receivedSaturation = true;
    this.saturation = value as number;
    this.tryPublishColor();
    callback(null);
  }

  appliesToKey(key: string): boolean {
    return key === 'brightness' || key === 'color_temp' || key === 'color' || super.appliesToKey(key);
  }

  updateValueForKey(key: string, value: unknown): void {
    super.updateValueForKey(key, value);

    switch (key) {
      case 'brightness':
        this.addBrightness();
        this.service.updateCharacteristic(hap.Characteristic.Brightness, Math.round(((value as number) / 255) * 100));
        break;
      case 'color_temp':
        this.addColorTemperature();
        this.service.updateCharacteristic(hap.Characteristic.ColorTemperature, value as number);
        break;
      case 'color':
      {
        this.addColors();
        const hueSat = LightbulbServiceWrapper.convertXyToHueSat((value as Record<string, unknown>).x as number,
            (value as Record<string, unknown>).y as number);

        this.service.updateCharacteristic(hap.Characteristic.Hue, hueSat[0]);
        this.service.updateCharacteristic(hap.Characteristic.Saturation, hueSat[1]);
        break;
      }
    }
  }
}