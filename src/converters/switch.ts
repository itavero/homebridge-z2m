import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet, exposesCanBeSet, ExposesEntry, ExposesEntryWithBinaryProperty, ExposesEntryWithFeatures, exposesHasBinaryProperty,
  exposesHasFeatures, exposesIsPublished, ExposesKnownTypes,
} from '../z2mModels';
import { hap } from '../hap';
import { getOrAddCharacteristic } from '../helpers';
import { CharacteristicSetCallback, CharacteristicValue } from 'homebridge';
import {
  CharacteristicMonitor, MappingCharacteristicMonitor,
} from './monitor';

export class SwitchCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes.filter(e => e.type === ExposesKnownTypes.SWITCH && exposesHasFeatures(e)
      && !accessory.isServiceHandlerIdKnown(SwitchHandler.generateIdentifier(e.endpoint)))
      .forEach(e => this.createService(e as ExposesEntryWithFeatures, accessory));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory): void {
    try {
      const handler = new SwitchHandler(expose, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup switch for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`);
    }
  }
}

class SwitchHandler implements ServiceHandler {
  private monitor: CharacteristicMonitor;
  private stateExpose: ExposesEntryWithBinaryProperty;

  constructor(expose: ExposesEntryWithFeatures, private readonly accessory: BasicAccessory) {
    const endpoint = expose.endpoint;
    this.identifier = SwitchHandler.generateIdentifier(endpoint);

    const potentialStateExpose = expose.features.find(e => exposesHasBinaryProperty(e) && !accessory.isPropertyExcluded(e.property)
      && e.name === 'state' && exposesCanBeSet(e) && exposesIsPublished(e)) as ExposesEntryWithBinaryProperty;
    if (potentialStateExpose === undefined) {
      throw new Error('Required "state" property not found for Switch.');
    }
    this.stateExpose = potentialStateExpose;

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);

    accessory.log.debug(`Configuring Switch for ${serviceName}`);
    const service = accessory.getOrAddService(new hap.Service.Switch(serviceName, endpoint));

    getOrAddCharacteristic(service, hap.Characteristic.On).on('set', this.handleSetOn.bind(this));
    const onOffValues = new Map<CharacteristicValue, CharacteristicValue>();
    onOffValues.set(this.stateExpose.value_on, true);
    onOffValues.set(this.stateExpose.value_off, false);
    this.monitor = new MappingCharacteristicMonitor(this.stateExpose.property, service, hap.Characteristic.On,
      onOffValues);
  }

  identifier: string;
  get getableKeys(): string[] {
    const keys: string[] = [];
    if (exposesCanBeGet(this.stateExpose)) {
      keys.push(this.stateExpose.property);
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    this.monitor.callback(state);
  }

  private handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data[this.stateExpose.property] = (value as boolean) ? this.stateExpose.value_on : this.stateExpose.value_off;
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.Switch.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}