import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet,
  exposesCanBeSet,
  ExposesEntry,
  ExposesEntryWithBinaryProperty,
  ExposesEntryWithEnumProperty,
  ExposesEntryWithFeatures,
  exposesHasAllRequiredFeatures,
  exposesHasBinaryProperty,
  exposesHasEnumProperty,
  exposesHasFeatures,
  exposesIsPublished,
  ExposesKnownTypes,
  ExposesPredicate,
} from '../z2mModels';
import { hap } from '../hap';
import { getOrAddCharacteristic } from '../helpers';
import { CharacteristicSetCallback, CharacteristicValue } from 'homebridge';
import { CharacteristicMonitor, MappingCharacteristicMonitor } from './monitor';

export class LockCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes
      .filter(
        (e) =>
          e.type === ExposesKnownTypes.LOCK &&
          exposesHasFeatures(e) &&
          exposesHasAllRequiredFeatures(e, [LockHandler.PREDICATE_LOCK_STATE, LockHandler.PREDICATE_STATE]) &&
          !accessory.isServiceHandlerIdKnown(LockHandler.generateIdentifier(e.endpoint))
      )
      .forEach((e) => this.createService(e as ExposesEntryWithFeatures, accessory));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory): void {
    try {
      const handler = new LockHandler(expose, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup lock for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`);
    }
  }
}

class LockHandler implements ServiceHandler {
  public static readonly PREDICATE_STATE: ExposesPredicate = (e) =>
    exposesHasBinaryProperty(e) && e.name === LockHandler.NAME_STATE && exposesCanBeSet(e) && exposesIsPublished(e);

  public static readonly PREDICATE_LOCK_STATE: ExposesPredicate = (e) =>
    exposesHasEnumProperty(e) && e.name === LockHandler.NAME_LOCK_STATE && exposesIsPublished(e);

  private static readonly NAME_STATE = 'state';
  private static readonly NAME_LOCK_STATE = 'lock_state';
  private static get BASIC_MAPPING(): Map<string, CharacteristicValue> {
    const map = new Map<string, CharacteristicValue>();
    map.set('locked', hap.Characteristic.LockCurrentState.SECURED);
    map.set('unlocked', hap.Characteristic.LockCurrentState.UNSECURED);
    map.set('not_fully_locked', hap.Characteristic.LockCurrentState.JAMMED);
    return map;
  }

  private monitors: CharacteristicMonitor[] = [];
  private stateExpose: ExposesEntryWithBinaryProperty;
  private lockStateExpose: ExposesEntryWithEnumProperty;

  constructor(expose: ExposesEntryWithFeatures, private readonly accessory: BasicAccessory) {
    const endpoint = expose.endpoint;
    this.identifier = LockHandler.generateIdentifier(endpoint);

    const potentialStateExpose = expose.features.find((e) => LockHandler.PREDICATE_STATE(e)) as ExposesEntryWithBinaryProperty;
    if (potentialStateExpose === undefined) {
      throw new Error(`Required "${LockHandler.NAME_STATE}" property not found for Lock.`);
    }
    this.stateExpose = potentialStateExpose;

    const potentialLockStateExpose = expose.features.find((e) => LockHandler.PREDICATE_LOCK_STATE(e)) as ExposesEntryWithEnumProperty;
    if (potentialLockStateExpose === undefined) {
      throw new Error(`Required "${LockHandler.NAME_LOCK_STATE}" property not found for Lock.`);
    }
    this.lockStateExpose = potentialLockStateExpose;

    const lockStateMapping = LockHandler.BASIC_MAPPING;
    const missingValues = this.lockStateExpose.values.filter((v) => !lockStateMapping.has(v));
    if (missingValues.length > 0) {
      throw new Error(`Property "${LockHandler.NAME_LOCK_STATE}" of Lock does not support value(s): ${missingValues.join(', ')}`);
    }

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);

    accessory.log.debug(`Configuring LockMechanism for ${serviceName}`);
    const service = accessory.getOrAddService(new hap.Service.LockMechanism(serviceName, endpoint));

    getOrAddCharacteristic(service, hap.Characteristic.LockTargetState).on('set', this.handleSetState.bind(this));
    const stateValues = new Map<CharacteristicValue, CharacteristicValue>();
    stateValues.set(this.stateExpose.value_on, hap.Characteristic.LockTargetState.SECURED);
    stateValues.set(this.stateExpose.value_off, hap.Characteristic.LockTargetState.UNSECURED);
    this.monitors.push(
      new MappingCharacteristicMonitor(this.stateExpose.property, service, hap.Characteristic.LockTargetState, stateValues)
    );

    getOrAddCharacteristic(service, hap.Characteristic.LockCurrentState);
    for (const value of this.lockStateExpose.values) {
      if (!lockStateMapping.has(value)) {
        lockStateMapping.set(value, hap.Characteristic.LockCurrentState.UNKNOWN);
      }
    }
    this.monitors.push(
      new MappingCharacteristicMonitor(this.lockStateExpose.property, service, hap.Characteristic.LockCurrentState, lockStateMapping)
    );
  }

  identifier: string;
  get getableKeys(): string[] {
    const keys: string[] = [];
    if (exposesCanBeGet(this.stateExpose)) {
      keys.push(this.stateExpose.property);
    }
    if (exposesCanBeGet(this.lockStateExpose)) {
      keys.push(this.lockStateExpose.property);
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach((m) => m.callback(state));
  }

  private handleSetState(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data[this.stateExpose.property] = (value as boolean) ? this.stateExpose.value_on : this.stateExpose.value_off;
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.LockMechanism.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
