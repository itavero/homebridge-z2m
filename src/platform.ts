import { API, DynamicPlatformPlugin, Logger, LogLevel, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Zigbee2mqttAccessory } from './platformAccessory';
import {
  BaseDeviceConfiguration,
  DeviceConfiguration,
  isDeviceConfiguration,
  isPluginConfiguration,
  PluginConfiguration,
} from './configModels';

import mqtt from 'mqtt';
import * as fs from 'fs';
import {
  DeviceListEntry,
  DeviceListEntryForGroup,
  ExposesEntry,
  exposesGetOverlap,
  GroupListEntry,
  isDeviceDefinition,
  isDeviceListEntry,
  isDeviceListEntryForGroup,
} from './z2mModels';
import * as semver from 'semver';
import { errorToString, getDiffFromArrays, sanitizeAccessoryName } from './helpers';
import { BasicServiceCreatorManager } from './converters/creators';
import { getAvailabilityConfigurationForDevices, isAvailabilityEnabledGlobally } from './configHelpers';
import { BasicLogger } from './logger';
import { ConfigurableLogger } from './configurableLogger';

export class Zigbee2mqttPlatform implements DynamicPlatformPlugin {
  private static readonly MIN_Z2M_VERSION = '1.17.0';
  private static readonly TOPIC_BRIDGE = 'bridge/';
  private static readonly TOPIC_SUFFIX_AVAILABILITY = '/availability';

  public readonly config?: PluginConfiguration;
  public readonly log: ConfigurableLogger;
  private readonly mqttClient?: mqtt.MqttClient;
  private baseDeviceConfig: BaseDeviceConfiguration;

  // this is used to track restored cached accessories
  private readonly accessories: Zigbee2mqttAccessory[] = [];
  private didReceiveDevices: boolean;
  private lastReceivedZigbee2MqttVersion: string | undefined;
  private lastZigbee2MqttState: string | undefined;

  private lastReceivedDevices: DeviceListEntry[] = [];
  private lastReceivedGroups: GroupListEntry[] = [];
  private groupUpdatePending = false;
  private deviceUpdatePending = false;

  // Availability metadata
  private zigbee2MqttHasBeenOffline = false;
  private connectionPreviouslyClosed = false;
  private availabilityIsEnabledGlobally = false;
  private availabilityEnabledDevices = new Array<string>();
  private availabilityDisabledDevices = new Array<string>();

  constructor(
    logger: Logger,
    config: PlatformConfig,
    public readonly api: API
  ) {
    // Prepare internal states, variables and such
    this.onMessage = this.onMessage.bind(this);
    this.didReceiveDevices = false;
    this.lastReceivedZigbee2MqttVersion = undefined;

    // Prepare logger
    this.log = new ConfigurableLogger(logger);

    // Set device defaults
    this.baseDeviceConfig = {};

    // Validate configuration
    if (isPluginConfiguration(config, BasicServiceCreatorManager.getInstance(), this.log)) {
      this.config = config;
    } else {
      this.log.error(`INVALID CONFIGURATION FOR PLUGIN: ${PLUGIN_NAME}\nThis plugin will NOT WORK until this problem is resolved.`);
      return;
    }

    // Use configuration
    if (this.config !== undefined) {
      // Set log level
      this.log.debugAsInfo = this.config.log?.debug_as_info ?? false;
      if (this.log.debugAsInfo) {
        this.log.warn('Debug messages will be logged as INFO.');
      }

      // Normalize experimental feature flags
      if (this.config.experimental !== undefined) {
        this.config.experimental = this.config.experimental.map((feature: string) => feature.trim().toLocaleUpperCase());
        if (this.config.experimental.length > 0) {
          this.log.warn(`Experimental features enabled: ${this.config.experimental.join(', ')}`);
        }
      }

      // Merge defaults from the plugin configuration
      if (this.config.defaults !== undefined) {
        this.baseDeviceConfig = { ...this.baseDeviceConfig, ...this.config.defaults };
      }
      if (this.baseDeviceConfig.exclude === false) {
        // Set to undefined; as this is already the default behavior and might conflict with exclude_grouped_devices otherwise.
        this.log.debug('Changing default value for exclude from false to undefined.');
        this.baseDeviceConfig.exclude = undefined;
      }
      this.log.debug(`Default device config: ${JSON.stringify(this.baseDeviceConfig)}`);

      this.mqttClient = this.initializeMqttClient(this.config);
    }
  }

