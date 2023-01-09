/* eslint-disable @typescript-eslint/no-explicit-any */
import { BasicLogger } from './logger';

/**
 * Check if availability is configured. Based on utils.isAvailabilityEnabledForEntity from Zigbee2MQTT code base.
 * @param config config part of the object published to bridge/info
 * @returns True if availability is configured
 */
export function isAvailabilityEnabledGlobally(config: Record<string, any>): boolean {
  const availabilityEnabled = config.availability || config.advanced?.availability_timeout;
  if (!availabilityEnabled) {
    return false;
  }

  let passList = config.advanced?.availability_passlist ?? [];
  passList = passList.concat(config.advanced?.availability_whitelist ?? []);
  // If a pass list is defined, availability cannot be considered globally enabled.
  return passList.length === 0;
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
 * @param config config part of the object published to bridge/info
 * @param logger BasicLogger
 */
export function getAvailabilityConfigurationForDevices(config: Record<string, any>, logger?: BasicLogger): BooleanDeviceList {
  const result = getAvailabilityFromDeviceConfigurations(config, logger);

  // Also check availability_passlist, availability_blocklist, availability_whitelist and availability_blacklist.
  if ('advanced' in config) {
    let passList = config.advanced.availability_passlist ?? [];
    passList = passList.concat(config.advanced.availability_whitelist ?? []);
    if (passList.length > 0) {
      // Add all entries from pass list to result.enabled
      for (const device of passList) {
        _logAvailabilityConfigForDevice(logger, device, true, 'pass list');
        result.enabled.push(device);
      }
    } else {
      // Block list only used if pass list is not defined.
      let blockList = config.advanced.availability_blocklist ?? [];
      blockList = blockList.concat(config.advanced.availability_blacklist ?? []);
      for (const device of blockList) {
        _logAvailabilityConfigForDevice(logger, device, false, 'block list');
        result.disabled.push(device);
      }
    }
  }
  return result;
}

function getAvailabilityFromDeviceConfigurations(config: Record<string, any>, logger: BasicLogger | undefined): BooleanDeviceList {
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
