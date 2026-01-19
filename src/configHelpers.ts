/* eslint-disable @typescript-eslint/no-explicit-any */
import { BasicLogger } from './logger';

/**
 * Check if availability is configured. Based on utils.isAvailabilityEnabledForEntity from Zigbee2MQTT code base.
 * @param config config part of the object published to bridge/info
 * @returns True if availability is configured
 */
export function isAvailabilityEnabledGlobally(config: Record<string, any>): boolean {
  if (typeof config.availability === 'object') {
    // In zigbee2mqtt v3+, availability is always an object with 'enabled' property
    // Default to true if enabled is not explicitly set (for backward compatibility)
    return config?.availability?.enabled ?? true;
  }

  // Check for new availability structure (availability.enabled)
  if (typeof config.availability === 'boolean') {
    return config.availability;
  }

  // Legacy: check for advanced.availability_timeout (deprecated but may still exist in older configs)
  return !!config.advanced?.availability_timeout;
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
 * Based on utils.isAvailabilityEnabledForEntity from Zigbee2MQTT code base.
 * Legacy passlist/blocklist/whitelist/blacklist were removed in zigbee2mqtt v2.
 * @param config config part of the object published to bridge/info
 * @param logger BasicLogger
 */
export function getAvailabilityConfigurationForDevices(config: Record<string, any>, logger?: BasicLogger): BooleanDeviceList {
  const result = {
    enabled: new Array<string>(),
    disabled: new Array<string>(),
  };

  if ('devices' in config && typeof config.devices === 'object') {
    for (const device of Object.keys(config.devices)) {
      if (config.devices[device].availability !== undefined) {
        const name = config.devices[device].friendly_name ?? device;
        if (config.devices[device].availability === false) {
          _logAvailabilityConfigForDevice(logger, name, false, 'device config');
          result.disabled.push(device);
        } else {
          _logAvailabilityConfigForDevice(logger, name, true, 'device config');
          result.enabled.push(device);
        }
      }
    }
  }

  return result;
}

function _logAvailabilityConfigForDevice(logger: BasicLogger | undefined, device: string, enabled: boolean, source: string): void {
  logger?.debug(`Availability feature is ${enabled ? 'enabled' : 'disabled'} for device '${device}' (via ${source})`);
}