  private initializeMqttClient(config: PluginConfiguration): mqtt.MqttClient {
    if (!config.mqtt.server || !config.mqtt.base_topic) {
      this.log.error('No MQTT server and/or base_topic defined!');
    }
    this.log.info(`Connecting to MQTT server at ${config.mqtt.server}`);

    const options: mqtt.IClientOptions = Zigbee2mqttPlatform.createMqttOptions(this.log, config);

    const mqttClient = mqtt.connect(config.mqtt.server, options);
    mqttClient.on('connect', this.onMqttConnected.bind(this));
    mqttClient.on('close', this.onMqttClose.bind(this));

    this.api.on('didFinishLaunching', () => {
      if (this.config !== undefined) {
        // Setup MQTT callbacks and subscription
        this.mqttClient?.on('message', this.onMessage);
        this.mqttClient?.subscribe(this.config.mqtt.base_topic + '/#');
      }
    });

    return mqttClient;
  }

  public isExperimentalFeatureEnabled(feature: string): boolean {
    if (this.config?.experimental === undefined) {
      return false;
    }
    return this.config.experimental.includes(feature.trim().toLocaleUpperCase());
  }

  private static createMqttOptions(log: BasicLogger, config: PluginConfiguration): mqtt.IClientOptions {
    const options: mqtt.IClientOptions = {};
    if (config.mqtt.version) {
      options.protocolVersion = config.mqtt.version;
    }

    if (config.mqtt.keepalive) {
      log.debug(`Using MQTT keepalive: ${config.mqtt.keepalive}`);
      options.keepalive = config.mqtt.keepalive;
    }

    if (config.mqtt.ca) {
      log.debug(`MQTT SSL/TLS: Path to CA certificate = ${config.mqtt.ca}`);
      options.ca = fs.readFileSync(config.mqtt.ca);
    }

    if (config.mqtt.key && config.mqtt.cert) {
      log.debug(`MQTT SSL/TLS: Path to client key = ${config.mqtt.key}`);
      log.debug(`MQTT SSL/TLS: Path to client certificate = ${config.mqtt.cert}`);
      options.key = fs.readFileSync(config.mqtt.key);
      options.cert = fs.readFileSync(config.mqtt.cert);
    }

    if (config.mqtt.user && config.mqtt.password) {
      options.username = config.mqtt.user;
      options.password = config.mqtt.password;
    }

    if (config.mqtt.client_id) {
      log.debug(`Using MQTT client ID: '${config.mqtt.client_id}'`);
      options.clientId = config.mqtt.client_id;
    }

    if (config.mqtt.reject_unauthorized !== undefined && !config.mqtt.reject_unauthorized) {
      log.debug('MQTT reject_unauthorized set false, ignoring certificate warnings.');
      options.rejectUnauthorized = false;
    }

    return options;
  }

  private updateServerAvailabilityForAllDevices(isOnline: boolean) {
    for (const accessory of this.accessories) {
      accessory.informOnZigbee2MqttOnlineStateChange(isOnline);
    }
  }

