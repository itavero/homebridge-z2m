import { DeviceListEntry, ExposesEntry, isDeviceDefinition } from './z2mModels';

export const AIR_QUALITY_ACCESSORY_ROLE = 'air-quality';

const STARKVIND_MODELS = new Set(['E2007', 'E3007']);
const AIR_QUALITY_EXPOSE_NAMES = new Set(['pm25', 'air_quality']);

export function shouldSplitStarkvindAirQuality(device: DeviceListEntry): boolean {
  if (!isDeviceDefinition(device.definition) || !STARKVIND_MODELS.has(device.definition.model ?? '')) {
    return false;
  }

  return device.definition.exposes.some((expose) => expose.name === 'pm25');
}

export function deviceForAccessoryRole(device: DeviceListEntry, role?: string): DeviceListEntry {
  if (!isDeviceDefinition(device.definition) || !shouldSplitStarkvindAirQuality(device)) {
    return device;
  }

  const exposes = device.definition.exposes.filter((expose) =>
    role === AIR_QUALITY_ACCESSORY_ROLE ? isAirQualityExpose(expose) : !isAirQualityExpose(expose)
  );

  return {
    ...device,
    definition: {
      ...device.definition,
      exposes,
    },
  };
}

function isAirQualityExpose(expose: ExposesEntry): boolean {
  return expose.name !== undefined && AIR_QUALITY_EXPOSE_NAMES.has(expose.name);
}
