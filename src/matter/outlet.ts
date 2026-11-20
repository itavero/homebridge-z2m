import { CURRENT_NAMES, ENERGY_CONSUMED_NAMES, POWER_NAMES, VOLTAGE_NAMES } from '../converters/electrical';
import { sanitizeAccessoryName } from '../helpers';
import {
  DeviceListEntry,
  ExposesEntry,
  ExposesEntryWithBinaryProperty,
  ExposesEntryWithProperty,
  ExposesKnownTypes,
  exposesCanBeSet,
  exposesHasBinaryProperty,
  exposesHasFeatures,
  exposesHasProperty,
  exposesIsPublished,
  isDeviceDefinition,
  isDeviceListEntryForGroup,
} from '../z2mModels';

/** Matter limits displayName, serialNumber, manufacturer and model to 32 characters. */
export const MATTER_STRING_MAX_LENGTH = 32;

export const MATTER_OUTLETS_AUTO = 'auto';
export const MATTER_OUTLETS_CONFIGURED = 'configured';

export interface MatterPlatformConfiguration extends Record<string, unknown> {
  /**
   * `auto`: publish every device that exposes an on/off `state` and `power` or `energy`.
   * `configured` (default): only publish devices that have `matter` enabled in their device configuration.
   */
  outlets?: string;
  /** Keep publishing the devices published via Matter over HAP as well (default: false). */
  keep_hap?: boolean;
}

