import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Zigbee2mqttAccessory } from './platformAccessory';
import { Zigbee2mqttDeviceInfo } from './models';

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

    if (!config.mqtt.server || !config.mqtt.base_topic) {
      this.log.error('No MQTT server and/or base_topic defined!');
    }
    this.log.info(`Connecting to MQTT server at ${config.mqtt.server}`);

    const options: mqtt.IClientOptions = {};

    if (config.mqtt.version) {
      options.protocolVersion = config.mqtt.version;
    }

    if (config.mqtt.keepalive) {
      this.log.debug(`Using MQTT keepalive: ${config.mqtt.keepalive}`);
      options.keepalive = config.mqtt.keepalive;
    }

    if (config.mqtt.ca) {
      this.log.debug(`MQTT SSL/TLS: Path to CA certificate = ${config.mqtt.ca}`);
      options.ca = fs.readFileSync(config.mqtt.ca);
    }

    if (config.mqtt.key && config.mqtt.cert) {
      this.log.debug(`MQTT SSL/TLS: Path to client key = ${config.mqtt.key}`);
      this.log.debug(`MQTT SSL/TLS: Path to client certificate = ${config.mqtt.cert}`);
      options.key = fs.readFileSync(config.mqtt.key);
      options.cert = fs.readFileSync(config.mqtt.cert);
    }

    if (config.mqtt.user && config.mqtt.password) {
      options.username = config.mqtt.user;
      options.password = config.mqtt.password;
    }

    if (config.mqtt.client_id) {
      this.log.debug(`Using MQTT client ID: '${config.mqtt.client_id}'`);
      options.clientId = config.mqtt.client_id;
    }

    if ('reject_unauthorized' in config.mqtt && !config.mqtt.reject_unauthorized) {
      this.log.debug('MQTT reject_unauthorized set false, ignoring certificate warnings.');
      options.rejectUnauthorized = false;
    }

    this.MqttClient = mqtt.connect(config.mqtt.server, options);
    this.MqttClient.on('connect', () => {
      this.log.info('Connected to MQTT server');
    });

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');

      // Setup MQTT callbacks and subscription
      this.MqttClient.on('message', this.onMessage);
      this.MqttClient.subscribe(config.mqtt.base_topic + '/#');

      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  private onMessage(topic: string, payload: Buffer) {
    if (!topic.startsWith(`${this.config.mqtt.base_topic}/`)) {
      this.log.debug('Ignore message, because topic is unexpected.', topic);
      return;
    }

    topic = topic.substr(this.config.mqtt.base_topic.length + 1);

    if (topic === 'bridge/config/devices') {
      // Update accessories
      const devices: Zigbee2mqttDeviceInfo[] = JSON.parse(payload.toString());
      this.handleReceivedDevices(devices);
    } else if (topic.indexOf('/') === -1) {
      const state = JSON.parse(payload.toString());
      // Probably a status update from a device
      this.handleDeviceUpdate(topic, state);
    } else {
      this.log.debug(`Received message on '${topic}', but it was not handled`);
    }
  }

  private async handleDeviceUpdate(topic: string, state: Record<string, unknown>) {
    const accessory = this.accessories.find((acc) => acc.matchesIdentifier(topic));
    if (accessory) {
      accessory.updateStates(state);
    } else {
      this.log.debug(`Device '${topic}' not found for update.`);
    }
  }

  private handleReceivedDevices(devices: Zigbee2mqttDeviceInfo[]) {
    devices.forEach((device) => {
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
      if (foundIndex < 0) {
        // Not found; remove it.
        staleAccessories.push(this.accessories[i].accessory);
        this.accessories.splice(i, 1);
      }
    }
    if (staleAccessories.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.debug('Loading accessory from cache:', accessory.displayName);
    this.addAccessory(accessory);
  }

  private addAccessory(accessory: PlatformAccessory) {
    if (this.accessories.findIndex((acc) => acc.UUID === accessory.UUID) < 0) {
      // New entry
      this.log.info('Adding accessory', accessory.displayName);
      const acc = new Zigbee2mqttAccessory(this, accessory);
      this.accessories.push(acc);
    }
  }

  private createOrUpdateAccessory(device: Zigbee2mqttDeviceInfo) {
    const uuid = this.api.hap.uuid.generate(device.ieeeAddr);
    const existingAcc = this.accessories.find((acc) => acc.UUID === uuid);
    if (existingAcc) {
      existingAcc.updateDeviceInformation(device);
    } else {
      // New entry
      this.log.info('Creating accessory', device.friendly_name);
      const accessory = new this.api.platformAccessory(device.friendly_name, uuid);
      accessory.context.device = device;
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      const acc = new Zigbee2mqttAccessory(this, accessory);
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
    topic = `${this.config.mqtt.base_topic}/${topic}`;
    options = { qos: 0, retain: false, ...options };
    if (!this.isConnected) {
      this.log.error('Not connected to MQTT server!');
      this.log.error(`Cannot send message: topic: '${topic}', payload: '${payload}`);
      return;
    }

    this.log.info(`MQTT publish: topic '${topic}', payload '${payload}'`);

    return new Promise((resolve) => {
      this.MqttClient.publish(topic, payload, options, () => resolve());
    });
  }
}
