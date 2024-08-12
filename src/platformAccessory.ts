import { Controller, HAPStatus, PlatformAccessory, Service } from 'homebridge';
import { Zigbee2mqttPlatform } from './platform';
import { ExtendedTimer } from './timer';
import { hap } from './hap';
import { BasicServiceCreatorManager, ServiceCreatorManager } from './converters/creators';
import { BasicAccessory, ServiceHandler } from './converters/interfaces';
import { BasicLogger } from './logger';
import {
  deviceListEntriesAreEqual,
  DeviceListEntry,
  ExposesEntry,
  isDeviceDefinition,
  isDeviceListEntry,
  isDeviceListEntryForGroup,
} from './z2mModels';
import { BaseDeviceConfiguration, isDeviceConfiguration } from './configModels';
import { QoS } from 'mqtt-packet';
import { sanitizeAccessoryName, sanitizeAndFilterExposesEntries } from './helpers';
import { EXP_AVAILABILITY } from './experimental';

export class Zigbee2mqttAccessory implements BasicAccessory {
  private readonly updateTimer: ExtendedTimer;
  private readonly serviceCreatorManager: ServiceCreatorManager;
  private readonly serviceHandlers = new Map<string, ServiceHandler>();
  private readonly serviceIds = new Set<string>();

  private pendingPublishData: Record<string, unknown>;
  private publishIsScheduled: boolean;

  private readonly pendingGetKeys: Set<string>;
  private getIsScheduled: boolean;

  private availabilityEnabled: boolean;
  private isAvailable: boolean;

  get log(): BasicLogger {
    return this.platform.log;
  }

  get displayName(): string {
    return this.accessory.context.device.friendly_name;
  }

  get deviceTopic(): string {
    if (isDeviceListEntryForGroup(this.accessory.context.device) || 'group_id' in this.accessory.context.device) {
      return this.accessory.context.device.friendly_name;
    }
    return this.accessory.context.device.ieee_address;
  }

  get groupId(): number | undefined {
    if (isDeviceListEntryForGroup(this.accessory.context.device) || 'group_id' in this.accessory.context.device) {
      return this.accessory.context.device.group_id;
    }
    return undefined;
  }

  get serialNumber(): string {
    if (isDeviceListEntryForGroup(this.accessory.context.device) || 'group_id' in this.accessory.context.device) {
      return `GROUP:${this.accessory.context.device.group_id}`;
    }
    return this.accessory.context.device.ieee_address;
  }

  constructor(
    private readonly platform: Zigbee2mqttPlatform,
    public readonly accessory: PlatformAccessory,
    private readonly additionalConfig: BaseDeviceConfiguration,
    serviceCreatorManager?: ServiceCreatorManager
  ) {
    // Store ServiceCreatorManager
    if (serviceCreatorManager === undefined) {
      this.serviceCreatorManager = BasicServiceCreatorManager.getInstance();
    } else {
      this.serviceCreatorManager = serviceCreatorManager;
    }

    // Log experimental features
    if (this.additionalConfig.experimental !== undefined && this.additionalConfig.experimental.length > 0) {
      this.log.warn(`Experimental features enabled for ${this.displayName}: ${this.additionalConfig.experimental.join(', ')}`);
    }

    // Set availability (always assume it is available at startup)
    this.isAvailable = true;
    this.availabilityEnabled = this.additionalConfig.ignore_availability === true ? false : true;

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
    this.updateTimer = new ExtendedTimer(
      () => {
        this.queueAllKeysForGet();
      },
      4 * 60 * 60 * 1000
    );

    // Immediately request an update to start off.
    this.queueAllKeysForGet();
  }

  setAvailabilityEnabled(enabled: boolean): void {
    const previousConfig = this.availabilityEnabled;
    this.availabilityEnabled = this.additionalConfig.ignore_availability === true ? false : enabled;
    if (previousConfig !== this.availabilityEnabled) {
      this.log.debug(`Availability feature for ${this.displayName} is now ${this.availabilityEnabled ? 'enabled' : 'disabled'}`);
    }
    if (!this.availabilityEnabled) {
      // Mark all services as online.
      // We do not have to know the Zigbee2MQTT online state to do this,
      // as this should only change when Zigbee2MQTT is also online.
      this.updateErrorStateOnMainCharacteristics(HAPStatus.SUCCESS);
    }
  }