export interface MatterDeviceConfiguration extends Record<string, unknown> {
  /** Publish (`true`) or do not publish (`false`) this device as a Matter outlet. When omitted, the platform option `outlets` decides. */
  outlet?: boolean;
  /** Overrides the platform option `keep_hap` for this device. */
  keep_hap?: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: type guard function needs to accept any input
export const isMatterPlatformConfiguration = (x: any): x is MatterPlatformConfiguration =>
  x !== null &&
  typeof x === 'object' &&
  !Array.isArray(x) &&
  (x.outlets === undefined || x.outlets === MATTER_OUTLETS_AUTO || x.outlets === MATTER_OUTLETS_CONFIGURED) &&
  (x.keep_hap === undefined || typeof x.keep_hap === 'boolean');

// biome-ignore lint/suspicious/noExplicitAny: type guard function needs to accept any input
export const isMatterDeviceConfiguration = (x: any): x is MatterDeviceConfiguration =>
  x !== null &&
  typeof x === 'object' &&
  !Array.isArray(x) &&
  (x.outlet === undefined || typeof x.outlet === 'boolean') &&
  (x.keep_hap === undefined || typeof x.keep_hap === 'boolean');

export interface MatterOutletExposes {
  state: ExposesEntryWithBinaryProperty;
  power?: ExposesEntryWithProperty;
  voltage?: ExposesEntryWithProperty;
  current?: ExposesEntryWithProperty;
  energy?: ExposesEntryWithProperty;
}

const isOnOffState = (e: ExposesEntry): e is ExposesEntryWithBinaryProperty =>
  exposesHasBinaryProperty(e) && e.name === 'state' && exposesCanBeSet(e) && exposesIsPublished(e);

function findMeasurement(exposes: ExposesEntry[], names: string[]): ExposesEntryWithProperty | undefined {
  for (const name of names) {
    const found = exposes.find(
      (e) =>
        e.endpoint === undefined &&
        e.type === ExposesKnownTypes.NUMERIC &&
        e.name === name &&
        exposesHasProperty(e) &&
        exposesIsPublished(e)
    );
    if (found !== undefined) {
      return found as ExposesEntryWithProperty;
    }
  }
  return undefined;
}

function findOnOffState(exposes: ExposesEntry[]): ExposesEntryWithBinaryProperty | undefined {
  for (const e of exposes) {
    if (e.type === ExposesKnownTypes.SWITCH && e.endpoint === undefined && exposesHasFeatures(e)) {
      const state = e.features.find((f) => f.endpoint === undefined && isOnOffState(f));
      if (state !== undefined) {
        return state as ExposesEntryWithBinaryProperty;
      }
    }
  }
  return undefined;
}

/**
 * Determine if the exposes of a device describe a metering outlet: an on/off `state` and `power` and/or `energy`,
 * all on the main endpoint. Returns undefined if the device can not be published as a Matter outlet.
 */
export function findMatterOutletExposes(exposes: ExposesEntry[]): MatterOutletExposes | undefined {
  const state = findOnOffState(exposes);
  if (state === undefined) {
    return undefined;
  }
  const power = findMeasurement(exposes, POWER_NAMES);
  const energy = findMeasurement(exposes, ENERGY_CONSUMED_NAMES);
  if (power === undefined && energy === undefined) {
    return undefined;
  }
  const result: MatterOutletExposes = { state };
  if (power !== undefined) {
    result.power = power;
    // Voltage and current are only reported as part of the power measurement cluster (activePower is mandatory there).
    result.voltage = findMeasurement(exposes, VOLTAGE_NAMES);
    result.current = findMeasurement(exposes, CURRENT_NAMES);
  }
  if (energy !== undefined) {
    result.energy = energy;
  }
  return result;
}

export function getMatterOutletExposesForDevice(device: DeviceListEntry): MatterOutletExposes | undefined {
  if (isDeviceListEntryForGroup(device) || !isDeviceDefinition(device.definition)) {
    return undefined;
  }
  return findMatterOutletExposes(device.definition.exposes);
}

export interface MatterOutletDecision {
  publish: boolean;
  keepHap: boolean;
}

/**
 * Decide if a device (that can be published as an outlet) should be published via Matter,
 * based on the platform configuration and the (optional) device configuration.
 */
export function decideMatterOutlet(
  platformConfig: MatterPlatformConfiguration | undefined,
  deviceConfig: MatterDeviceConfiguration | undefined
): MatterOutletDecision {
  const publish = deviceConfig?.outlet ?? platformConfig?.outlets === MATTER_OUTLETS_AUTO;
  const keepHap = deviceConfig?.keep_hap ?? platformConfig?.keep_hap ?? false;
  return { publish, keepHap };
}

export function truncateForMatter(value: string, fallback: string): string {
  const trimmed = value.trim();
  const result = trimmed.length > 0 ? trimmed : fallback;
  return result.length > MATTER_STRING_MAX_LENGTH ? result.substring(0, MATTER_STRING_MAX_LENGTH).trim() : result;
}

export function getMatterDisplayName(device: DeviceListEntry): string {
  return truncateForMatter(sanitizeAccessoryName(device.friendly_name) ?? device.ieee_address, device.ieee_address);
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/** W → mW, V → mV, A → mA. Returns null ("no measurement") if the value is not a number. */
export function toMilliUnits(value: unknown): number | null {
  const n = toFiniteNumber(value);
  return n === undefined ? null : Math.round(n * 1000);
}

/** kWh → mWh. Returns null if the value is not a valid (non-negative) number. */
export function kilowattHoursToMilliwattHours(value: unknown): number | null {
  const n = toFiniteNumber(value);
  return n === undefined || n < 0 ? null : Math.round(n * 1_000_000);
}

export interface PowerMeasurementState extends Record<string, unknown> {
  activePower?: number | null;
  voltage?: number | null;
  activeCurrent?: number | null;
}

/** Initial `electricalPowerMeasurement` cluster state; only declares the attributes the device can measure. */
export function initialPowerMeasurementState(exposes: MatterOutletExposes): PowerMeasurementState | undefined {
  if (exposes.power === undefined) {
    return undefined;
  }
  const state: PowerMeasurementState = { activePower: null };
  if (exposes.voltage !== undefined) {
    state.voltage = null;
  }
  if (exposes.current !== undefined) {
    state.activeCurrent = null;
  }
  return state;
}

/** Extract the `electricalPowerMeasurement` attributes present in a Zigbee2MQTT state message. */
export function powerMeasurementFromState(exposes: MatterOutletExposes, state: Record<string, unknown>): PowerMeasurementState {
  const result: PowerMeasurementState = {};
  if (exposes.power !== undefined && exposes.power.property in state) {
    result.activePower = toMilliUnits(state[exposes.power.property]);
  }
  if (exposes.voltage !== undefined && exposes.voltage.property in state) {
    result.voltage = toMilliUnits(state[exposes.voltage.property]);
  }
  if (exposes.current !== undefined && exposes.current.property in state) {
    result.activeCurrent = toMilliUnits(state[exposes.current.property]);
  }
  return result;
}

/** Extract the cumulative imported energy (mWh) from a Zigbee2MQTT state message, if present and valid. */
export function energyFromState(exposes: MatterOutletExposes, state: Record<string, unknown>): number | undefined {
  if (exposes.energy === undefined || !(exposes.energy.property in state)) {
    return undefined;
  }
  return kilowattHoursToMilliwattHours(state[exposes.energy.property]) ?? undefined;
}

/** Extract the on/off state from a Zigbee2MQTT state message, if present. */
export function onOffFromState(exposes: MatterOutletExposes, state: Record<string, unknown>): boolean | undefined {
  if (!(exposes.state.property in state)) {
    return undefined;
  }
  const value = state[exposes.state.property];
  if (value === exposes.state.value_on) {
    return true;
  }
  if (value === exposes.state.value_off) {
    return false;
  }
  return undefined;
}
