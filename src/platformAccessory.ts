import { PlatformAccessory, Logger, Service } from 'homebridge';
import { Zigbee2mqttPlatform } from './platform';
import { ExtendedTimer } from './timer';
import { hap } from './hap';
import { BasicServiceCreatorManager, ServiceCreatorManager } from './converters/creators';
import { BasicAccessory, ServiceHandler } from './converters/interfaces';
import { deviceListEntriesAreEqual, DeviceListEntry } from './z2mModels';

export class Zigbee2mqttAccessory implements BasicAccessory {
  private readonly updateTimer: ExtendedTimer;
  private readonly additionalConfig: Record<string, unknown>;
  private readonly exposeConverterManager: ServiceCreatorManager;
  private readonly serviceHandlers = new Map<string, ServiceHandler>();

  private pendingPublishData: Record<string, unknown>;
  private publishIsScheduled: boolean;

  private readonly pendingGetKeys: Set<string>;
  private getIsScheduled: boolean;

  get log(): Logger {
    return this.platform.log;
  }

  get displayName(): string {
    return this.accessory.context.device.friendly_name;
  }

  constructor(
    private readonly platform: Zigbee2mqttPlatform,
    public readonly accessory: PlatformAccessory,
    additionalConfig: Record<string, unknown> | undefined,
    serviceCreatorManager: ServiceCreatorManager = BasicServiceCreatorManager.getInstance(),
  ) {
    // Store ExposeConverterManager
    if (serviceCreatorManager === undefined) {
      throw new Error('ServiceCreatorManager is required');
    } else {
      this.exposeConverterManager = serviceCreatorManager;
    }

    // Setup delayed publishing
    this.pendingPublishData = {};
    this.publishIsScheduled = false;

    // Setup delayed get
    this.pendingGetKeys = new Set<string>();
    this.getIsScheduled = false;

    // Store additional config
    if (additionalConfig === undefined) {
      this.additionalConfig = {};
    } else {
      this.additionalConfig = additionalConfig;
    }

    this.updateDeviceInformation(accessory.context.device, true);

    // Ask Zigbee2mqtt for a status update at least once every 4 hours.
    this.updateTimer = new ExtendedTimer(() => {
      this.queueAllKeysForGet();
    }, (4 * 60 * 60 * 1000));

    // Immediately request an update to start off.
    this.queueAllKeysForGet();
  }

  registerServiceHandler(handler: ServiceHandler): void {
    const key = handler.identifier;
    if (this.serviceHandlers.has(key)) {
      throw new Error(`ServiceHandler with identifier ${key} already added to accessory ${this.displayName}.`);
    }
    this.serviceHandlers.set(key, handler);
  }

  isServiceHandlerIdKnown(identifier: string): boolean {
    return this.serviceHandlers.has(identifier);
  }

  isPropertyExcluded(property: string | undefined): boolean {
    if (property === undefined) {
      // Property is undefined, so it can't be excluded.
      // This is accepted so all exposes models can easily be checked.
      return false;
    }
    if (Array.isArray(this.additionalConfig?.excluded_keys)) {
      return this.additionalConfig.excluded_keys.includes(property);
    }
    return false;
  }

  private queueAllKeysForGet(): void {
    const keys = [...this.serviceHandlers.values()].map(h => h.getableKeys).reduce((a, b)=> {
      return a.concat(b);
    }, []);
    if (keys.length > 0) {
      this.queueKeyForGetAction(keys);
    }
  }

  private publishPendingGetKeys(): void {
    const keys = [...this.pendingGetKeys];
    this.pendingGetKeys.clear();
    this.getIsScheduled = false;

    if (keys.length > 0) {
      const data = {};
      for(const k of keys) {
        data[k] = 0;
      }
      // Publish using ieeeAddr, as that will never change and the friendly_name might.
      this.platform.publishMessage(`${this.accessory.context.device.ieee_address}/get`,
        JSON.stringify(data), { qos: 1 });
    }
  }

  queueKeyForGetAction(key: string | string[]): void {
    if (Array.isArray(key)) {
      for (const k of key) {
        this.pendingGetKeys.add(k);
      }
    } else {
      this.pendingGetKeys.add(key);
    }

    this.log.debug(`Pending get: ${[...this.pendingGetKeys].join(', ')}`);

    if (!this.getIsScheduled) {
      this.getIsScheduled = true;
      process.nextTick(() => {
        this.publishPendingGetKeys();
      });
    }
  }

  getOrAddService(service: Service): Service {
    const existingService = this.accessory.services.find(e =>
      e.UUID === service.UUID && e.subtype === service.subtype,
    );

    if (existingService !== undefined) {
      return existingService;
    }

    return this.accessory.addService(service);
  }

  queueDataForSetAction(data: Record<string, unknown>): void {
    this.pendingPublishData = { ...this.pendingPublishData, ...data };
    this.log.debug(`Pending data: ${JSON.stringify(this.pendingPublishData)}`);

    if (!this.publishIsScheduled) {
      this.publishIsScheduled = true;
      process.nextTick(() => {
        this.publishPendingSetData();
      });
    }
  }

  private publishPendingSetData() {
    this.platform.publishMessage(`${this.accessory.context.device.ieee_address}/set`, JSON.stringify(this.pendingPublishData), { qos: 2 });
    this.publishIsScheduled = false;
    this.pendingPublishData = {};
  }

  get UUID(): string {
    return this.accessory.UUID;
  }

  get ieeeAddress(): string {
    return this.accessory.context.device.ieee_address;
  }

  matchesIdentifier(id: string): boolean {
    return (id === this.ieeeAddress || this.accessory.context.device.friendly_name === id);
  }

  updateDeviceInformation(info: DeviceListEntry, force_update = true) {
    if (force_update || !deviceListEntriesAreEqual(this.accessory.context.device, info)) {
      // Device info has changed
      this.accessory.context.device = info;

      if (info.definition === undefined || info.definition === null) {
        throw new Error(`No device definition for device ${info.friendly_name} (${info.ieee_address}).`);
      }

      // Update accessory info
      this.accessory.getService(hap.Service.AccessoryInformation)!
        .updateCharacteristic(hap.Characteristic.Manufacturer, info.definition.vendor)
        .updateCharacteristic(hap.Characteristic.Model, info.definition.model)
        .updateCharacteristic(hap.Characteristic.SerialNumber, info.ieee_address)
        .updateCharacteristic(hap.Characteristic.HardwareRevision, info.date_code ?? '?')
        .updateCharacteristic(hap.Characteristic.FirmwareRevision, info.software_build_id ?? '?');

      // Create (new) services
      this.exposeConverterManager.createHomeKitEntitiesFromExposes(this, info.definition.exposes);
    }
    this.platform.api.updatePlatformAccessories([this.accessory]);
  }

  updateStates(state: Record<string, unknown>) {
    // Restart timer
    this.updateTimer.restart();

    // Call updates
    for (const handler of this.serviceHandlers.values()) {
      handler.updateState(state);
    }
  }
}