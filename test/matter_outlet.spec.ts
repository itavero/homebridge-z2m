import {
  decideMatterOutlet,
  energyFromState,
  findMatterOutletExposes,
  getMatterDisplayName,
  getMatterOutletExposesForDevice,
  initialPowerMeasurementState,
  isMatterDeviceConfiguration,
  isMatterPlatformConfiguration,
  isMatterSupportedByHomebridge,
  MATTER_STRING_MAX_LENGTH,
  onOffFromState,
  powerMeasurementFromState,
  toMilliUnits,
  toMilliwattHours,
  truncateForMatter,
} from '../src/matter/outlet';
import { DeviceListEntry, ExposesEntry } from '../src/z2mModels';
import { loadExposesFromFile } from './testHelpers';

const stateSwitch: ExposesEntry = {
  type: 'switch',
  features: [{ type: 'binary', name: 'state', property: 'state', access: 7, value_on: 'ON', value_off: 'OFF' }],
} as ExposesEntry;

const numeric = (name: string, unit: string, endpoint?: string): ExposesEntry => ({
  type: 'numeric',
  name,
  property: endpoint === undefined ? name : `${name}_${endpoint}`,
  access: 1,
  unit,
  endpoint,
});

describe('Matter outlet', () => {
  describe('unit conversion', () => {
    it('converts W, V and A to mW, mV and mA', () => {
      expect(toMilliUnits(60)).toBe(60_000);
      expect(toMilliUnits(230.4)).toBe(230_400);
      expect(toMilliUnits(0.261)).toBe(261);
      expect(toMilliUnits(0)).toBe(0);
    });

    it('rounds to whole milli units', () => {
      expect(toMilliUnits(0.0004)).toBe(0);
      expect(toMilliUnits(1.2345)).toBe(1235);
    });

    it('accepts numeric strings', () => {
      expect(toMilliUnits('12.5')).toBe(12_500);
    });

    it('returns null when there is no valid measurement', () => {
      expect(toMilliUnits(undefined)).toBeNull();
      expect(toMilliUnits(null)).toBeNull();
      expect(toMilliUnits('')).toBeNull();
      expect(toMilliUnits('abc')).toBeNull();
      expect(toMilliUnits(Number.NaN)).toBeNull();
      expect(toMilliUnits(Number.POSITIVE_INFINITY)).toBeNull();
    });

    it('converts kWh to mWh', () => {
      expect(toMilliwattHours(1)).toBe(1_000_000);
      expect(toMilliwattHours(12.34)).toBe(12_340_000);
      expect(toMilliwattHours(0.001)).toBe(1000);
      expect(toMilliwattHours(0)).toBe(0);
    });

    it('converts Wh to mWh with the Wh factor', () => {
      expect(toMilliwattHours(1000, 1_000)).toBe(1_000_000);
    });

    it('rejects negative or invalid energy readings', () => {
      expect(toMilliwattHours(-1)).toBeNull();
      expect(toMilliwattHours(undefined)).toBeNull();
      expect(toMilliwattHours('n/a')).toBeNull();
    });
  });

  describe('exposes detection', () => {
    it('detects a Tuya TS011F plug with all measurements', () => {
      const exposes = findMatterOutletExposes(loadExposesFromFile('tuya/ts011f_plug_1.json'));
      expect(exposes).toBeDefined();
      expect(exposes?.state.property).toBe('state');
      expect(exposes?.power?.property).toBe('power');
      expect(exposes?.voltage?.property).toBe('voltage');
      expect(exposes?.current?.property).toBe('current');
      expect(exposes?.energy?.property).toBe('energy');
    });

    it('does not declare missing measurements', () => {
      const exposes = findMatterOutletExposes([stateSwitch, numeric('power', 'W')]);
      expect(exposes).toBeDefined();
      expect(exposes?.voltage).toBeUndefined();
      expect(exposes?.current).toBeUndefined();
      expect(exposes?.energy).toBeUndefined();
      expect(initialPowerMeasurementState(exposes!)).toStrictEqual({ activePower: null });
    });

    it('declares all power attributes when available', () => {
      const exposes = findMatterOutletExposes([stateSwitch, numeric('power', 'W'), numeric('voltage', 'V'), numeric('current', 'A')]);
      expect(initialPowerMeasurementState(exposes!)).toStrictEqual({ activePower: null, voltage: null, activeCurrent: null });
    });

    it('supports energy-only devices without a power measurement cluster', () => {
      const exposes = findMatterOutletExposes([stateSwitch, numeric('energy', 'kWh'), numeric('voltage', 'V')]);
      expect(exposes?.energy?.property).toBe('energy');
      expect(exposes?.voltage).toBeUndefined();
      expect(initialPowerMeasurementState(exposes!)).toBeUndefined();
    });

    it('requires power or energy', () => {
      expect(findMatterOutletExposes([stateSwitch, numeric('voltage', 'V')])).toBeUndefined();
      expect(findMatterOutletExposes([stateSwitch])).toBeUndefined();
    });

    it('requires a settable on/off state on the main endpoint', () => {
      expect(findMatterOutletExposes([numeric('power', 'W')])).toBeUndefined();
      const readOnlyState = {
        type: 'switch',
        features: [{ type: 'binary', name: 'state', property: 'state', access: 1, value_on: 'ON', value_off: 'OFF' }],
      } as ExposesEntry;
      expect(findMatterOutletExposes([readOnlyState, numeric('power', 'W')])).toBeUndefined();
      const endpointState = {
        type: 'switch',
        endpoint: 'l1',
        features: [{ type: 'binary', name: 'state', property: 'state_l1', endpoint: 'l1', access: 7, value_on: 'ON', value_off: 'OFF' }],
      } as ExposesEntry;
      expect(findMatterOutletExposes([endpointState, numeric('power', 'W', 'l1')])).toBeUndefined();
    });

    it('ignores groups and devices without definition', () => {
      const exposes = loadExposesFromFile('tuya/ts011f_plug_1.json');
      const group = {
        friendly_name: 'plugs',
        ieee_address: '1',
        group_id: 1,
        supported: true,
        definition: { vendor: 'Zigbee2MQTT', model: 'GROUP-1', exposes },
      };
      expect(getMatterOutletExposesForDevice(group)).toBeUndefined();
      expect(
        getMatterOutletExposesForDevice({ friendly_name: 'x', ieee_address: '0x1', supported: true, definition: null })
      ).toBeUndefined();
    });
  });

  describe('device selection', () => {
    it('does not publish anything by default', () => {
      expect(decideMatterOutlet(undefined, undefined)).toStrictEqual({ publish: false, keepHap: false });
      expect(decideMatterOutlet({}, undefined).publish).toBe(false);
      expect(decideMatterOutlet({ outlets: 'configured' }, undefined).publish).toBe(false);
    });

    it('publishes devices that enable it in their configuration', () => {
      expect(decideMatterOutlet(undefined, { outlet: true })).toStrictEqual({ publish: true, keepHap: false });
    });

    it('publishes all eligible devices when outlets is auto', () => {
      expect(decideMatterOutlet({ outlets: 'auto' }, undefined)).toStrictEqual({ publish: true, keepHap: false });
    });

    it('lets a device opt out of auto', () => {
      expect(decideMatterOutlet({ outlets: 'auto' }, { outlet: false }).publish).toBe(false);
    });

    it('keeps HAP when requested on platform or device level', () => {
      expect(decideMatterOutlet({ outlets: 'auto', keep_hap: true }, undefined).keepHap).toBe(true);
      expect(decideMatterOutlet(undefined, { outlet: true, keep_hap: true }).keepHap).toBe(true);
      expect(decideMatterOutlet({ outlets: 'auto', keep_hap: true }, { keep_hap: false }).keepHap).toBe(false);
      expect(decideMatterOutlet({ outlets: 'auto', keep_hap: true }, { keep_hap: false }).publish).toBe(true);
    });

    it('validates the platform configuration', () => {
      expect(isMatterPlatformConfiguration({})).toBe(true);
      expect(isMatterPlatformConfiguration({ outlets: 'auto', keep_hap: false })).toBe(true);
      expect(isMatterPlatformConfiguration({ outlets: 'configured' })).toBe(true);
      expect(isMatterPlatformConfiguration({ outlets: 'all' })).toBe(false);
      expect(isMatterPlatformConfiguration({ keep_hap: 'yes' })).toBe(false);
      expect(isMatterPlatformConfiguration(true)).toBe(false);
      expect(isMatterPlatformConfiguration(null)).toBe(false);
    });

    it('validates the device configuration', () => {
      expect(isMatterDeviceConfiguration({})).toBe(true);
      expect(isMatterDeviceConfiguration(true)).toBe(false);
      expect(isMatterDeviceConfiguration({ outlet: true, keep_hap: true })).toBe(true);
      expect(isMatterDeviceConfiguration({ outlet: 'yes' })).toBe(false);
      expect(isMatterDeviceConfiguration('true')).toBe(false);
      expect(isMatterDeviceConfiguration([])).toBe(false);
    });
  });

  describe('state mapping', () => {
    const exposes = findMatterOutletExposes(loadExposesFromFile('tuya/ts011f_plug_1.json'))!;

    it('maps a full Zigbee2MQTT message', () => {
      const state = { state: 'ON', power: 61.5, voltage: 231, current: 0.27, energy: 12.345, linkquality: 120 };
      expect(onOffFromState(exposes, state)).toBe(true);
      expect(powerMeasurementFromState(exposes, state)).toStrictEqual({ activePower: 61_500, voltage: 231_000, activeCurrent: 270 });
      expect(energyFromState(exposes, state)).toBe(12_345_000);
    });

    it('only includes the attributes present in the message', () => {
      expect(onOffFromState(exposes, { power: 1 })).toBeUndefined();
      expect(powerMeasurementFromState(exposes, { power: 1 })).toStrictEqual({ activePower: 1000 });
      expect(energyFromState(exposes, { power: 1 })).toBeUndefined();
    });

    it('maps the off state and ignores unknown state values', () => {
      expect(onOffFromState(exposes, { state: 'OFF' })).toBe(false);
      expect(onOffFromState(exposes, { state: 'TOGGLE' })).toBeUndefined();
    });

    it('converts energy based on the unit of the expose', () => {
      const withUnit = (unit: string | undefined) =>
        findMatterOutletExposes([stateSwitch, { ...numeric('consumed_energy', 'Wh'), unit } as ExposesEntry]);
      expect(energyFromState(withUnit('Wh')!, { consumed_energy: 1000 })).toBe(1_000_000);
      expect(energyFromState(withUnit('kWh')!, { consumed_energy: 1 })).toBe(1_000_000);
      expect(energyFromState(withUnit(undefined)!, { consumed_energy: 1 })).toBe(1_000_000);
    });

    it('ignores energy in an unsupported unit', () => {
      expect(findMatterOutletExposes([stateSwitch, numeric('energy', 'MWh')])).toBeUndefined();
      const exposes = findMatterOutletExposes([stateSwitch, numeric('power', 'W'), numeric('energy', 'MWh')])!;
      expect(exposes.energy).toBeUndefined();
      expect(energyFromState(exposes, { energy: 1 })).toBeUndefined();
    });

    it('reports null for invalid power readings and skips invalid energy readings', () => {
      expect(powerMeasurementFromState(exposes, { power: null })).toStrictEqual({ activePower: null });
      expect(energyFromState(exposes, { energy: null })).toBeUndefined();
    });
  });

  describe('identity', () => {
    const device = (friendly_name: string): DeviceListEntry => ({ friendly_name, ieee_address: '0xa4c138d2b1e5f6a7', supported: true });

    it('sanitizes the display name', () => {
      expect(getMatterDisplayName(device('washing_machine'))).toBe('washing machine');
    });

    it('limits strings to 32 characters', () => {
      const name = getMatterDisplayName(device('a very long friendly name for a smart plug in the kitchen'));
      expect(name.length).toBeLessThanOrEqual(MATTER_STRING_MAX_LENGTH);
      expect(name).toBe('a very long friendly name for a');
      expect(truncateForMatter('x'.repeat(40), 'fallback')).toHaveLength(MATTER_STRING_MAX_LENGTH);
    });

    it('falls back when empty', () => {
      expect(truncateForMatter('  ', 'Zigbee2MQTT')).toBe('Zigbee2MQTT');
      expect(getMatterDisplayName(device('___'))).toBe('0xa4c138d2b1e5f6a7');
    });
  });

  describe('Homebridge version', () => {
    it('requires Homebridge 2.5.0 or newer', () => {
      expect(isMatterSupportedByHomebridge('2.5.0')).toBe(true);
      expect(isMatterSupportedByHomebridge('2.6.1-beta.3')).toBe(true);
      expect(isMatterSupportedByHomebridge('2.4.0')).toBe(false);
      expect(isMatterSupportedByHomebridge('2.2.1')).toBe(false);
      expect(isMatterSupportedByHomebridge(undefined)).toBe(false);
      expect(isMatterSupportedByHomebridge('unknown')).toBe(false);
    });
  });
});