  private onMqttConnected(): void {
    this.log.info('Connected to MQTT server');
    if (this.connectionPreviouslyClosed) {
      if (this.lastZigbee2MqttState !== 'offline') {
        this.log.debug('Update availability for all devices now that MQTT connection is recovered.');
        this.updateServerAvailabilityForAllDevices(true);
      } else {
        this.log.debug('MQTT connection recovered, but last Zigbee2MQTT state was offline. Not updating availability.');
      }
    }
    this.connectionPreviouslyClosed = false;

    if (!this.didReceiveDevices) {
      setTimeout(() => {
        if (!this.didReceiveDevices) {
          this.log.error(
            'DID NOT RECEIVE ANY DEVICES AFTER BEING CONNECTED FOR TWO MINUTES.\n' +
              `Please verify that Zigbee2MQTT is running and that it is v${Zigbee2mqttPlatform.MIN_Z2M_VERSION} or newer.`
          );
        }
      }, 120000);
    }
  }

  private onMqttClose(): void {
    // Only handle the first time a connection is lost.
    if (this.connectionPreviouslyClosed) {
      return;
    }
    this.connectionPreviouslyClosed = true;

    this.log.error('Disconnected from MQTT server!');

    // Mark all accessories as offline
    this.updateServerAvailabilityForAllDevices(false);
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  private onMessage(topic: string, payload: Buffer) {
    const fullTopic = topic;
    try {
      const baseTopic = `${this.config?.mqtt.base_topic}/`;
      if (!topic.startsWith(baseTopic)) {
        this.log.debug('Ignore message, because topic is unexpected.', topic);
        return;
      }

      topic = topic.substring(baseTopic.length);

      let updateGroups = false;
      let updateDevices = false;

      if (topic.startsWith(Zigbee2mqttPlatform.TOPIC_BRIDGE)) {
        topic = topic.substring(Zigbee2mqttPlatform.TOPIC_BRIDGE.length);
        if (topic === 'devices') {
          // Update accessories
          this.lastReceivedDevices = JSON.parse(payload.toString());

          if (this.config?.exclude_grouped_devices === true) {
            if (this.lastReceivedGroups.length === 0) {
              this.deviceUpdatePending = true;
            } else {
              updateDevices = true;
            }
          } else {
            updateDevices = true;
          }

          if (this.groupUpdatePending) {
            updateGroups = true;
            this.groupUpdatePending = false;
          }
        } else if (topic === 'groups') {
          this.lastReceivedGroups = JSON.parse(payload.toString());
          if (this.lastReceivedDevices.length === 0) {
            this.groupUpdatePending = true;
          } else {
            updateGroups = true;
          }
          if (this.deviceUpdatePending) {
            updateDevices = true;
            this.deviceUpdatePending = false;
          }
        } else if (topic === 'state') {
          const state = payload.toString();
          if (state !== this.lastZigbee2MqttState) {
            this.lastZigbee2MqttState = state;
            const isOnline = state !== 'offline';
            if (!isOnline) {
              this.log.error('Zigbee2MQTT is OFFLINE!');
              this.zigbee2MqttHasBeenOffline = true;
            } else {
              this.log.info('Zigbee2MQTT is ONLINE');
            }
            // Only update if Zigbee2MQTT has been offline while Homebridge was active.
            if (this.zigbee2MqttHasBeenOffline) {
              this.updateServerAvailabilityForAllDevices(isOnline);
            }
          }
        } else if (topic === 'info' || topic === 'config') {
          // New topic (bridge/info) and legacy topic (bridge/config) should both contain the version number.
          this.checkZigbee2MqttVersionAndConfig(payload.toString(), fullTopic);
        }
      } else if (topic.endsWith(Zigbee2mqttPlatform.TOPIC_SUFFIX_AVAILABILITY)) {
        this.handleDeviceAvailability(topic, payload.toString());
      } else if (!topic.endsWith('/get') && !topic.endsWith('/set')) {
        // Probably a status update from a device
        this.handleDeviceUpdate(topic, payload.toString());
      }

      if (updateDevices) {
        this.handleReceivedDevices(this.lastReceivedDevices);
      }
      if (updateGroups) {
        this.createGroupAccessories(this.lastReceivedGroups);
      }
      if (updateDevices || updateGroups) {
        this.removeStaleDevices();
      }
    } catch (err) {
      this.log.error(`Failed to process MQTT message on '${fullTopic}'. (Maybe check the MQTT version?)`);
      this.log.error(errorToString(err));
    }
  }

  private checkZigbee2MqttVersionAndConfig(payload: string, fullTopic: string) {
    const info = JSON.parse(payload);
    if ('version' in info) {
      if (info.version !== this.lastReceivedZigbee2MqttVersion) {
        // Only log the version if it is different from what we have previously received.
        this.lastReceivedZigbee2MqttVersion = info.version;
        this.log.info(`Using Zigbee2MQTT v${info.version} (identified via ${fullTopic})`);
      }

      // Ignore -dev suffix if present, because Zigbee2MQTT appends this to the latest released version
      // for the future development build (instead of applying semantic versioning).
      const strippedVersion = info.version.replace(/-dev$/, '');

      if (semver.lt(strippedVersion, Zigbee2mqttPlatform.MIN_Z2M_VERSION)) {
        this.log.error(
          '!!!UPDATE OF ZIGBEE2MQTT REQUIRED!!! \n' +
            `Zigbee2MQTT v${info.version} is TOO OLD. The minimum required version is v${Zigbee2mqttPlatform.MIN_Z2M_VERSION}. \n` +
            `This means that ${PLUGIN_NAME} MIGHT NOT WORK AS EXPECTED!`
        );
      }
    } else {
      this.log.error(`No version found in message on '${fullTopic}'.`);
    }

    // Also check for potentially incorrect configurations:
    if ('config' in info) {
      const outputFormat = info.config.experimental?.output;
      if (outputFormat !== undefined) {
        if (!outputFormat.includes('json')) {
          this.log.error(
            'Zigbee2MQTT MUST output JSON in order for this plugin to work correctly. ' +
              `Currently 'experimental.output' is set to '${outputFormat}'. Please adjust your configuration.`
          );
        } else {
          this.log.debug(`Zigbee2MQTT 'experimental.output' is set to '${outputFormat}'`);
        }
      }

      // Check availability configuration
      this.processAvailabilityConfig(info);
    }
  }

  private processAvailabilityConfig(config) {
    const currentAvailabilityConfig = this.availabilityIsEnabledGlobally;
    this.availabilityIsEnabledGlobally = isAvailabilityEnabledGlobally(config);
    this.log.debug(`Zigbee2MQTT availability feature is enabled globally: '${this.availabilityIsEnabledGlobally}'`);

    // Check device configurations
    const devices = getAvailabilityConfigurationForDevices(config, this.log);

    // Find changes in availability configuration
    const changedDevices = [
      ...new Set([
        ...getDiffFromArrays<string>(this.availabilityEnabledDevices, devices.enabled),
        ...getDiffFromArrays<string>(this.availabilityDisabledDevices, devices.disabled),
      ]),
    ];

    // Copy new values
    this.availabilityEnabledDevices = devices.enabled;
    this.availabilityDisabledDevices = devices.disabled;

    // Update the necessary devices
    if (this.availabilityIsEnabledGlobally !== currentAvailabilityConfig) {
      // Update availability for all devices
      this.log.debug(`Availability configuration changed from ${currentAvailabilityConfig} to ${this.availabilityIsEnabledGlobally}`);
      for (const accessory of this.accessories) {
        accessory.setAvailabilityEnabled(this.isAvailabilityEnabledForAddress(accessory));
      }
    } else {
      // Only update changed devices
      for (const identifier of changedDevices) {
        const accessory = this.accessories.find((acc) => acc.matchesIdentifier(identifier));
        accessory?.setAvailabilityEnabled(this.isAvailabilityEnabledForAddress(accessory));
      }
    }
  }

  private isAvailabilityEnabledForAddress(device: Zigbee2mqttAccessory): boolean {
    if (this.availabilityEnabledDevices.findIndex((d) => device.matchesIdentifier(d)) >= 0) {
      return true;
    }
    if (this.availabilityDisabledDevices.findIndex((d) => device.matchesIdentifier(d)) >= 0) {
      return false;
    }
    return this.availabilityIsEnabledGlobally;
  }

  private async handleDeviceAvailability(topic: string, statePayload: string) {
    // Check if payload is a JSON object or a plain string
    let isAvailable = statePayload === 'online';
    try {
      const state = JSON.parse(statePayload).availability;
      if ('state' in state) {
        isAvailable = state.state === 'online';
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      // Ignore error as the string payload version is handled above
    }
    const deviceTopic = topic.slice(0, -1 * Zigbee2mqttPlatform.TOPIC_SUFFIX_AVAILABILITY.length);
    const accessory = this.accessories.find((acc) => acc.matchesIdentifier(deviceTopic));
    if (accessory) {
      try {
        accessory.updateAvailability(isAvailable);
        this.log.debug(`Handled device availability update for ${deviceTopic}: ${statePayload}`);
      } catch (err) {
        this.log.error(`Failed to process availability update with payload: ${statePayload}`);
        this.log.error(errorToString(err));
      }
    } else {
      this.log.debug(`Unhandled message on topic: ${topic}`);
    }
  }

  private async handleDeviceUpdate(topic: string, statePayload: string) {
    if (statePayload === '') {
      this.log.debug('Ignore update, because payload is empty.', topic);
      return;
    }

    const accessory = this.accessories.find((acc) => acc.matchesIdentifier(topic));
    if (accessory) {
      try {
        const state = JSON.parse(statePayload);
        accessory.updateStates(state);
        this.log.debug(`Handled device update for ${topic}: ${statePayload}`);
      } catch (err) {
        this.log.error(`Failed to process status update with payload: ${statePayload}`);
        this.log.error(errorToString(err));
      }
    } else {
      this.log.debug(`Unhandled message on topic: ${topic}`);
    }
  }

  private removeStaleDevices(): void {
    // Remove devices that are no longer present
    const staleAccessories: PlatformAccessory[] = [];
    for (let i = this.accessories.length - 1; i >= 0; --i) {
      const foundIndex = this.lastReceivedDevices.findIndex((d) => d.ieee_address === this.accessories[i].ieeeAddress);
      const foundGroupIndex = this.lastReceivedGroups.findIndex((g) => g.id === this.accessories[i].groupId);
      if ((foundIndex < 0 && foundGroupIndex < 0) || this.isDeviceExcluded(this.accessories[i].accessory.context.device)) {
        // Not found or excluded; remove it.
        this.log.debug(`Removing accessory ${this.accessories[i].displayName} (${this.accessories[i].ieeeAddress})`);
        staleAccessories.push(this.accessories[i].accessory);
        this.accessories.splice(i, 1);
      }
    }
    if (staleAccessories.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }
  }

  private handleReceivedDevices(devices: DeviceListEntry[]) {
    this.log.debug('Received devices...');
    this.didReceiveDevices = true;
    devices.forEach((d) => this.createOrUpdateAccessory(d));
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.addAccessory(accessory);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static getIdentifiersFromDevice(device: any): string[] {
    const identifiers: string[] = [];
    if (typeof device === 'string') {
      identifiers.push(device.toLocaleLowerCase());
    } else {
      if ('ieee_address' in device) {
        identifiers.push(device.ieee_address.toLocaleLowerCase());
      }
      if ('friendly_name' in device) {
        identifiers.push(device.friendly_name.toLocaleLowerCase());
      }
      if ('id' in device) {
        identifiers.push(device.id.toString().toLocaleLowerCase());
      }
    }
    return identifiers;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getAdditionalConfigForDevice(device: any): BaseDeviceConfiguration {
    if (this.config?.devices !== undefined) {
      const identifiers = Zigbee2mqttPlatform.getIdentifiersFromDevice(device);

      for (const devConfig of this.config.devices) {
        if (identifiers.includes(devConfig.id.toLocaleLowerCase())) {
          return this.mergeDeviceConfig(devConfig);
        }
      }
    }

    return this.baseDeviceConfig;
  }

  private mergeDeviceConfig(devConfig: DeviceConfiguration): BaseDeviceConfiguration {
    const result = { ...this.baseDeviceConfig, ...devConfig };

    // Merge converter configs correctly
    if (this.baseDeviceConfig.converters !== undefined && devConfig.converters !== undefined) {
      result.converters = { ...this.baseDeviceConfig.converters, ...devConfig.converters };
    }

    if (result.experimental !== undefined) {
      // Normalize experimental feature flags
      result.experimental = result.experimental.map((feature: string) => feature.trim().toLocaleUpperCase());
    }

    return result;
  }

  private isDeviceExcluded(device: DeviceListEntry | string): boolean {
    const additionalConfig = this.getAdditionalConfigForDevice(device);
    if (additionalConfig?.exclude === true) {
      this.log.debug(`Device is excluded: ${additionalConfig.id}`);
      return true;
    }
    if (additionalConfig?.exclude === false) {
      // Device is explicitly NOT excluded (via device config or default device config)
      return false;
    }

    if (this.config?.exclude_grouped_devices === true && this.lastReceivedGroups !== undefined) {
      const id = typeof device === 'string' ? device : device.ieee_address;
      for (const group of this.lastReceivedGroups) {
        if (group.members.findIndex((m) => m.ieee_address === id) >= 0) {
          this.log.debug(`Device (${id}) is excluded because it is in a group: ${group.friendly_name} (${group.id})`);
          return true;
        }
      }
    }
    return false;
  }

  private addAccessory(accessory: PlatformAccessory) {
    const ieee_address = accessory.context.device.ieee_address ?? accessory.context.device.ieeeAddr;
    if (this.isDeviceExcluded(accessory.context.device)) {
      this.log.warn(`Excluded device found on startup: ${accessory.context.device.friendly_name} (${ieee_address}).`);
      process.nextTick(() => {
        try {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } catch (err) {
          this.log.error('Failed to delete accessory.');
          this.log.error(errorToString(err));
        }
      });
      return;
    }

    if (!isDeviceListEntry(accessory.context.device)) {
      this.log.error(
        `DEPRECATED: Restoring old (pre v1.0.0) accessory ${accessory.context.device.friendly_name} (${ieee_address}). This accessory ` +
          `will not work until updated device information is received from Zigbee2MQTT v${Zigbee2mqttPlatform.MIN_Z2M_VERSION} or newer.` +
          'This functionality will be removed in a future version.'
      );
    }

    if (this.accessories.findIndex((acc) => acc.UUID === accessory.UUID) < 0) {
      // New entry
      this.log.info(`Restoring accessory: ${accessory.displayName} (${ieee_address})`);
      const acc = new Zigbee2mqttAccessory(this, accessory, this.getAdditionalConfigForDevice(accessory.context.device));
      this.accessories.push(acc);
    }
  }

  private createOrUpdateAccessory(device: DeviceListEntry) {
    if (!isDeviceDefinition(device.definition) || this.isDeviceExcluded(device)) {
      return;
    }
    const uuid_input = isDeviceListEntryForGroup(device) ? `group-${device.group_id}` : device.ieee_address;
    const uuid = this.api.hap.uuid.generate(uuid_input);
    const existingAcc = this.accessories.find((acc) => acc.UUID === uuid);
    if (existingAcc) {
      existingAcc.updateDeviceInformation(device);
      existingAcc.setAvailabilityEnabled(this.isAvailabilityEnabledForAddress(existingAcc));
    } else {
      // New entry
      const sanitized_name = sanitizeAccessoryName(device.friendly_name);
      this.log.info(`New accessory: ${device.friendly_name} (${sanitized_name})`);
      const accessory = new this.api.platformAccessory(sanitized_name, uuid);
      accessory.context.device = device;
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      const acc = new Zigbee2mqttAccessory(this, accessory, this.getAdditionalConfigForDevice(device));
      this.accessories.push(acc);
      acc.setAvailabilityEnabled(this.isAvailabilityEnabledForAddress(acc));
    }
  }

  isConnected(): boolean {
    return this.mqttClient !== undefined && !this.mqttClient.reconnecting;
  }

  async publishMessage(topic: string, payload: string, options: mqtt.IClientPublishOptions) {
    if (this.config !== undefined) {
      topic = `${this.config.mqtt.base_topic}/${topic}`;
      options = { qos: 0, retain: false, ...options };
      if (!this.isConnected) {
        this.log.error('Not connected to MQTT server!');
        this.log.error(`Cannot send message to '${topic}': '${payload}`);
        return;
      }

      this.log.log((this.config?.log?.mqtt_publish ?? LogLevel.DEBUG) as LogLevel, `Publish to '${topic}': '${payload}'`);

      return new Promise<void>((resolve) => {
        this.mqttClient?.publish(topic, payload, options, () => resolve());
      });
    }
  }

  private createGroupAccessories(groups: GroupListEntry[]) {
    this.log.debug('Received groups...');
    for (const group of groups) {
      const device = this.createDeviceListEntryFromGroup(group);
      if (device !== undefined) {
        this.createOrUpdateAccessory(device);
      }
    }
  }

  private createDeviceListEntryFromGroup(group: GroupListEntry): DeviceListEntryForGroup | undefined {
    let exposes = this.determineExposesForGroup(group);
    if (exposes.length === 0) {
      // No exposes found. Check if additional config is given.
      const config = this.getAdditionalConfigForDevice(group);
      if (
        config !== undefined &&
        (config.exclude === undefined || config.exclude === false) &&
        isDeviceConfiguration(config) &&
        config.exposes !== undefined &&
        config.exposes.length > 0
      ) {
        // Additional config is given and it is not excluded.
        exposes = config.exposes;
      } else {
        // No exposes info found, so can't expose the group
        this.log.debug(`Group ${group.friendly_name} (${group.id}) has no usable exposes information.`);
        return undefined;
      }
    } else {
      // Exposes found.
      this.log.debug(`Group ${group.friendly_name} (${group.id}) exposes (auto-determined):\n${JSON.stringify(exposes, null, 2)}`);
    }

    const device: DeviceListEntryForGroup = {
      friendly_name: group.friendly_name,
      ieee_address: group.id.toString(),
      group_id: group.id,
      supported: true,
      definition: {
        vendor: 'Zigbee2MQTT',
        model: `GROUP-${group.id}`,
        exposes: exposes,
      },
    };

    return device;
  }

  private determineExposesForGroup(group: GroupListEntry): ExposesEntry[] {
    let exposes: ExposesEntry[] = [];
    let firstEntry = true;
    for (const member of group.members) {
      const device = this.lastReceivedDevices.find((dev) => dev.ieee_address === member.ieee_address);
      if (device === undefined) {
        this.log.warn(`Cannot find group member in devices: ${member.ieee_address}`);
        continue;
      }

      if (device.definition?.exposes === undefined) {
        this.log.warn(`No exposes info for group member: ${member.ieee_address}`);
        continue;
      }

      if (firstEntry) {
        // Exclude link quality information
        exposes = device.definition.exposes.filter((e) => e.name !== 'linkquality');
        firstEntry = false;
      } else {
        // Try to merge exposes
        exposes = exposesGetOverlap(exposes, device.definition.exposes);
      }
    }
    return exposes;
  }
}
