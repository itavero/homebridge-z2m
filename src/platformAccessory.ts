import { Controller, PlatformAccessory, Service } from 'homebridge';
import { Zigbee2mqttPlatform } from './platform';
import { ExtendedTimer } from './timer';
import { hap } from './hap';
import { BasicServiceCreatorManager, ServiceCreatorManager } from './converters/creators';
import { BasicAccessory, BasicLogger, ServiceHandler } from './converters/interfaces';
import { deviceListEntriesAreEqual, DeviceListEntry, isDeviceDefinition, isDeviceListEntry } from './z2mModels';
import { BaseDeviceConfiguration } from './configModels';

export class Zigbee2mqttAccessory implements BasicAccessory {
  private readonly updateTimer: ExtendedTimer;
  private readonly serviceCreatorManager: ServiceCreatorManager;
  private readonly serviceHandlers = new Map<string, ServiceHandler>();
  private readonly serviceIds = new Set<string>();

  private pendingPublishData: Record<string, unknown>;
  private publishIsScheduled: boolean;

  private readonly pendingGetKeys: Set<string>;
  private getIsScheduled: boolean;

  get log(): BasicLogger {
    return this.platform.log;
  }

  get displayName(): string {
    return this.accessory.context.device.friendly_name;
  }

  constructor(
    public readonly platform: Zigbee2mqttPlatform,
    public readonly accessory: PlatformAccessory,
    private readonly additionalConfig: BaseDeviceConfiguration,
    serviceCreatorManager?: ServiceCreatorManager,
  ) {
    // Store ServiceCreatorManager
    if (serviceCreatorManager === undefined) {
      this.serviceCreatorManager = BasicServiceCreatorManager.getInstance();
    } else {
      this.serviceCreatorManager = serviceCreatorManager;
    }

    // Setup delayed publishing
    this.pendingPublishData = {};
    this.publishIsScheduled = false;

    // Setup delayed get
    this.pendingGetKeys = new Set<string>();
    this.getIsScheduled = false;

    // Log additional config
    this.platform.log.debug(`Config for accessory ${this.displayName} : ${JSON.stringify(this.additionalConfig)}`);

    this.updateDeviceInformation(accessory.context.device, true);

    // Ask Zigbee2MQTT for a status update at least once every 4 hours.
    this.updateTimer = new ExtendedTimer(() => {
      this.queueAllKeysForGet();
    }, (4 * 60 * 60 * 1000));

    // Immediately request an update to start off.
    this.queueAllKeysForGet();
  }

  registerServiceHandler(handler: ServiceHandler): void {
    const key = handler.identifier;
    if (this.serviceHandlers.has(key)) {
      this.log.error(`DUPLICATE SERVICE HANDLER with identifier ${key} for accessory ${this.displayName}. New one will not stored.`);
    } else {
      this.serviceHandlers.set(key, handler);
    }
  }

  configureController(controller: Controller) {
    this.accessory.configureController(controller);
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

    return this.additionalConfig.excluded_keys?.includes(property) ?? false;
  }

  isValueAllowedForProperty(property: string, value: string): boolean {
    const config = this.additionalConfig.values?.find(c => c.property === property);
    if (config) {
      if (config.include && config.include.length > 0) {
        if (config.include.findIndex(p => this.doesValueMatchPattern(value, p)) < 0) {
          // Value doesn't match any of the include patterns
          return false;
        }
      }
      if (config.exclude && config.exclude.length > 0) {
        if (config.exclude.findIndex(p => this.doesValueMatchPattern(value, p)) >= 0) {
          // Value matches one of the exclude patterns
          return false;
        }
      }
    }
    return true;
  }

  private doesValueMatchPattern(value: string, pattern: string) {
    if (pattern.length === 0) {
      return false;
    }
    if (pattern.length >= 2) {
      // Need at least 2 characters for the wildcard to work
      if (pattern.startsWith('*')) {
        return value.endsWith(pattern.substr(1));
      }
      if (pattern.endsWith('*')) {
        return value.startsWith(pattern.substr(0, pattern.length - 1));
      }
    }
    return value === pattern;
  }

