import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Zigbee2mqttAccessory } from './platformAccessory';
import { Zigbee2mqttDeviceInfo, isDeviceInfo } from './models';
import { MqttConfiguration } from './configModels';

import * as mqtt from 'mqtt';
import * as fs from 'fs';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class Zigbee2mqttPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private readonly MqttClient: mqtt.MqttClient;

  // this is used to track restored cached accessories
  private readonly accessories: Zigbee2mqttAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.onMessage = this.onMessage.bind(this);

    if (!this.mqttConfig.server || !this.mqttConfig.base_topic) {
      this.log.error('No MQTT server and/or base_topic defined!');
    }
    this.log.info(`Connecting to MQTT server at ${this.mqttConfig.server}`);

    const options: mqtt.IClientOptions = {};

    if (this.mqttConfig.version) {
      options.protocolVersion = this.mqttConfig.version;
    }

    if (this.mqttConfig.keepalive) {
      this.log.debug(`Using MQTT keepalive: ${this.mqttConfig.keepalive}`);
      options.keepalive = this.mqttConfig.keepalive;
    }

    if (this.mqttConfig.ca) {
      this.log.debug(`MQTT SSL/TLS: Path to CA certificate = ${this.mqttConfig.ca}`);
      options.ca = fs.readFileSync(this.mqttConfig.ca);
    }

    if (this.mqttConfig.key && this.mqttConfig.cert) {
      this.log.debug(`MQTT SSL/TLS: Path to client key = ${this.mqttConfig.key}`);
      this.log.debug(`MQTT SSL/TLS: Path to client certificate = ${this.mqttConfig.cert}`);
      options.key = fs.readFileSync(this.mqttConfig.key);
      options.cert = fs.readFileSync(this.mqttConfig.cert);
    }

    if (this.mqttConfig.user && this.mqttConfig.password) {
      options.username = this.mqttConfig.user;
      options.password = this.mqttConfig.password;
    }

    if (this.mqttConfig.client_id) {
      this.log.debug(`Using MQTT client ID: '${this.mqttConfig.client_id}'`);
      options.clientId = this.mqttConfig.client_id;
    }

    if ('reject_unauthorized' in this.mqttConfig && !this.mqttConfig.reject_unauthorized) {
      this.log.debug('MQTT reject_unauthorized set false, ignoring certificate warnings.');
      options.rejectUnauthorized = false;
    }

    this.MqttClient = mqtt.connect(this.mqttConfig.server, options);
    this.MqttClient.on('connect', () => {
      this.log.info('Connected to MQTT server');
    });

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      // Setup MQTT callbacks and subscription
      this.MqttClient.on('message', this.onMessage);
      this.MqttClient.subscribe(this.mqttConfig.base_topic + '/#');

      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  get mqttConfig(): MqttConfiguration {
    return this.config.mqtt as MqttConfiguration;
  }

  private onMessage(topic: string, payload: Buffer) {
    try {
      if (!topic.startsWith(`${this.mqttConfig.base_topic}/`)) {
        this.log.debug('Ignore message, because topic is unexpected.', topic);
        return;
      }

      topic = topic.substr(this.mqttConfig.base_topic.length + 1);

      if (topic === 'bridge/config/devices') {
        // Update accessories
        const devices: Zigbee2mqttDeviceInfo[] = JSON.parse(payload.toString());
        this.handleReceivedDevices(devices);
      } else if (topic.indexOf('/') === -1) {
        const state = JSON.parse(payload.toString());
        // Probably a status update from a device
        this.handleDeviceUpdate(topic, state);
      } else {
        this.log.debug(`Unhandled message on topic: ${topic}`);
      }
    } catch (Error) {
      this.log.error('Failed to process MQTT message. (Maybe check the MQTT version?)');
      this.log.error(Error);
    }
  }

  private async handleDeviceUpdate(topic: string, state: Record<string, unknown>) {
    if (!this.isDeviceExcluded(topic)) {
      const accessory = this.accessories.find((acc) => acc.matchesIdentifier(topic));
      if (accessory) {
        accessory.updateStates(state);
      } else {
        this.log.debug(`Device '${topic}' not found for update.`);
      }
    }
  }

  private handleReceivedDevices(devices: Zigbee2mqttDeviceInfo[]) {
    devices.forEach((device) => {
      if (this.isDeviceExcluded(device)) {
        return;
      }
      if (device.friendly_name === 'Coordinator' || device.type === 'Coordinator') {
        // skip coordinator
        this.log.debug('Skip Coordinator with IEEE address:', device.ieeeAddr);
        return;
      }
      this.createOrUpdateAccessory(device);
    });

    // Remove devices that are no longer present
    const staleAccessories: PlatformAccessory[] = [];
    for (let i = this.accessories.length - 1; i >= 0; --i) {
      const foundIndex = devices.findIndex((d) => d.ieeeAddr === this.accessories[i].ieeeAddress);
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

  private getAdditionalConfigForDevice(device: Zigbee2mqttDeviceInfo | string): Record<string, unknown> | undefined {
    if (Array.isArray(this.config?.devices)) {
      const identifiers : string[] = [];
      if (isDeviceInfo(device)) {
        identifiers.push(device.ieeeAddr.toLocaleLowerCase());
        identifiers.push(device.friendly_name.toLocaleLowerCase());
      } else {
        identifiers.push(device.toLocaleLowerCase());
      }

      for (const devConfig of this.config.devices) {
        if ('id' in devConfig) {
          try {
            if (identifiers.includes(devConfig.id.toLocaleLowerCase())) {
              return devConfig;
            }
          } catch(error) {
            this.log.error(`Unable to process device configuration for '${devConfig.id}'.`);
            this.log.error(error);
          }
        } else {
          this.log.warn('Configuration contains a device without the required id field.');
        }
      }
    }
    return undefined;
  }

  private isDeviceExcluded(device: Zigbee2mqttDeviceInfo | string): boolean {
    const additionalConfig = this.getAdditionalConfigForDevice(device);
    if (additionalConfig !== undefined && additionalConfig.exclude) {
      this.log.debug(`Device is excluded: ${additionalConfig.id}`);
      return true;
    }
    return false;
  }

  private addAccessory(accessory: PlatformAccessory) {
    if (this.isDeviceExcluded(accessory.context.device)) {
      this.log.warn(`Excluded device found on startup: ${accessory.context.device.friendly_name} (${accessory.context.device.ieeeAddr}).`);
      process.nextTick(() => {  
        try {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } catch (error) {
          this.log.error('Trying to delete accessory because it is excluded.');
          this.log.error(error);
        }
      });
      return;
    }

    if (this.accessories.findIndex((acc) => acc.UUID === accessory.UUID) < 0) {
      // New entry
      this.log.info('Restoring accessory:', accessory.displayName);
      const acc = new Zigbee2mqttAccessory(this, accessory, this.getAdditionalConfigForDevice(accessory.context.device));
      this.accessories.push(acc);
    }
  }

  private createOrUpdateAccessory(device: Zigbee2mqttDeviceInfo) {
    if (this.isDeviceExcluded(device)) {
      return;
    }
    const uuid = this.api.hap.uuid.generate(device.ieeeAddr);
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

  private async discoverDevices() {
    await this.publishMessage('bridge/config/devices/get', '', {});
  }

  isConnected(): boolean {
    return this.MqttClient && !this.MqttClient.reconnecting;
  }

  async publishMessage(topic: string, payload: string, options: mqtt.IClientPublishOptions) {
    topic = `${this.mqttConfig.base_topic}/${topic}`;
    options = { qos: 0, retain: false, ...options };
    if (!this.isConnected) {
      this.log.error('Not connected to MQTT server!');
      this.log.error(`Cannot send message to '${topic}': '${payload}`);
      return;
    }

    this.log.info(`Publish to '${topic}': '${payload}'`);

    return new Promise((resolve) => {
      this.MqttClient.publish(topic, payload, options, () => resolve());
    });
  }
}
