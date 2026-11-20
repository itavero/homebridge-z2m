import type { MatterAccessory, MatterAPI } from 'homebridge';
import { errorToString } from '../helpers';
import { BasicLogger } from '../logger';
import { PLATFORM_NAME, PLUGIN_NAME } from '../settings';
import { DeviceListEntry, exposesCanBeGet } from '../z2mModels';
import {
  energyFromState,
  getMatterDisplayName,
  initialPowerMeasurementState,
  MatterOutletExposes,
  onOffFromState,
  PowerMeasurementState,
  powerMeasurementFromState,
  truncateForMatter,
} from './outlet';
import { ThrottledReporter } from './throttle';

/** Matter.js emits a measurement event for every energy update; keep these to roughly one per minute. */
export const DEFAULT_ENERGY_REPORT_INTERVAL_MS = 60_000;

const CLUSTER_ON_OFF = 'onOff';
const CLUSTER_POWER = 'electricalPowerMeasurement';
const CLUSTER_ENERGY = 'electricalEnergyMeasurement';

export interface MatterOutletHost {
  isConnected(): boolean;
  publishMessage(topic: string, payload: string, options: Record<string, unknown>): Promise<void>;
}

export interface MatterOutletDevice {
  device: DeviceListEntry;
  exposes: MatterOutletExposes;
}

export interface MatterOutletContext extends Record<string, unknown> {
  ieee_address: string;
  friendly_name: string;
}

interface OutletRecord {
  uuid: string;
  device: DeviceListEntry;
  exposes: MatterOutletExposes;
  accessory: MatterAccessory<MatterOutletContext>;
  registered: boolean;
  latestState: Record<string, unknown>;
  lastOnOff?: boolean;
  lastPower: PowerMeasurementState;
  energyReporter: ThrottledReporter<number>;
}