  updateAvailability(available: boolean): void {
    if (available !== this.isAvailable) {
      this.isAvailable = available;
      this.log.debug(`${this.displayName} is ${available ? 'available' : 'UNAVAILABLE'}`);
      if (this.availabilityEnabled) {
        if (this.isAvailable) {
          this.sendLastValueOnMainCharacteristics();
        } else {
          this.updateErrorStateOnMainCharacteristics(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
      }
    }
  }

  informOnZigbee2MqttOnlineStateChange(online: boolean): void {
    if (this.additionalConfig.ignore_z2m_online === true) {
      // Ignore this call
      return;
    }
    if (online) {
      // Ignore previous state, as this might no longer be accurate.
      // Mark all services as available again.
      this.sendLastValueOnMainCharacteristics();
    } else {
      // Zigbee2MQTT went offline. Mark all services as unavailable.
      this.updateErrorStateOnMainCharacteristics(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private updateErrorStateOnMainCharacteristics(status: HAPStatus): void {
    const availabilityIsEnabled = this.isExperimentalFeatureEnabled(EXP_AVAILABILITY);
    this.log.debug(
      `availability (${availabilityIsEnabled ? 'EN' : 'DIS'}): ${this.displayName}: change status of characteristics to ${status}`
    );
    if (availabilityIsEnabled) {
      const error = new this.platform.api.hap.HapStatusError(status);
      for (const handler of this.serviceHandlers.values()) {
        for (const characteristic of handler.mainCharacteristics) {
          characteristic?.updateValue(error);
        }
      }
    }
  }

  private sendLastValueOnMainCharacteristics(): void {
    const availabilityIsEnabled = this.isExperimentalFeatureEnabled(EXP_AVAILABILITY);
    this.log.debug(
      `availability (${availabilityIsEnabled ? 'EN' : 'DIS'}): ${this.displayName}: send last known value of main characteristics`
    );
    if (availabilityIsEnabled) {
      this.log.debug(`Send last value for main characteristics of ${this.displayName}`);
      for (const handler of this.serviceHandlers.values()) {
        for (const characteristic of handler.mainCharacteristics) {
          if (characteristic === undefined) {
            continue;
          }
          if (characteristic.value !== undefined && characteristic.value !== null) {
            characteristic.sendEventNotification(characteristic.value);
          }
        }
      }
    }
  }

  getConverterConfiguration(tag: string): unknown | undefined {
    return this.additionalConfig.converters !== undefined ? this.additionalConfig.converters[tag] : undefined;
  }

  isExperimentalFeatureEnabled(feature: string): boolean {
    if (this.platform.isExperimentalFeatureEnabled(feature)) {
      // Enabled globally
      return true;
    }

    if (this.additionalConfig.experimental !== undefined) {
      // Enabled for this accessory
      return this.additionalConfig.experimental.includes(feature.trim().toLocaleUpperCase());
    }

    return false;
  }

  registerServiceHandler(handler: ServiceHandler): void {
    const key = handler.identifier;
    if (this.serviceHandlers.has(key)) {
      this.log.error(`DUPLICATE SERVICE HANDLER with identifier ${key} for accessory ${this.displayName}. New one will not stored.`);
    } else {
      this.serviceHandlers.set(key, handler);
    }
  }

  isServiceHandlerIdKnown(identifier: string): boolean {
    return this.serviceHandlers.has(identifier);
  }

  private isPropertyExcluded(property: string | undefined): boolean {
    if (property === undefined) {
      // Property is undefined, so it can't be excluded.
      // This is accepted so all exposes models can easily be checked.
      return false;
    }

    if (Array.isArray(this.additionalConfig.included_keys) && this.additionalConfig.included_keys.includes(property)) {
      // Property is explicitly included
      return false;
    }

    return this.additionalConfig.excluded_keys?.includes(property) ?? false;
  }

  private isEndpointExcluded(endpoint: string | undefined): boolean {
    if (this.additionalConfig.excluded_endpoints === undefined || this.additionalConfig.excluded_endpoints.length === 0) {
      // No excluded endpoints defined
      return false;
    }
    return this.additionalConfig.excluded_endpoints.includes(endpoint ?? '');
  }

  private isExposesEntryExcluded(exposesEntry: ExposesEntry): boolean {
    if (this.isPropertyExcluded(exposesEntry.property)) {
      return true;
    }

    return this.isEndpointExcluded(exposesEntry.endpoint);
  }

  private filterValuesForExposesEntry(exposesEntry: ExposesEntry): string[] {
    if (exposesEntry.values === undefined || exposesEntry.values.length === 0) {
      return [];
    }

    if (exposesEntry.property === undefined) {
      // Do not filter.
      return exposesEntry.values;
    }

    return exposesEntry.values.filter((v) => this.isValueAllowedForProperty(exposesEntry.property ?? '', v));
  }

  private isValueAllowedForProperty(property: string, value: string): boolean {
    const config = this.additionalConfig.values?.find((c) => c.property === property);
    if (config) {
      if (config.include && config.include.length > 0 && config.include.findIndex((p) => this.doesValueMatchPattern(value, p)) < 0) {
        // Value doesn't match any of the include patterns
        return false;
      }
      if (config.exclude && config.exclude.length > 0 && config.exclude.findIndex((p) => this.doesValueMatchPattern(value, p)) >= 0) {
        // Value matches one of the exclude patterns
        return false;
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
        return value.endsWith(pattern.substring(1));
      }
      if (pattern.endsWith('*')) {
        return value.startsWith(pattern.slice(0, -1));
      }
    }
    return value === pattern;
  }

  private queueAllKeysForGet(): void {
    const keys = [...this.serviceHandlers.values()]
      .map((h) => h.getableKeys)
      .reduce((a, b) => {
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
      this.platform.publishMessage(`${this.deviceTopic}/get`, JSON.stringify(data), { qos: this.getMqttQosLevel(1) });
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

    const existingService = this.accessory.services.find((e) => e.UUID === service.UUID && e.subtype === service.subtype);

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
    this.platform.publishMessage(`${this.deviceTopic}/set`, JSON.stringify(this.pendingPublishData), { qos: this.getMqttQosLevel(2) });
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
    return id === this.ieeeAddress || this.accessory.context.device.friendly_name === id;
  }

  updateDeviceInformation(info: DeviceListEntry | undefined, force_update = false) {
    // Overwrite exposes information if available in configuration
    if (
      info?.definition !== undefined &&
      info.definition !== null &&
      isDeviceConfiguration(this.additionalConfig) &&
      this.additionalConfig.exposes !== undefined &&
      this.additionalConfig.exposes.length > 0
    ) {
      info.definition.exposes = this.additionalConfig.exposes;
    }

    // Filter/sanitize exposes information
    if (info?.definition?.exposes !== undefined) {
      info.definition.exposes = sanitizeAndFilterExposesEntries(
        info.definition.exposes,
        (e) => {
          return !this.isExposesEntryExcluded(e);
        },
        this.filterValuesForExposesEntry.bind(this)
      );
    }

    // Only update the device if a valid device list entry is passed.
    // This is done so that old, pre-v1.0.0 accessories will only get updated when new device information is received.
    if (isDeviceListEntry(info) && (force_update || !deviceListEntriesAreEqual(this.accessory.context.device, info))) {
      const oldFriendlyName = this.accessory.context.device.friendly_name;
      const friendlyNameChanged = force_update || info.friendly_name.localeCompare(this.accessory.context.device.friendly_name) !== 0;

      // Device info has changed
      this.accessory.context.device = info;

      if (!isDeviceDefinition(info.definition)) {
        this.log.error(`No device definition for device ${info.friendly_name} (${this.ieeeAddress}).`);
      } else {
        // Update accessory info
        // Note: getOrAddService is used so that the service is known in this.serviceIds and will not get filtered out.
        this.getOrAddService(new hap.Service.AccessoryInformation())
          .updateCharacteristic(hap.Characteristic.Name, sanitizeAccessoryName(info.friendly_name))
          .updateCharacteristic(hap.Characteristic.Manufacturer, info.definition.vendor ?? 'Zigbee2MQTT')
          .updateCharacteristic(hap.Characteristic.Model, info.definition.model ?? 'unknown')
          .updateCharacteristic(hap.Characteristic.SerialNumber, this.serialNumber)
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
    const staleServices = this.accessory.services.filter((s) => !this.serviceIds.has(Zigbee2mqttAccessory.getUniqueIdForService(s)));
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

  private getMqttQosLevel(defaultQoS: QoS): QoS {
    if (this.platform.config?.mqtt.disable_qos) {
      return 0;
    }
    return defaultQoS;
  }

  updateStates(state: Record<string, unknown>) {
    // Restart timer
    this.updateTimer.restart();

    // Filter out all properties that have a null/undefined value
    for (const key in state) {
      if (state[key] === null || state[key] === undefined) {
        delete state[key];
      }
    }

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
    return sanitizeAccessoryName(name);
  }

  configureController(controller: Controller) {
    this.accessory.configureController(controller);
  }
}
