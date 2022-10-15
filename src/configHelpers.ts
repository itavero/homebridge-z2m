import { Logger } from 'homebridge';

/**
 * Check if availability is configured
 * @param config config part of the object published to bridge/info
 * @returns True if availability is configured
 */
export function isAvailabilityEnabledGlobally(config: Record<string, never>): boolean {
  if (config.availability !== undefined && config.availability !== null) {
    // Is it a simple boolean?
    if (typeof config.availability === 'boolean') {
      return config.availability;
    }
    // It is an object with one of the expected keys, so in that case, availability is considered enabled.
    return 'active' in config.availability || 'passive' in config.availability;
  }
  // Default configuration is disabled
  return false;
}

/**
 * Contains all devices that have a certain feature explicitly enabled or disabled.
 */
export interface BooleanDeviceList {
  enabled: string[];
  disabled: string[];
}

/**
 * Check if availability is explicitly enabled or disabled for any devices.
 * @param config config part of the object published to bridge/info
 * @param logger Logger
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAvailabilityConfigurationForDevices(config: Record<string, any>, logger?: Logger): BooleanDeviceList {
  const result = {
    enabled: new Array<string>(),
    disabled: new Array<string>(),
  };
  if ('devices' in config && typeof config.devices === 'object') {
    for (const device of Object.keys(config.devices)) {
      if (config.devices[device].availability !== undefined) {
        const name = config.devices[device].friendly_name ?? device;
        if (config.devices[device].availability === false) {
          logger?.debug(`Availability feature is explicitly disabled for device '${name}'`);
          result.disabled.push(device);
        } else {
          logger?.debug(`Availability feature is explicitly enabled for device '${name}'`);
          result.enabled.push(device);
        }
      }
    }
  }
  return result;
}
