import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Zigbee2mqttAccessory } from './platformAccessory';
import { BaseDeviceConfiguration, DeviceConfiguration, isPluginConfiguration, PluginConfiguration } from './configModels';

import * as mqtt from 'mqtt';
import * as fs from 'fs';
import { DeviceListEntry, isDeviceListEntry } from './z2mModels';
import * as semver from 'semver';

export class Zigbee2mqttPlatform implements DynamicPlatformPlugin {
  public readonly config?: PluginConfiguration;
  private baseDeviceConfig: BaseDeviceConfiguration;
  private readonly mqttClient?: mqtt.MqttClient;
  private static readonly MIN_Z2M_VERSION = '1.17.0';
  private static readonly TOPIC_BRIDGE = 'bridge/';

  // this is used to track restored cached accessories
  private readonly accessories: Zigbee2mqttAccessory[] = [];
  private didReceiveDevices: boolean;

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    // Prepare internal states, variables and such
    this.onMessage = this.onMessage.bind(this);
    this.didReceiveDevices = false;

    // Set device defaults
    this.baseDeviceConfig = {
      excluded: false,
    };

    // Validate configuration
    if (isPluginConfiguration(config, log)) {
      this.config = config;
    } else {
      log.error(`INVALID CONFIGURATION FOR PLUGIN: ${PLUGIN_NAME}\nThis plugin will NOT WORK until this problem is resolved.`);
      return;
    }

