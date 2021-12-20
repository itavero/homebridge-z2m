import { PlatformConfig, Logger } from 'homebridge';
import { ExposesEntry, isExposesEntry } from './z2mModels';

export interface PluginConfiguration extends PlatformConfig {
  mqtt: MqttConfiguration;
  defaults?: BaseDeviceConfiguration;
  experimental?: string[];
  devices?: DeviceConfiguration[];
  exclude_grouped_devices?: boolean;
}

export const isPluginConfiguration = (x: PlatformConfig, logger: Logger | undefined = undefined): x is PluginConfiguration => {
  if (x.mqtt === undefined || !isMqttConfiguration(x.mqtt)) {
    logger?.error('Incorrect configuration: mqtt does not contain required fields');
    return false;
  }

  if (x.defaults !== undefined && !isBaseDeviceConfiguration(x.defaults)) {
    logger?.error('Incorrect configuration: Device defaults are incorrect: ' + JSON.stringify(x.defaults));
    return false;
  }

  if (x.experimental !== undefined && !isStringArray(x.experimental)) {
    logger?.error('Incorrect configuration: Experimental flags are incorrect ' + JSON.stringify(x.experimental));
    return false;
  }

  if (x.exclude_grouped_devices !== undefined && typeof x.exclude_grouped_devices !== 'boolean') {
    logger?.error('Incorrect configuration: exclude_grouped_devices must be a boolean, if defined.');
    return false;
  }

  if (x.devices !== undefined) {
    if (!Array.isArray(x.devices)) {
      logger?.error('Incorrect configuration: devices must be an array');
      return false;
    }
    for (const element of x.devices) {
      if (!isDeviceConfiguration(element)) {
        logger?.error('Incorrect configuration: Entry for device is not correct: ' + JSON.stringify(element));
        return false;
      }
    }
  }
  return true;
};

export interface MqttConfiguration extends Record<string, unknown> {
  base_topic: string;
  server: string;
  ca?: string;
  key?: string;
  cert?: string;
  user?: string;
  password?: string;
  client_id?: string;
  reject_unauthorized?: boolean;
  keepalive?: number;
  version?: number;
  disable_qos?: boolean;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isMqttConfiguration = (x: any): x is MqttConfiguration => (
  x.base_topic !== undefined
  && typeof x.base_topic === 'string'
  && x.base_topic.length > 0
  && x.server !== undefined
  && typeof x.server === 'string'
  && x.server.length > 0);

export interface BaseDeviceConfiguration extends Record<string, unknown> {
  exclude?: boolean;
  excluded_keys?: string[];
  values?: PropertyValueConfiguration[];
  experimental?: string[];
}

export interface DeviceConfiguration extends BaseDeviceConfiguration {
  id: string;
  exposes?: ExposesEntry[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isBaseDeviceConfiguration = (x: any): x is BaseDeviceConfiguration => {
  // Optional boolean exclude property
  if (x.exclude !== undefined && typeof x.exclude !== 'boolean') {
    return false;
  }

  // Optional excluded_keys which must be an array of strings if present
  if (x.excluded_keys !== undefined && !isStringArray(x.excluded_keys)) {
    return false;
  }

  // Optional 'experimental' which must be an array of strings if present
  if (x.experimental !== undefined && !isStringArray(x.experimental)) {
    return false;
  }

  // Optional values property which must be an array of PropertyValueConfigurations if present
  if (x.values !== undefined) {
    if (!Array.isArray(x.values)) {
      return false;
    }
    for (const element of x.values) {
      if (!isPropertyValueConfiguration(element)) {
        return false;
      }
    }
  }
  return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isDeviceConfiguration = (x: any): x is DeviceConfiguration => {
  // Required id property
  if (x.id === undefined || typeof x.id !== 'string' || x.id.length < 1) {
    return false;
  }

  // Check if exposes is an array of ExposesEntry, if configured.
  if (x.exposes !== undefined) {
    if (!Array.isArray(x.exposes)) {
      return false;
    }
    for (const element of x.exposes) {
      if (!isExposesEntry(element)) {
        return false;
      }
    }
  }

  return isBaseDeviceConfiguration(x);
};

export interface PropertyValueConfiguration extends Record<string, unknown> {
  property: string;
  include?: string[];
  exclude?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isPropertyValueConfiguration = (x: any): x is PropertyValueConfiguration => {
  // Required 'property' property
  if (x.property === undefined || typeof x.property !== 'string' || x.property.length < 1) {
    return false;
  }

  // Optional include property
  if (x.include !== undefined && !isStringArray(x.include)) {
    return false;
  }

  // Optional exclude property
  if (x.exclude !== undefined && !isStringArray(x.exclude)) {
    return false;
  }
  return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isStringArray = (x: any): x is string[] => {
  if (!Array.isArray(x)) {
    return false;
  }
  for (const element of x) {
    if (typeof element !== 'string') {
      return false;
    }
  }
  return true;
};