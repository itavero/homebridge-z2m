import { Service, PlatformAccessory, WithUUID, Characteristic, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';

import { Zigbee2mqttPlatform } from './platform';
import { Zigbee2mqttDeviceInfo } from './models';
import { ExtendedTimer } from './timer';

import * as color_convert from 'color-convert';

export class Zigbee2mqttAccessory {
  public static readonly IGNORED_STATE_KEYS: Set<string> = new Set<string>(
    ['last_seen', 'linkquality', 'voltage', 'pressure', 'illuminance', 'update_available']);

  private readonly services: ServiceWrapper[] = [];
  private readonly updateTimer: ExtendedTimer;

  constructor(
    private readonly platform: Zigbee2mqttPlatform,
    public readonly accessory: PlatformAccessory,
  ) {
    this.updateDeviceInformation(accessory.context.device);

    // Recreate ServiceWrappers from restored services
    for (const srv of this.accessory.services) {
      const uuid = srv.getServiceId();

      switch (uuid) {
        case this.platform.Service.TemperatureSensor.UUID:
          this.createServiceForKey('temperature');
          break;
        case this.platform.Service.HumiditySensor.UUID:
          this.createServiceForKey('humidity');
          break;
        case this.platform.Service.ContactSensor.UUID:
          this.createServiceForKey('contact');
          break;
        case this.platform.Service.LightSensor.UUID:
          this.createServiceForKey('illuminance_lux');
          break;
        case this.platform.Service.OccupancySensor.UUID:
          this.createServiceForKey('occupancy');
          break;
        case this.platform.Service.SmokeSensor.UUID:
          this.createServiceForKey('smoke');
          break;
        case this.platform.Service.LeakSensor.UUID:
          this.createServiceForKey('water_leak');
          break;
        case this.platform.Service.Lightbulb.UUID:
          this.createServiceForKey('brightness');
          break;
        case this.platform.Service.Switch.UUID:
          this.createServiceForKey('state');
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

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .updateCharacteristic(this.platform.Characteristic.Manufacturer, manufacturer)
      .updateCharacteristic(this.platform.Characteristic.Model, info.modelID ?? 'unknown')
      .updateCharacteristic(this.platform.Characteristic.SerialNumber, info.ieeeAddr)
      .updateCharacteristic(this.platform.Characteristic.HardwareRevision, info.hardwareVersion ?? '?')
      .updateCharacteristic(this.platform.Characteristic.FirmwareRevision, info.softwareBuildID ?? '?');

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
      this.platform.log.debug('Unhandled keys for accessory '.concat(this.accessory.context.device.friendly_name, ': ',
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
          this.getOrAddService(this.platform.Service.HumiditySensor),
          this.platform.Characteristic.CurrentRelativeHumidity);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'temperature':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('temperature',
          this.getOrAddService(this.platform.Service.TemperatureSensor),
          this.platform.Characteristic.CurrentTemperature);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'illuminance_lux':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('illuminance_lux',
          this.getOrAddService(this.platform.Service.LightSensor),
          this.platform.Characteristic.CurrentAmbientLightLevel);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'contact':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('contact',
          this.getOrAddService(this.platform.Service.ContactSensor),
          this.platform.Characteristic.ContactSensorState,
          (key, value) => value as boolean
            ? this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED
            : this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'occupancy':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('occupancy',
          this.getOrAddService(this.platform.Service.OccupancySensor),
          this.platform.Characteristic.OccupancyDetected,
          (key, value) => value as boolean
            ? this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
            : this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'smoke':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('smoke',
          this.getOrAddService(this.platform.Service.SmokeSensor),
          this.platform.Characteristic.SmokeDetected,
          (key, value) => value as boolean
            ? this.platform.Characteristic.SmokeDetected.SMOKE_DETECTED
            : this.platform.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'water_leak':
      {
        const wrapper = new SingleReadOnlyValueServiceWrapper('water_leak',
          this.getOrAddService(this.platform.Service.LeakSensor),
          this.platform.Characteristic.LeakDetected,
          (key, value) => value as boolean
            ? this.platform.Characteristic.LeakDetected.LEAK_DETECTED
            : this.platform.Characteristic.LeakDetected.LEAK_NOT_DETECTED);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'battery':
      {
        const wrapper = new BatteryServiceWrapper(this.getOrAddService(this.platform.Service.BatteryService),
          this.platform.Characteristic);
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'state':
      {
        const wrapper = new SwitchServiceWrapper(this.getOrAddService(this.platform.Service.Switch),
          this.platform.Characteristic, this.publishSet.bind(this));
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'brightness':
      case 'color_temp':
      case 'color':
      {
        this.removeOtherServicesUsingKey('state');
        const wrapper = new LightbulbServiceWrapper(this.getOrAddService(this.platform.Service.Lightbulb),
          this.platform.Characteristic, this.publishSet.bind(this));
        this.addService(wrapper, state, handledKeys);
        break;
      }
      case 'position':
      {
        const wrapper = new WindowCoveringServiceWrapper(this.getOrAddService(this.platform.Service.WindowCovering),
          this.platform.Characteristic, this.publishSet.bind(this), this.publishGet.bind(this));
        this.addService(wrapper, state, handledKeys);
        break;
      }
      default:
        // All remaining unhandled keys will be logged a few lines down.
        break;
    }
  }

  private addService(srv: ServiceWrapper, state: Map<string, CharacteristicValue> | undefined, handledKeys: Set<string> | undefined) {
    this.platform.log.debug(`Adding ${srv.displayName} to accessory ${this.accessory.displayName}.`);
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
        this.platform.log.debug(`Remove service ${srv.displayName} from ${this.accessory.displayName} (because it uses key '${key}').`);
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

  private getOrAddService<T extends WithUUID<typeof Service>>(service: T, setNameCharacteristic = true,
    name: string | undefined = undefined): Service {
    const existingService = this.accessory.getService(service);
    if (existingService !== undefined) {
      return existingService;
    }

    const newService = this.accessory.addService(service);
    if (setNameCharacteristic) {
      let displayName: string = this.accessory.displayName;
      if (name !== undefined) {
        displayName = name as string;
      }
      newService.updateCharacteristic(this.platform.Characteristic.Name, displayName);
    }
    return newService;
  }

  private publishSet(data: Record<string, unknown>): void {
    // Publish using ieeeAddr, as that will never change and the friendly_name might.
    this.platform.publishMessage(`${this.accessory.context.device.ieeeAddr}/set`, JSON.stringify(data), { qos: 2 });
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
    private readonly characteristic: WithUUID<new () => Characteristic>,
    private readonly transformMqttValue: MqttValueTransformer | undefined = undefined,
  ) {
  }

  get displayName(): string {
    return this.service.constructor.name;
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
  private readonly levelCharacteristic: WithUUID<new () => Characteristic>;
  private readonly statusLowBatteryCharacteristic: WithUUID<new () => Characteristic>;
  private readonly levelLow: CharacteristicValue;
  private readonly levelNormal: CharacteristicValue;
  constructor(
    private readonly service: Service, characteristics: typeof Characteristic) {
    this.service.updateCharacteristic(characteristics.ChargingState, characteristics.ChargingState.NOT_CHARGEABLE);
    this.levelCharacteristic = characteristics.BatteryLevel;
    this.statusLowBatteryCharacteristic = characteristics.StatusLowBattery;
    this.levelLow = characteristics.StatusLowBattery.BATTERY_LEVEL_LOW;
    this.levelNormal = characteristics.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  get displayName(): string {
    return 'BatteryService';
  }

  appliesToKey(key: string): boolean {
    return key === 'battery';
  }

  updateValueForKey(key: string, value: unknown): void {
    if (key === 'battery') {
      this.service.updateCharacteristic(this.levelCharacteristic, value as number);
      this.service.updateCharacteristic(this.statusLowBatteryCharacteristic, (value as number < 30) ? this.levelLow : this.levelNormal);
    }
  }

  remove(accessory: PlatformAccessory): void {
    accessory.removeService(this.service);
  }

}

export class WindowCoveringServiceWrapper implements ServiceWrapper {
  private readonly currentPositionCharacteristic: WithUUID<new () => Characteristic>;
  private readonly targetPositionCharacteristic: WithUUID<new () => Characteristic>;
  private readonly positionStateCharacteristic: WithUUID<new () => Characteristic>;
  private readonly stateDecreasing: CharacteristicValue;
  private readonly stateIncreasing: CharacteristicValue;
  private readonly stateStopped: CharacteristicValue;
  private currentPosition: number;
  private targetPosition: number;

  private readonly updateTimer: ExtendedTimer;

  constructor(
    private readonly service: Service, characteristics: typeof Characteristic, private readonly setPublisher: MqttSetPublisher,
    private readonly getPublisher: MqttGetPublisher) {
    this.currentPositionCharacteristic = characteristics.CurrentPosition;
    this.targetPositionCharacteristic = characteristics.TargetPosition;
    this.positionStateCharacteristic = characteristics.PositionState;
    this.stateDecreasing = characteristics.PositionState.DECREASING;
    this.stateIncreasing = characteristics.PositionState.INCREASING;
    this.stateStopped = characteristics.PositionState.STOPPED;

    this.currentPosition = -1;
    this.targetPosition = -1;

    this.updateTimer = new ExtendedTimer(this.requestPositionUpdate.bind(this), 2000);

    service.getCharacteristic(this.targetPositionCharacteristic)
      .on('set', this.setTargetPosition.bind(this));

    service.getCharacteristic(this.positionStateCharacteristic)
      .setValue(this.stateStopped);
  }

  get displayName(): string {
    return 'WindowCovering';
  }

  private setTargetPosition(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.targetPosition = value as number;
    this.setPublisher({ position: this.targetPosition });

    // Assume state of cover
    if (this.targetPosition > this.currentPosition) {
      this.service.getCharacteristic(this.positionStateCharacteristic)
        .setValue(this.stateIncreasing);
    } else if (this.targetPosition < this.currentPosition) {
      this.service.getCharacteristic(this.positionStateCharacteristic)
        .setValue(this.stateDecreasing);
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

      let state = this.stateStopped;
      if (this.currentPosition >= 0) {
        if (newPosition > this.currentPosition) {
          state = this.stateIncreasing;
        } else if (newPosition < this.currentPosition) {
          state = this.stateDecreasing;
        } else {
          // Stop requesting frequent updates
          this.updateTimer.stop();
        }
      }

      this.service.getCharacteristic(this.positionStateCharacteristic)
        .updateValue(state);

      this.service.getCharacteristic(this.currentPositionCharacteristic)
        .updateValue(newPosition);

      this.currentPosition = newPosition;
    }
  }

  remove(accessory: PlatformAccessory): void {
    accessory.removeService(this.service);
  }

}

export class DelayedPublisher {

  private pendingPublishData: Record<string, unknown>;
  private publishIsScheduled: boolean;

  constructor(private readonly publish: MqttSetPublisher) {
    this.pendingPublishData = {};
    this.publishIsScheduled = false;
  }

  protected queuePublishData(data: Record<string, unknown>) {
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
    this.publish(this.pendingPublishData);
    this.pendingPublishData = {};
  }
}

export class SwitchServiceWrapper extends DelayedPublisher implements ServiceWrapper {
  private readonly onCharacteristic: WithUUID<new () => Characteristic>;
  constructor(
    protected readonly service: Service, characteristics: typeof Characteristic, publish: MqttSetPublisher) {
    super(publish);
    this.onCharacteristic = characteristics.On;
    service.getCharacteristic(this.onCharacteristic)
      .on('set', this.setOn.bind(this));
  }

  get displayName(): string {
    return 'Switch';
  }

  appliesToKey(key: string): boolean {
    return key === 'state';
  }

  updateValueForKey(key: string, value: unknown): void {
    if (key === 'state') {
      const actualValue: boolean = (value === 'ON');
      this.service.updateCharacteristic(this.onCharacteristic, actualValue);
    }
  }

  private setOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = { state: (value as boolean) ? 'ON' : 'OFF' };
    this.queuePublishData(data);
    callback(null);
  }

  remove(accessory: PlatformAccessory): void {
    accessory.removeService(this.service);
  }
}

export class LightbulbServiceWrapper extends SwitchServiceWrapper {
  private readonly brightnessCharacteristic: WithUUID<new () => Characteristic>;
  private readonly colorTemperatureCharacteristic: WithUUID<new () => Characteristic>;
  private readonly hueCharacteristic: WithUUID<new () => Characteristic>;
  private readonly saturationCharacteristic: WithUUID<new () => Characteristic>;
  private hasBrightness: boolean;
  private hasColorTemperature: boolean;
  private hasColors: boolean;

  private receivedHue: boolean;
  private receivedSaturation: boolean;
  private hue: number;
  private saturation: number;

  constructor(
    protected readonly service: Service, characteristics: typeof Characteristic, publish: MqttSetPublisher) {
    super(service, characteristics, publish);
    this.brightnessCharacteristic = characteristics.Brightness;
    this.colorTemperatureCharacteristic = characteristics.ColorTemperature;
    this.hueCharacteristic = characteristics.Hue;
    this.saturationCharacteristic = characteristics.Saturation;
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
      this.service.getCharacteristic(this.brightnessCharacteristic)
        .on('set', this.setBrightness.bind(this));
      this.hasBrightness = true;
    }
  }

  private addColors() {
    if (!this.hasColors) {
      this.service.getCharacteristic(this.hueCharacteristic)
        .on('set', this.setHue.bind(this));
      this.service.getCharacteristic(this.saturationCharacteristic)
        .on('set', this.setSaturation.bind(this));

      this.receivedHue = false;
      this.receivedSaturation = false;
      this.hasColors = true;
    }
  }

  private addColorTemperature() {
    if (!this.hasColorTemperature) {
      this.service.getCharacteristic(this.colorTemperatureCharacteristic)
        .on('set', this.setColorTemperature.bind(this));
      this.hasColorTemperature = true;
    }
  }

  private setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = { brightness: Math.ceil((value as number) * (255 / 100)) };
    this.queuePublishData(data);
    callback(null);
  }

  private setColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = { color_temp: value as number };

    this.queuePublishData(data);
    callback(null);
  }

  private tryPublishColor() {
    if (this.receivedHue && this.receivedSaturation) {
      this.receivedHue = false;
      this.receivedSaturation = false;

      const xy = LightbulbServiceWrapper.convertHueSatToXy(this.hue, this.saturation);
      const data = { color: { x: xy[0], y: xy[1] } };
      this.queuePublishData(data);
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
        this.service.updateCharacteristic(this.brightnessCharacteristic, Math.round(((value as number) / 255) * 100));
        break;
      case 'color_temp':
        this.addColorTemperature();
        this.service.updateCharacteristic(this.colorTemperatureCharacteristic, value as number);
        break;
      case 'color':
      {
        this.addColors();
        const hueSat = LightbulbServiceWrapper.convertXyToHueSat((value as Record<string, unknown>).x as number,
            (value as Record<string, unknown>).y as number);

        this.service.updateCharacteristic(this.hueCharacteristic, hueSat[0]);
        this.service.updateCharacteristic(this.saturationCharacteristic, hueSat[1]);
        break;
      }
    }
  }
}