    // Use configuration
    if (this.config !== undefined) {

      // Merge defaults from the plugin configuration
      if (this.config.defaults !== undefined) {
        this.baseDeviceConfig = { ...this.baseDeviceConfig, ...this.config.defaults };
      }
      this.log.debug(`Default device config: ${JSON.stringify(this.baseDeviceConfig)}`);

      if (!this.config.mqtt.server || !this.config.mqtt.base_topic) {
        this.log.error('No MQTT server and/or base_topic defined!');
      }
      this.log.info(`Connecting to MQTT server at ${this.config.mqtt.server}`);

      const options: mqtt.IClientOptions = Zigbee2mqttPlatform.createMqttOptions(this.log, this.config);

      this.mqttClient = mqtt.connect(this.config.mqtt.server, options);
      this.mqttClient.on('connect', () => {
        this.log.info('Connected to MQTT server');
        setTimeout(() => {
          if (!this.didReceiveDevices) {
            this.log.error('DID NOT RECEIVE ANY DEVICES AFTER BEING CONNECTED FOR TWO MINUTES.\n'
              + `Please verify that Zigbee2MQTT is running and that it is v${Zigbee2mqttPlatform.MIN_Z2M_VERSION} or newer.`);
          }
        }, 120000);
      });

      this.api.on('didFinishLaunching', () => {
        if (this.config !== undefined) {
          // Setup MQTT callbacks and subscription
          this.mqttClient?.on('message', this.onMessage);
          this.mqttClient?.subscribe(this.config.mqtt.base_topic + '/#');
        }
      });
    }
  }

  private static createMqttOptions(log: Logger, config: PluginConfiguration): mqtt.IClientOptions {
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

  private checkZigbee2MqttVersion(version: string, topic: string) {
    this.log.info(`Using Zigbee2MQTT v${version} (identified via ${topic})`);

    // Ignore -dev suffix if present, because Zigbee2MQTT appends this to the latest released version
    // for the future development build (instead of applying semantic versioning).
    const strippedVersion = version.replace(/-dev$/, '');

    if (semver.lt(strippedVersion, Zigbee2mqttPlatform.MIN_Z2M_VERSION)) {
      this.log.error('!!! UPDATE OF ZIGBEE2MQTT REQUIRED !!! \n' +
        `Zigbee2MQTT v${version} is TOO OLD. The minimum required version is v${Zigbee2mqttPlatform.MIN_Z2M_VERSION}. \n` +
        `This means that ${PLUGIN_NAME} MIGHT NOT WORK AS EXPECTED!`);
    }
  }

  private onMessage(topic: string, payload: Buffer) {
    const fullTopic = topic;
    try {
      const baseTopic = `${this.config?.mqtt.base_topic}/`;
      if (!topic.startsWith(baseTopic)) {
        this.log.debug('Ignore message, because topic is unexpected.', topic);
        return;
      }

      topic = topic.substr(baseTopic.length);

      if (topic.startsWith(Zigbee2mqttPlatform.TOPIC_BRIDGE)) {
        topic = topic.substr(Zigbee2mqttPlatform.TOPIC_BRIDGE.length);
        if (topic === 'devices') {
          // Update accessories
          const devices: DeviceListEntry[] = JSON.parse(payload.toString());
          this.handleReceivedDevices(devices);
        } else if (topic === 'state') {
          const state = payload.toString();
          if (state === 'offline') {
            this.log.error('Zigbee2MQTT is OFFLINE!');
            // TODO Mark accessories as offline somehow.
          }
        } else if (topic === 'info' || topic === 'config') {
          // New topic (bridge/info) and legacy topic (bridge/config) should both contain the version number.
          const info = JSON.parse(payload.toString());
          if ('version' in info) {
            this.checkZigbee2MqttVersion(info['version'], fullTopic);
          } else {
            this.log.error(`No version found in message on '${fullTopic}'.`);
          }

          // Also check for potentially incorrect configurations:
          if ('config' in info) {
            const outputFormat = info.config.experimental?.output;
            if (outputFormat !== undefined) {
              if (!outputFormat.includes('json')) {
                this.log.error('Zigbee2MQTT MUST output JSON in order for this plugin to work correctly. ' +
                  `Currently 'experimental.output' is set to '${outputFormat}'. Please adjust your configuration.`);
              } else {
                this.log.debug(`Zigbee2MQTT 'experimental.output' is set to '${outputFormat}'`);
              }
            }
          }
        }
      } else if (!topic.endsWith('/get') && !topic.endsWith('/set')) {
        // Probably a status update from a device
        this.handleDeviceUpdate(topic, payload.toString());
      }
    } catch (Error) {
      this.log.error(`Failed to process MQTT message on '${fullTopic}'. (Maybe check the MQTT version?)`);
      this.log.error(Error);
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
      } catch (Error) {
        this.log.error(`Failed to process status update with payload: ${statePayload}`);
        this.log.error(Error);
      }
    } else {
      this.log.debug(`Unhandled message on topic: ${topic}`);
    }
  }

  private handleReceivedDevices(devices: DeviceListEntry[]) {
    this.log.debug('Received devices...');
    this.didReceiveDevices = true;
    devices.filter(d => d.supported
      && d.definition !== undefined
      && !this.isDeviceExcluded(d)).forEach(d => this.createOrUpdateAccessory(d));

    // Remove devices that are no longer present
    const staleAccessories: PlatformAccessory[] = [];
    for (let i = this.accessories.length - 1; i >= 0; --i) {
      const foundIndex = devices.findIndex((d) => d.ieee_address === this.accessories[i].ieeeAddress);
      if (foundIndex < 0 || this.isDeviceExcluded(this.accessories[i].accessory.context.device)) {
        // Not found or excluded; remove it.
        staleAccessories.push(this.accessories[i].accessory);
        this.accessories.splice(i, 1);
      }
    }
    if (staleAccessories.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.addAccessory(accessory);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getAdditionalConfigForDevice(device: any): BaseDeviceConfiguration {
    if (this.config?.devices !== undefined) {
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
      }

      for (const devConfig of this.config.devices) {
        if (identifiers.includes(devConfig.id.toLocaleLowerCase())) {
          return this.mergeDeviceConfig(devConfig);
        }
      }
    }

    return this.baseDeviceConfig;
  }

  private mergeDeviceConfig(devConfig: DeviceConfiguration): BaseDeviceConfiguration {
    return { ...this.baseDeviceConfig, ...devConfig };
  }

  private isDeviceExcluded(device: DeviceListEntry | string): boolean {
    const additionalConfig = this.getAdditionalConfigForDevice(device);
    if (additionalConfig?.exclude) {
      this.log.debug(`Device is excluded: ${additionalConfig.id}`);
      return true;
    }
    return false;
  }

  private addAccessory(accessory: PlatformAccessory) {
    const ieee_address = accessory.context.device.ieee_address ?? accessory.context.device.ieeeAddr;
    if (this.isDeviceExcluded(accessory.context.device)) {
      this.log.warn(
        `Excluded device found on startup: ${accessory.context.device.friendly_name} (${ieee_address}).`);
      process.nextTick(() => {
        try {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } catch (error) {
          this.log.error('Failed to delete accessory.');
          this.log.error(error);
        }
      });
      return;
    }

    if (!isDeviceListEntry(accessory.context.device)) {
      this.log.warn(`Restoring old (pre v1.0.0) accessory ${accessory.context.device.friendly_name} (${ieee_address}). This accessory ` +
        `will not work until updated device information is received from Zigbee2MQTT v${Zigbee2mqttPlatform.MIN_Z2M_VERSION} or newer.`);
    }

    if (this.accessories.findIndex((acc) => acc.UUID === accessory.UUID) < 0) {
      // New entry
      this.log.info(`Restoring accessory: ${accessory.displayName} (${ieee_address})`);
      const acc = new Zigbee2mqttAccessory(this, accessory, this.getAdditionalConfigForDevice(accessory.context.device));
      this.accessories.push(acc);
    }
  }

  private createOrUpdateAccessory(device: DeviceListEntry) {
    if (!device.supported || this.isDeviceExcluded(device)) {
      return;
    }
    const uuid = this.api.hap.uuid.generate(device.ieee_address);
    const existingAcc = this.accessories.find((acc) => acc.UUID === uuid);
    if (existingAcc) {
      existingAcc.updateDeviceInformation(device);
    } else {
      // New entry
      this.log.info('New accessory:', device.friendly_name);
      const accessory = new this.api.platformAccessory(device.friendly_name, uuid);
      accessory.context.device = device;
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      const acc = new Zigbee2mqttAccessory(this, accessory, this.getAdditionalConfigForDevice(device));
      this.accessories.push(acc);
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

      this.log.info(`Publish to '${topic}': '${payload}'`);

      return new Promise<void>((resolve) => {
        this.mqttClient?.publish(topic, payload, options, () => resolve());
      });
    }
  }
}