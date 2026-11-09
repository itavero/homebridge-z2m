import { describe, expect, test } from 'vitest';
import { AIR_QUALITY_ACCESSORY_ROLE, deviceForAccessoryRole, shouldSplitStarkvindAirQuality } from '../src/purifierAccessorySplit';
import { DeviceListEntry, ExposesEntry } from '../src/z2mModels';
import { loadExposesFromFile } from './testHelpers';

function starkvindDevice(exposes: ExposesEntry[]): DeviceListEntry {
  return {
    definition: {
      description: 'STARKVIND air purifier',
      exposes,
      model: 'E2007',
      supports_ota: true,
      vendor: 'IKEA',
    },
    disabled: false,
    endpoints: {},
    friendly_name: 'Bedroom Air Purifier',
    ieee_address: '0x1234',
    interview_completed: true,
    interviewing: false,
    network_address: 1234,
    supported: true,
    type: 'Router',
  };
}

describe('STARKVIND accessory split', () => {
  test('keeps purifier and filter on the primary accessory', () => {
    const device = starkvindDevice(loadExposesFromFile('ikea/e2007.json'));
    const primary = deviceForAccessoryRole(device);
    const names = primary.definition?.exposes.map((entry) => entry.name);

    expect(shouldSplitStarkvindAirQuality(device)).toBe(true);
    expect(names).toContain('fan');
    expect(names).toContain('replace_filter');
    expect(names).not.toContain('pm25');
    expect(names).not.toContain('air_quality');
  });

  test('creates a sensor-only accessory for PM2.5', () => {
    const device = starkvindDevice(loadExposesFromFile('ikea/e2007.json'));
    const sensor = deviceForAccessoryRole(device, AIR_QUALITY_ACCESSORY_ROLE);

    expect(sensor.definition?.exposes.map((entry) => entry.name)).toEqual(['pm25', 'air_quality']);
  });

  test('does not split unrelated fan devices', () => {
    const device = starkvindDevice(loadExposesFromFile('ikea/e2007.json'));
    if (device.definition !== null) {
      device.definition.model = 'NOT-STARKVIND';
    }
    expect(shouldSplitStarkvindAirQuality(device)).toBe(false);
    expect(deviceForAccessoryRole(device, AIR_QUALITY_ACCESSORY_ROLE)).toBe(device);
  });
});
