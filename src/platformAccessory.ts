import { Service, PlatformAccessory, WithUUID, Characteristic, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { Zigbee2mqttPlatform } from './platform';
import { Zigbee2mqttDeviceInfo } from './models';

export class Zigbee2mqttAccessory {
  public static readonly IGNORED_STATE_KEYS : Set<string> = new Set<string>(['last_seen', 'linkquality', 'voltage', 'pressure', 'illuminance']);
  private readonly services : ServiceWrapper[] = [];

  constructor(
    private readonly platform: Zigbee2mqttPlatform,
    public readonly accessory: PlatformAccessory,
  ) {
    this.updateDeviceInformation(accessory.context.device);
    this.handleServices();
  }

  get UUID(): string {
    return this.accessory.UUID; 
  }

  get ieeeAddress(): string {
    return this.accessory.context.device.ieeeAddr; 
  }

  matchesIdentifier(id:string) : boolean {
    return (id === this.ieeeAddress || this.accessory.context.device.friendly_name === id);
  }

  updateDeviceInformation(info: Zigbee2mqttDeviceInfo) {
    this.accessory.context.device = info;

    let manufacturer : string = info.manufacturerName ?? 'zigbee2mqtt';
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
    // Refresh cached state
    const newKeys : Set<string> = new Set<string>();
    if (!this.accessory.context.state || !(this.accessory.context.state instanceof Map)) {
      this.accessory.context.state = new Map<string, CharacteristicValue>();
    }
    for (const key in state) {
      newKeys.add(key);
      this.accessory.context.state.set(key, state[key]);
      this.accessory.context.state.del;
    }

    for (const key of (this.accessory.context.state as Map<string, CharacteristicValue>).keys()) {
      if (!newKeys.has(key)) {
        this.platform.log.debug('Remove old property with key:', key);
        this.accessory.context.state.delete(key);
      }
    }

    this.handleServices();
  }

  private handleServices() {
    if (!this.accessory.context.state || !(this.accessory.context.state instanceof Map)) {
      // nothing to do
      this.platform.log.debug(`Accessory ${this.accessory.displayName} has no state (yet).`);
      return;
    }

    const state = this.accessory.context.state as Map<string, CharacteristicValue>;
    const handledKeys = new Set<string>();

    // Iterate over existing services
    for (let i = this.services.length - 1; i >= 0; i--) {
      const srv = this.services[i];
      const keysUsed = this.callServiceWrapper(srv, state);

      if (keysUsed.size > 0) {
        keysUsed.forEach((key) => handledKeys.add(key));
      } else {
        // Get rid of old service
        srv.remove(this.accessory);
        this.services.splice(i, 1);
      }
    }

    // Create new services for unhandled keys
    let hasNewServices = false;
    for (const key of state.keys()) {
      if (handledKeys.has(key) || Zigbee2mqttAccessory.IGNORED_STATE_KEYS.has(key)) {
        // Already handled or ignored 
        continue;
      }

      // Create new service (if possible)
      switch (key) {
        case 'humidity':
        {
          this.platform.log.debug(`Adding HumiditySensor to accessory ${this.accessory.displayName}.`);
          const wrapper = new SingleReadOnlyValueServiceWrapper('humidity',
            this.getOrAddService(this.platform.Service.HumiditySensor),
            this.platform.Characteristic.CurrentRelativeHumidity);
          this.addService(wrapper, state);
          hasNewServices = true;
          break;
        }
        case 'temperature':
        {
          this.platform.log.debug(`Adding TemperatureSensor to accessory ${this.accessory.displayName}.`);
          const wrapper = new SingleReadOnlyValueServiceWrapper('temperature',
            this.getOrAddService(this.platform.Service.TemperatureSensor),
            this.platform.Characteristic.CurrentTemperature);
          this.addService(wrapper, state);
          hasNewServices = true;
          break;
        }
        case 'illuminance_lux':
        {
          this.platform.log.debug(`Adding LightSensor to accessory ${this.accessory.displayName}.`);
          const wrapper = new SingleReadOnlyValueServiceWrapper('illuminance_lux',
            this.getOrAddService(this.platform.Service.LightSensor),
            this.platform.Characteristic.CurrentAmbientLightLevel);
          this.addService(wrapper, state);
          hasNewServices = true;
          break;
        }
        case 'contact':
        {
          this.platform.log.debug(`Adding ContactSensor to accessory ${this.accessory.displayName}.`);
          const wrapper = new SingleReadOnlyValueServiceWrapper('contact',
            this.getOrAddService(this.platform.Service.ContactSensor),
            this.platform.Characteristic.ContactSensorState,
            (key, value) => value as boolean ? this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED : this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
          this.addService(wrapper, state);
          hasNewServices = true;
          break;
        }
        case 'occupancy':
        {
          this.platform.log.debug(`Adding OccupancySensor to accessory ${this.accessory.displayName}.`);
          const wrapper = new SingleReadOnlyValueServiceWrapper('occupancy',
            this.getOrAddService(this.platform.Service.OccupancySensor),
            this.platform.Characteristic.OccupancyDetected,
            (key, value) => value as boolean ? this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED : this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
          this.addService(wrapper, state);
          hasNewServices = true;
          break;
        }
        case 'smoke':
        {
          this.platform.log.debug(`Adding SmokeSensor to accessory ${this.accessory.displayName}.`);
          const wrapper = new SingleReadOnlyValueServiceWrapper('smoke',
            this.getOrAddService(this.platform.Service.SmokeSensor),
            this.platform.Characteristic.SmokeDetected,
            (key, value) => value as boolean ? this.platform.Characteristic.SmokeDetected.SMOKE_DETECTED : this.platform.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
          this.addService(wrapper, state);
          hasNewServices = true;
          break;
        }
        case 'water_leak':
        {
          this.platform.log.debug(`Adding LeakSensor to accessory ${this.accessory.displayName}.`);
          const wrapper = new SingleReadOnlyValueServiceWrapper('water_leak',
            this.getOrAddService(this.platform.Service.LeakSensor),
            this.platform.Characteristic.LeakDetected,
            (key, value) => value as boolean ? this.platform.Characteristic.LeakDetected.LEAK_DETECTED : this.platform.Characteristic.LeakDetected.LEAK_NOT_DETECTED);
          this.addService(wrapper, state);
          hasNewServices = true;
          break;
        }
        case 'battery':
        {
          this.platform.log.debug(`Adding BatteryService to accessory ${this.accessory.displayName}.`);
          const wrapper = new BatteryServiceWrapper(this.getOrAddService(this.platform.Service.BatteryService), this.platform.Characteristic);
          this.addService(wrapper, state);
          hasNewServices = true;
          break;
        }
        default:
          this.platform.log.debug(`Unhandled key '${key}' for accessory '${this.accessory.context.device.friendly_name}'`);
          break;
      }

      this.platform.api.updatePlatformAccessories([this.accessory]);
    }
  }

  private addService(srv:ServiceWrapper, state:Map<string, CharacteristicValue>) {
    this.services.push(srv);
    this.callServiceWrapper(srv, state);
    this.platform.api.updatePlatformAccessories([this.accessory]);
  }

  private callServiceWrapper(srv:ServiceWrapper, state:Map<string, CharacteristicValue>) : Set<string> {
    const handledKeys = new Set<string>();
    for (const key of state.keys()) {
      if (srv.appliesToKey(key)) {
        srv.updateValueForKey(key, state.get(key) as CharacteristicValue);
        handledKeys.add(key);
      }
    }
    return handledKeys; 
  }

  private getOrAddService<T extends WithUUID<typeof Service>>(service: T, setNameCharacteristic = true, name: string | undefined = undefined): Service {
    const existingService = this.accessory.getService(service);
    if (existingService !== undefined) {
      return existingService;
    }

    const newService = this.accessory.addService(service);
    if (setNameCharacteristic) {
      let displayName : string = this.accessory.displayName;
      if (name !== undefined) {
        displayName = name as string;
      }
      newService.updateCharacteristic(this.platform.Characteristic.Name, displayName);
    }
    return newService;
  }
}

export interface ServiceWrapper {
  appliesToKey(key:string) : boolean;
  updateValueForKey(key:string, value:CharacteristicValue);
  remove(accessory:PlatformAccessory);
}

export interface MqttValueTransformer {
  (key: string, value: CharacteristicValue): CharacteristicValue;
}

export class SingleReadOnlyValueServiceWrapper implements ServiceWrapper {
  
  constructor(
    private readonly key: string,
    private readonly service: Service,
    private readonly characteristic : string | WithUUID<new () => Characteristic>,
    private readonly transformMqttValue : MqttValueTransformer | undefined = undefined,
  ) {
  }

  updateValueForKey(key: string, value: CharacteristicValue) {
    if (this.key === key) {
      if (this.transformMqttValue !== undefined) {
        value = this.transformMqttValue(key, value);
      }
      this.service.updateCharacteristic(this.characteristic, value);
    }
  }

  appliesToKey(key: string): boolean {
    return this.key === key;
  }

  remove(accessory:PlatformAccessory) {
    accessory.removeService(this.service);
  }
}

export class BatteryServiceWrapper implements ServiceWrapper {
  private readonly levelCharacteristic : string | WithUUID<new () => Characteristic>;
  private readonly statusLowBatteryCharacteristic : string | WithUUID<new () => Characteristic>;
  private readonly levelLow : CharacteristicValue;
  private readonly levelNormal : CharacteristicValue;
  constructor(
    private readonly service: Service, characteristics: typeof Characteristic) {
    this.service.updateCharacteristic(characteristics.ChargingState, characteristics.ChargingState.NOT_CHARGEABLE);
    this.levelCharacteristic = characteristics.BatteryLevel;
    this.statusLowBatteryCharacteristic = characteristics.StatusLowBattery;
    this.levelLow = characteristics.StatusLowBattery.BATTERY_LEVEL_LOW;
    this.levelNormal = characteristics.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  appliesToKey(key: string): boolean {
    return key === 'battery';
  }

  updateValueForKey(key: string, value: CharacteristicValue) {
    if (key === 'battery') {
      this.service.updateCharacteristic(this.levelCharacteristic, value);
      this.service.updateCharacteristic(this.statusLowBatteryCharacteristic, (value < 30) ? this.levelLow : this.levelNormal);
    }
  }

  remove(accessory: PlatformAccessory) {
    accessory.removeService(this.service);
  }

}