export class MatterOutletManager {
  private readonly cached = new Map<string, MatterAccessory>();
  private readonly outlets = new Map<string, OutletRecord>();
  private syncQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly host: MatterOutletHost,
    private readonly matter: MatterAPI,
    private readonly log: BasicLogger,
    private readonly energyReportIntervalMs: number = DEFAULT_ENERGY_REPORT_INTERVAL_MS
  ) {}

  static generateUuid(matter: MatterAPI, ieeeAddress: string): string {
    return matter.uuid.generate(`${PLUGIN_NAME}-matter-outlet-${ieeeAddress}`);
  }

  /** Called by Homebridge for each cached Matter accessory, before the device list is received. */
  configureCachedAccessory(accessory: MatterAccessory): void {
    this.cached.set(accessory.UUID, accessory);
  }

  get registeredCount(): number {
    let count = 0;
    for (const outlet of this.outlets.values()) {
      if (outlet.registered) {
        count++;
      }
    }
    return count;
  }

  /**
   * Bring the published Matter outlets in line with the given devices: register new ones (including the ones restored
   * from cache, as Matter requires every accessory to be registered on every start) and unregister the others.
   */
  syncDevices(devices: MatterOutletDevice[]): Promise<void> {
    this.syncQueue = this.syncQueue.then(() => this.doSyncDevices(devices)).catch((err) => this.log.error(errorToString(err)));
    return this.syncQueue;
  }

  handlesDevice(identifier: string): boolean {
    return this.findOutlet(identifier) !== undefined;
  }

  /**
   * Process a state message from Zigbee2MQTT.
   * @param identifier friendly name or IEEE address (the topic of the message)
   * @returns true if the message belongs to a Matter outlet.
   */
  handleStateUpdate(identifier: string, state: Record<string, unknown>): boolean {
    const outlet = this.findOutlet(identifier);
    if (outlet === undefined) {
      return false;
    }
    outlet.latestState = { ...outlet.latestState, ...state };
    if (outlet.registered) {
      this.pushState(outlet, state);
    }
    return true;
  }

  dispose(): void {
    for (const outlet of this.outlets.values()) {
      outlet.energyReporter.dispose();
    }
  }

  private findOutlet(identifier: string): OutletRecord | undefined {
    for (const outlet of this.outlets.values()) {
      if (outlet.device.friendly_name === identifier || outlet.device.ieee_address === identifier) {
        return outlet;
      }
    }
    return undefined;
  }

  private async doSyncDevices(devices: MatterOutletDevice[]): Promise<void> {
    const wanted = new Map<string, MatterOutletDevice>();
    for (const entry of devices) {
      wanted.set(MatterOutletManager.generateUuid(this.matter, entry.device.ieee_address), entry);
    }

    await this.unregisterUnwanted(wanted);

    const toRegister: OutletRecord[] = [];
    for (const [uuid, entry] of wanted) {
      const existing = this.outlets.get(uuid);
      if (existing !== undefined) {
        existing.device = entry.device;
        existing.accessory.context.friendly_name = entry.device.friendly_name;
        continue;
      }
      const record = this.createRecord(uuid, entry);
      this.outlets.set(uuid, record);
      toRegister.push(record);
    }

    if (toRegister.length === 0) {
      return;
    }

    try {
      await this.matter.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        toRegister.map((r) => r.accessory)
      );
    } catch (err) {
      this.log.error(`Failed to register Matter outlets: ${errorToString(err)}`);
      for (const record of toRegister) {
        record.energyReporter.dispose();
        this.outlets.delete(record.uuid);
      }
      return;
    }

    for (const record of toRegister) {
      record.registered = true;
      const restored = this.cached.has(record.uuid);
      this.cached.delete(record.uuid);
      this.log.info(
        `${restored ? 'Restored' : 'Registered'} Matter outlet: ${record.accessory.displayName} (${record.device.ieee_address})`
      );
      if (Object.keys(record.latestState).length > 0) {
        this.pushState(record, record.latestState);
      }
      this.requestState(record);
    }
  }

  private async unregisterUnwanted(wanted: Map<string, MatterOutletDevice>): Promise<void> {
    const toRemove: MatterAccessory[] = [];
    for (const [uuid, outlet] of this.outlets) {
      if (!wanted.has(uuid)) {
        outlet.energyReporter.dispose();
        this.outlets.delete(uuid);
        if (outlet.registered) {
          toRemove.push(outlet.accessory);
        }
      }
    }
    for (const [uuid, accessory] of this.cached) {
      if (!wanted.has(uuid)) {
        toRemove.push(accessory);
        this.cached.delete(uuid);
      }
    }
    if (toRemove.length === 0) {
      return;
    }
    for (const accessory of toRemove) {
      this.log.info(`Removing Matter outlet: ${accessory.displayName}`);
    }
    try {
      await this.matter.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toRemove);
    } catch (err) {
      this.log.error(`Failed to unregister Matter outlets: ${errorToString(err)}`);
    }
  }

  private createRecord(uuid: string, entry: MatterOutletDevice): OutletRecord {
    const record: OutletRecord = {
      uuid,
      device: entry.device,
      exposes: entry.exposes,
      accessory: this.createAccessory(uuid, entry),
      registered: false,
      latestState: {},
      lastPower: {},
      energyReporter: new ThrottledReporter<number>(this.energyReportIntervalMs, (energy) =>
        this.update(record, CLUSTER_ENERGY, { cumulativeEnergyImported: { energy } })
      ),
    };
    record.accessory.handlers = {
      onOff: {
        on: () => this.sendOnOff(record, true),
        off: () => this.sendOnOff(record, false),
      },
    };
    return record;
  }

  private createAccessory(uuid: string, entry: MatterOutletDevice): MatterAccessory<MatterOutletContext> {
    const { device, exposes } = entry;
    const clusters: Record<string, Record<string, unknown>> = {
      onOff: { onOff: false },
    };
    const power = initialPowerMeasurementState(exposes);
    if (power !== undefined) {
      clusters[CLUSTER_POWER] = power;
    }
    if (exposes.energy !== undefined) {
      clusters[CLUSTER_ENERGY] = { cumulativeEnergyImported: null };
    }
    return {
      UUID: uuid,
      displayName: getMatterDisplayName(device),
      deviceType: this.matter.deviceTypes.OnOffOutlet,
      serialNumber: truncateForMatter(device.ieee_address, uuid),
      manufacturer: truncateForMatter(device.definition?.vendor ?? '', 'Zigbee2MQTT'),
      model: truncateForMatter(device.definition?.model ?? '', 'Unknown'),
      firmwareRevision: device.software_build_id ? truncateForMatter(device.software_build_id, '') : undefined,
      context: {
        ieee_address: device.ieee_address,
        friendly_name: device.friendly_name,
      },
      clusters,
    };
  }

  private async sendOnOff(outlet: OutletRecord, on: boolean): Promise<void> {
    if (!this.host.isConnected()) {
      throw new Error(`Cannot switch ${outlet.device.friendly_name}: not connected to the MQTT server.`);
    }
    const payload = { [outlet.exposes.state.property]: on ? outlet.exposes.state.value_on : outlet.exposes.state.value_off };
    outlet.lastOnOff = on;
    await this.host.publishMessage(`${outlet.device.friendly_name}/set`, JSON.stringify(payload), {});
  }

  /** Ask Zigbee2MQTT for the current state, so restored outlets don't keep showing their cached state. */
  private requestState(outlet: OutletRecord): void {
    if (!exposesCanBeGet(outlet.exposes.state)) {
      return;
    }
    const payload = JSON.stringify({ [outlet.exposes.state.property]: '' });
    this.host.publishMessage(`${outlet.device.friendly_name}/get`, payload, {}).catch((err) => this.log.debug(errorToString(err)));
  }

  private pushState(outlet: OutletRecord, state: Record<string, unknown>): void {
    const onOff = onOffFromState(outlet.exposes, state);
    if (onOff !== undefined && onOff !== outlet.lastOnOff) {
      outlet.lastOnOff = onOff;
      this.update(outlet, CLUSTER_ON_OFF, { onOff });
    }

    const power = powerMeasurementFromState(outlet.exposes, state);
    const changed: PowerMeasurementState = {};
    for (const key of Object.keys(power) as (keyof PowerMeasurementState)[]) {
      if (power[key] !== outlet.lastPower[key]) {
        changed[key] = power[key];
      }
    }
    if (Object.keys(changed).length > 0) {
      outlet.lastPower = { ...outlet.lastPower, ...changed };
      this.update(outlet, CLUSTER_POWER, changed);
    }

    const energy = energyFromState(outlet.exposes, state);
    if (energy !== undefined) {
      outlet.energyReporter.submit(energy);
    }
  }

  private update(outlet: OutletRecord, cluster: string, attributes: Record<string, unknown>): void {
    this.log.debug(`Matter update for ${outlet.device.friendly_name}: ${cluster} ${JSON.stringify(attributes)}`);
    this.matter
      .updateAccessoryState(outlet.uuid, cluster, attributes)
      .catch((err) => this.log.warn(`Failed to update ${cluster} of Matter outlet ${outlet.device.friendly_name}: ${errorToString(err)}`));
  }
}
