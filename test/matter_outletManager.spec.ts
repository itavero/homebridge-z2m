import type { MatterAccessory, MatterAPI } from 'homebridge';
import { vi } from 'vitest';
import { findMatterOutletExposes } from '../src/matter/outlet';
import { MatterOutletHost, MatterOutletManager } from '../src/matter/outletManager';
import { PLATFORM_NAME, PLUGIN_NAME } from '../src/settings';
import { DeviceListEntry } from '../src/z2mModels';
import { loadExposesFromFile } from './testHelpers';

const ON_OFF_OUTLET = { name: 'OnOffOutlet' };

function createMatterApi() {
  return {
    uuid: { generate: (input: string) => `uuid:${input}` },
    deviceTypes: { OnOffOutlet: ON_OFF_OUTLET },
    registerPlatformAccessories: vi.fn().mockResolvedValue(undefined),
    unregisterPlatformAccessories: vi.fn().mockResolvedValue(undefined),
    updateAccessoryState: vi.fn().mockResolvedValue(undefined),
  };
}

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('MatterOutletManager', () => {
  const exposes = findMatterOutletExposes(loadExposesFromFile('tuya/ts011f_plug_1.json'))!;
  const plug: DeviceListEntry = {
    friendly_name: 'washing_machine',
    ieee_address: '0xa4c138d2b1e5f6a7',
    supported: true,
    software_build_id: '0122052017',
    definition: { vendor: 'Nous', model: 'A7Z', exposes: loadExposesFromFile('tuya/ts011f_plug_1.json') },
  };
  const uuid = `uuid:${PLUGIN_NAME}-matter-outlet-${plug.ieee_address}`;

  let matter: ReturnType<typeof createMatterApi>;
  let host: MatterOutletHost & {
    publishMessage: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    onMatterRegistrationFailed: ReturnType<typeof vi.fn>;
  };
  let manager: MatterOutletManager;

  const registeredAccessory = (): MatterAccessory => matter.registerPlatformAccessories.mock.calls[0][2][0];
  const updatesFor = (cluster: string) =>
    matter.updateAccessoryState.mock.calls.filter((c) => c[1] === cluster).map((c) => [c[0], c[2]] as [string, unknown]);

  beforeEach(() => {
    vi.useFakeTimers();
    matter = createMatterApi();
    host = {
      isConnected: vi.fn().mockReturnValue(true),
      publishMessage: vi.fn().mockResolvedValue(undefined),
      onMatterRegistrationFailed: vi.fn(),
    };
    manager = new MatterOutletManager(host, matter as unknown as MatterAPI, logger, 60_000);
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  it('registers an OnOffOutlet with power and energy clusters', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);

    expect(matter.registerPlatformAccessories).toHaveBeenCalledTimes(1);
    expect(matter.registerPlatformAccessories.mock.calls[0][0]).toBe(PLUGIN_NAME);
    expect(matter.registerPlatformAccessories.mock.calls[0][1]).toBe(PLATFORM_NAME);
    const accessory = registeredAccessory();
    expect(accessory.UUID).toBe(uuid);
    expect(accessory.displayName).toBe('washing machine');
    expect(accessory.deviceType).toBe(ON_OFF_OUTLET);
    expect(accessory.serialNumber).toBe(plug.ieee_address);
    expect(accessory.manufacturer).toBe('Nous');
    expect(accessory.model).toBe('A7Z');
    expect(accessory.context).toStrictEqual({ ieee_address: plug.ieee_address, friendly_name: 'washing_machine' });
    expect(accessory.clusters).toStrictEqual({
      onOff: { onOff: false },
      electricalPowerMeasurement: { activePower: null, voltage: null, activeCurrent: null },
      electricalEnergyMeasurement: { cumulativeEnergyImported: null },
    });
    expect(manager.registeredCount).toBe(1);
  });

  it('requests the current state after registration', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);
    expect(host.publishMessage).toHaveBeenCalledWith('washing_machine/get', JSON.stringify({ state: '' }), {});
  });

  it('only registers new outlets on subsequent device updates', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);
    await manager.syncDevices([{ device: plug, exposes }]);
    expect(matter.registerPlatformAccessories).toHaveBeenCalledTimes(1);
  });

  it('publishes on/off commands to Zigbee2MQTT', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);
    const handlers = registeredAccessory().handlers as unknown as Record<string, Record<string, () => Promise<void>>>;

    await handlers.onOff.on();
    expect(host.publishMessage).toHaveBeenLastCalledWith('washing_machine/set', JSON.stringify({ state: 'ON' }), {});
    await handlers.onOff.off();
    expect(host.publishMessage).toHaveBeenLastCalledWith('washing_machine/set', JSON.stringify({ state: 'OFF' }), {});
  });

  it('fails on/off commands when MQTT is disconnected', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);
    const handlers = registeredAccessory().handlers as unknown as Record<string, Record<string, () => Promise<void>>>;
    host.isConnected.mockReturnValue(false);
    await expect(handlers.onOff.on()).rejects.toThrow();
  });

  it('forwards state and power updates on every message', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);

    expect(manager.handleStateUpdate('washing_machine', { state: 'ON', power: 60, voltage: 230, current: 0.26 })).toBe(true);
    expect(manager.handleStateUpdate(plug.ieee_address, { power: 75.5 })).toBe(true);

    expect(updatesFor('onOff')).toStrictEqual([[uuid, { onOff: true }]]);
    expect(updatesFor('electricalPowerMeasurement')).toStrictEqual([
      [uuid, { activePower: 60_000, voltage: 230_000, activeCurrent: 260 }],
      [uuid, { activePower: 75_500 }],
    ]);
  });

  it('skips unchanged values', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);
    manager.handleStateUpdate('washing_machine', { state: 'ON', power: 60, voltage: 230 });
    manager.handleStateUpdate('washing_machine', { state: 'ON', power: 60, voltage: 231 });
    expect(updatesFor('onOff')).toHaveLength(1);
    expect(updatesFor('electricalPowerMeasurement')).toStrictEqual([
      [uuid, { activePower: 60_000, voltage: 230_000 }],
      [uuid, { voltage: 231_000 }],
    ]);
  });

  it('throttles energy updates to one per minute', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);

    manager.handleStateUpdate('washing_machine', { energy: 1.0 });
    vi.advanceTimersByTime(10_000);
    manager.handleStateUpdate('washing_machine', { energy: 1.01 });
    vi.advanceTimersByTime(10_000);
    manager.handleStateUpdate('washing_machine', { energy: 1.02 });
    expect(updatesFor('electricalEnergyMeasurement')).toStrictEqual([[uuid, { cumulativeEnergyImported: { energy: 1_000_000 } }]]);

    vi.advanceTimersByTime(40_000);
    expect(updatesFor('electricalEnergyMeasurement')).toStrictEqual([
      [uuid, { cumulativeEnergyImported: { energy: 1_000_000 } }],
      [uuid, { cumulativeEnergyImported: { energy: 1_020_000 } }],
    ]);
  });

  it('applies state received before registration once registered', async () => {
    let resolveRegistration: () => void = () => undefined;
    matter.registerPlatformAccessories.mockReturnValue(new Promise<void>((r) => (resolveRegistration = r)));
    const sync = manager.syncDevices([{ device: plug, exposes }]);
    await vi.waitFor(() => expect(matter.registerPlatformAccessories).toHaveBeenCalled());

    expect(manager.handleStateUpdate('washing_machine', { state: 'OFF', power: 0 })).toBe(true);
    expect(matter.updateAccessoryState).not.toHaveBeenCalled();

    resolveRegistration();
    await sync;
    expect(updatesFor('onOff')).toStrictEqual([[uuid, { onOff: false }]]);
    expect(updatesFor('electricalPowerMeasurement')).toStrictEqual([[uuid, { activePower: 0 }]]);
  });

  it('ignores messages for other devices', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);
    expect(manager.handlesDevice('other')).toBe(false);
    expect(manager.handleStateUpdate('other', { power: 1 })).toBe(false);
    expect(matter.updateAccessoryState).not.toHaveBeenCalled();
  });

  it('re-registers cached accessories and unregisters the ones no longer selected', async () => {
    const stale = { UUID: 'uuid:stale', displayName: 'old plug' } as MatterAccessory;
    manager.configureCachedAccessory({ UUID: uuid, displayName: 'washing machine' } as MatterAccessory);
    manager.configureCachedAccessory(stale);

    await manager.syncDevices([{ device: plug, exposes }]);

    expect(matter.unregisterPlatformAccessories).toHaveBeenCalledWith(PLUGIN_NAME, PLATFORM_NAME, [stale]);
    expect(registeredAccessory().UUID).toBe(uuid);
  });

  it('unregisters outlets that are removed', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);
    await manager.syncDevices([]);
    expect(matter.unregisterPlatformAccessories).toHaveBeenCalledTimes(1);
    expect(matter.unregisterPlatformAccessories.mock.calls[0][2][0].UUID).toBe(uuid);
    expect(manager.handlesDevice('washing_machine')).toBe(false);
  });

  it('forgets outlets when registration fails', async () => {
    matter.registerPlatformAccessories.mockRejectedValue(new Error('violates device type requirements'));
    await manager.syncDevices([{ device: plug, exposes }]);
    expect(logger.error).toHaveBeenCalled();
    expect(manager.registeredCount).toBe(0);
    expect(manager.handlesDevice('washing_machine')).toBe(false);
    expect(host.onMatterRegistrationFailed).toHaveBeenCalledWith([plug]);
  });

  it('sends a value again when the previous update of the same value failed', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);
    logger.warn.mockClear();
    matter.updateAccessoryState.mockRejectedValueOnce(new Error('endpoint not ready'));
    matter.updateAccessoryState.mockRejectedValueOnce(new Error('endpoint not ready'));
    manager.handleStateUpdate('washing_machine', { state: 'ON', power: 60 });
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(2));

    manager.handleStateUpdate('washing_machine', { state: 'ON', power: 60 });
    expect(updatesFor('onOff')).toStrictEqual([
      [uuid, { onOff: true }],
      [uuid, { onOff: true }],
    ]);
    expect(updatesFor('electricalPowerMeasurement')).toStrictEqual([
      [uuid, { activePower: 60_000 }],
      [uuid, { activePower: 60_000 }],
    ]);
  });

  it('uses the new friendly name after a rename', async () => {
    await manager.syncDevices([{ device: plug, exposes }]);
    await manager.syncDevices([{ device: { ...plug, friendly_name: 'lave_linge' }, exposes }]);
    const handlers = registeredAccessory().handlers as unknown as Record<string, Record<string, () => Promise<void>>>;
    await handlers.onOff.on();
    expect(host.publishMessage).toHaveBeenLastCalledWith('lave_linge/set', JSON.stringify({ state: 'ON' }), {});
    expect(manager.handlesDevice('lave_linge')).toBe(true);
  });
});
