import { LogLevel, PlatformConfig } from 'homebridge';
import { ConverterConfigValidatorCollection } from './converters/creators';
import { BasicLogger } from './logger';
import { ExposesEntry, isExposesEntry } from './z2mModels';

export interface PluginConfiguration extends PlatformConfig {
  mqtt: MqttConfiguration;
  log?: LogConfiguration;
  defaults?: BaseDeviceConfiguration;
  experimental?: string[];
  devices?: DeviceConfiguration[];
  exclude_grouped_devices?: boolean;
}

function hasValidConverterConfigurations(
  config: BaseDeviceConfiguration,
  converterConfigValidator: ConverterConfigValidatorCollection,
  logger: BasicLogger | undefined
): boolean {
  return config.converters === undefined || converterConfigValidator.allConverterConfigurationsAreValid(config.converters, logger);
}

function hasValidDeviceConfigurations(
  devices: unknown,
  converterConfigValidator: ConverterConfigValidatorCollection,
  logger: BasicLogger | undefined
): boolean {
  if (devices !== undefined) {
    if (!Array.isArray(devices)) {
      logger?.error('Incorrect configuration: devices must be an array');
      return false;
    }
    for (const element of devices) {
      if (!isDeviceConfiguration(element) || !hasValidConverterConfigurations(element, converterConfigValidator, logger)) {
        logger?.error('Incorrect configuration: Entry for device is not correct: ' + JSON.stringify(element));
        return false;
      }
    }
  }
  return true;
}

export const isPluginConfiguration = (
  x: PlatformConfig,
  converterConfigValidator: ConverterConfigValidatorCollection,
  logger: BasicLogger | undefined = undefined
): x is PluginConfiguration => {
  if (x.mqtt === undefined || !isMqttConfiguration(x.mqtt)) {
    logger?.error('Incorrect configuration: mqtt does not contain required fields');
    return false;
  }

  if (x.log !== undefined && !isLogConfiguration(x.log)) {
    logger?.error('Incorrect configuration: log configuration is invalid: ' + JSON.stringify(x.log));
  }

  if (x.defaults !== undefined) {
    if (!isBaseDeviceConfiguration(x.defaults)) {
      logger?.error('Incorrect configuration: Device defaults are incorrect: ' + JSON.stringify(x.defaults));
      return false;
    }
    if (!hasValidConverterConfigurations(x.defaults, converterConfigValidator, logger)) {
      logger?.error('Incorrect configuration: Invalid converter configuration in device defaults.');
      return false;
    }
  }

  if (x.experimental !== undefined && !isStringArray(x.experimental)) {
    logger?.error('Incorrect configuration: Experimental flags are incorrect ' + JSON.stringify(x.experimental));
    return false;
  }

  if (x.exclude_grouped_devices !== undefined && typeof x.exclude_grouped_devices !== 'boolean') {
    logger?.error('Incorrect configuration: exclude_grouped_devices must be a boolean, if defined.');
    return false;
  }

  return hasValidDeviceConfigurations(x.devices, converterConfigValidator, logger);
};

export interface LogConfiguration extends Record<string, unknown> {
  mqtt_publish?: string;
}

const allowedLogLevels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isLogConfiguration = (x: any): x is LogConfiguration =>
  !(x.mqtt_publish !== undefined && typeof x.mqtt_publish !== 'string' && !allowedLogLevels.includes(x.mqtt_publish));
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
export const isMqttConfiguration = (x: any): x is MqttConfiguration =>
  x.base_topic !== undefined &&
  typeof x.base_topic === 'string' &&
  x.base_topic.length > 0 &&
  x.server !== undefined &&
  typeof x.server === 'string' &&
  x.server.length > 0;

export interface BaseDeviceConfiguration extends Record<string, unknown> {
  exclude?: boolean;
  excluded_keys?: string[];
  excluded_endpoints?: string[];
  values?: PropertyValueConfiguration[];
  converters?: object;
  experimental?: string[];
  ignore_availability?: boolean;
}

export interface DeviceConfiguration extends BaseDeviceConfiguration {
  id: string;
  included_keys?: string[];
  exposes?: ExposesEntry[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hasOptionalStringArrays = (object: any, ...properties: string[]): boolean => {
  // Check if properties exist and are string arrays
  for (const property of properties) {
    if (property in object && object[property] !== undefined && !isStringArray(object[property])) {
      return false;
    }
  }
  return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isBaseDeviceConfiguration = (x: any): x is BaseDeviceConfiguration => {
  // Optional boolean exclude property
  if (x.exclude !== undefined && typeof x.exclude !== 'boolean') {
    return false;
  }
  // Optional boolean ignore_availability property
  if (x.ignore_availability !== undefined && typeof x.ignore_availability !== 'boolean') {
    return false;
  }

  // Optional string arrays
  if (!hasOptionalStringArrays(x, 'excluded_keys', 'excluded_endpoints', 'experimental')) {
    return false;
  }

  // Optional 'converters' must be an object if present
  if (x.converters !== undefined && typeof x.converters !== 'object') {
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

  // Optional included_keys which must be an array of strings if present
  if (x.included_keys !== undefined && !isStringArray(x.included_keys)) {
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
  return x.exclude === undefined || isStringArray(x.exclude);
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