  private queueAllKeysForGet(): void {
    const keys = [...this.serviceHandlers.values()].map(h => h.getableKeys).reduce((a, b) => {
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
      for (const k of keys) {
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

  static getUniqueIdForService(service: Service): string {
    if (service.subtype === undefined) {
      return service.UUID;
    }
    return `${service.UUID}_${service.subtype}`;
  }

  getOrAddService(service: Service): Service {
    this.serviceIds.add(Zigbee2mqttAccessory.getUniqueIdForService(service));

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

  updateDeviceInformation(info: DeviceListEntry | undefined, force_update = false) {

    // Only update the device if a valid device list entry is passed.
    // This is done so that old, pre-v1.0.0 accessories will only get updated when new device information is received.
    if (isDeviceListEntry(info)
      && (force_update || !deviceListEntriesAreEqual(this.accessory.context.device, info))) {
      const oldFriendlyName = this.accessory.context.device.friendly_name;
      const friendlyNameChanged = (force_update || info.friendly_name.localeCompare(this.accessory.context.device.friendly_name) !== 0);

      // Device info has changed
      this.accessory.context.device = info;

      if (!isDeviceDefinition(info.definition)) {
        this.log.error(`No device definition for device ${info.friendly_name} (${this.ieeeAddress}).`);
      } else {
        // Update accessory info
        // Note: getOrAddService is used so that the service is known in this.serviceIds and will not get filtered out.
        this.getOrAddService(new hap.Service.AccessoryInformation())
          .updateCharacteristic(hap.Characteristic.Name, info.friendly_name)
          .updateCharacteristic(hap.Characteristic.Manufacturer, info.definition.vendor ?? 'Zigbee2MQTT')
          .updateCharacteristic(hap.Characteristic.Model, info.definition.model ?? 'unknown')
          .updateCharacteristic(hap.Characteristic.SerialNumber, info.ieee_address)
          .updateCharacteristic(hap.Characteristic.HardwareRevision, info.date_code ?? '?')
          .updateCharacteristic(hap.Characteristic.FirmwareRevision, info.software_build_id ?? '?');

        // Create (new) services
        this.serviceCreatorManager.createHomeKitEntitiesFromExposes(this, info.definition.exposes);
      }

      this.cleanStaleServices();

      if (friendlyNameChanged) {
        this.platform.log.debug(`Updating service names for ${info.friendly_name} (from ${oldFriendlyName})`);
        this.updateServiceNames();
      }
    }
    this.platform.api.updatePlatformAccessories([this.accessory]);
  }

  private cleanStaleServices(): void {
    // Remove all services of which identifier is not known
    const staleServices = this.accessory.services.filter(s => !this.serviceIds.has(Zigbee2mqttAccessory.getUniqueIdForService(s)));
    staleServices.forEach((s) => {
      this.log.debug(`Clean up stale service ${s.displayName} (${s.UUID}) for accessory ${this.displayName} (${this.ieeeAddress}).`);
      this.accessory.removeService(s);
    });
  }

  private updateServiceNames(): void {
    // Update the name of all services
    for (const service of this.accessory.services) {
      if (service.UUID === hap.Service.AccessoryInformation.UUID) {
        continue;
      }
      const nameCharacteristic = service.getCharacteristic(hap.Characteristic.Name);
      if (nameCharacteristic !== undefined) {
        const displayName = this.getDefaultServiceDisplayName(service.subtype);
        nameCharacteristic.updateValue(displayName);
      }
    }
  }

  updateStates(state: Record<string, unknown>) {
    // Restart timer
    this.updateTimer.restart();

    // Call updates
    for (const handler of this.serviceHandlers.values()) {
      handler.updateState(state);
    }
  }

  getDefaultServiceDisplayName(subType: string | undefined): string {
    let name = this.displayName;
    if (subType !== undefined) {
      name += ` ${subType}`;
    }
    return name;
  }

  isAdaptiveLightingEnabled(): boolean {
    return this.additionalConfig.adaptive_lighting?.enabled ?? true;
  }

  getAdaptiveLightingMinimumColorTemperatureChange(): number {
    return this.additionalConfig.adaptive_lighting?.min_ct_change ?? 0;
  }

  getAdaptiveLightingTransitionTime(): number {
    return this.additionalConfig.adaptive_lighting?.transition ?? 0;
  }
}