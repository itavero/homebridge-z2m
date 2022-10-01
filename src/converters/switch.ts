import { BasicAccessory, ConverterConfigurationRegistry, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet,
  exposesCanBeSet,
  ExposesEntry,
  ExposesEntryWithBinaryProperty,
  ExposesEntryWithFeatures,
  exposesHasAllRequiredFeatures,
  exposesHasBinaryProperty,
  exposesHasFeatures,
  exposesIsPublished,
  ExposesKnownTypes,
  ExposesPredicate,
} from '../z2mModels';
import { hap } from '../hap';
import { getOrAddCharacteristic } from '../helpers';
import { CharacteristicSetCallback, CharacteristicValue } from 'homebridge';
import { CharacteristicMonitor, MappingCharacteristicMonitor } from './monitor';

interface SwitchConfig {
  type?: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSwitchConfig = (x: any): x is SwitchConfig =>
  x !== undefined &&
  (x.type === undefined ||
    (typeof x.type === 'string' &&
      x.type.length > 0 &&
      [SwitchCreator.CONFIG_TYPE_SWITCH, SwitchCreator.CONFIG_TYPE_OUTLET].includes(x.type.toLowerCase())));

export class SwitchCreator implements ServiceCreator {
  public static readonly CONFIG_TAG = 'switch';
  public static readonly CONFIG_TYPE_SWITCH = 'switch';
  public static readonly CONFIG_TYPE_OUTLET = 'outlet';

  constructor(converterConfigRegistry: ConverterConfigurationRegistry) {
    converterConfigRegistry.registerConverterConfiguration(SwitchCreator.CONFIG_TAG, SwitchCreator.isValidConverterConfiguration);
  }

  private static isValidConverterConfiguration(config: unknown): boolean {
    return isSwitchConfig(config);
  }

  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    let exposeAsOutlet = false;
    const converterConfig = accessory.getConverterConfiguration(SwitchCreator.CONFIG_TAG);
    if (isSwitchConfig(converterConfig) && converterConfig.type === SwitchCreator.CONFIG_TYPE_OUTLET) {
      exposeAsOutlet = true;
    }
    exposes
      .filter(
        (e) =>
          e.type === ExposesKnownTypes.SWITCH &&
          exposesHasFeatures(e) &&
          exposesHasAllRequiredFeatures(e, [SwitchHandler.PREDICATE_STATE]) &&
          !accessory.isServiceHandlerIdKnown(SwitchHandler.generateIdentifier(exposeAsOutlet, e.endpoint))
      )
      .forEach((e) => this.createService(e as ExposesEntryWithFeatures, accessory, exposeAsOutlet));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory, exposeAsOutlet: boolean): void {
    try {
      const handler = new SwitchHandler(expose, accessory, exposeAsOutlet);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup switch for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`);
    }
  }
}

class SwitchHandler implements ServiceHandler {
  public static readonly PREDICATE_STATE: ExposesPredicate = (e) =>
    exposesHasBinaryProperty(e) && e.name === 'state' && exposesCanBeSet(e) && exposesIsPublished(e);

  private monitor: CharacteristicMonitor;
  private stateExpose: ExposesEntryWithBinaryProperty;

  constructor(expose: ExposesEntryWithFeatures, private readonly accessory: BasicAccessory, exposeAsOutlet: boolean) {
    const endpoint = expose.endpoint;
    const serviceTypeName = exposeAsOutlet ? 'Outlet' : 'Switch';

    this.identifier = SwitchHandler.generateIdentifier(exposeAsOutlet, endpoint);

    const potentialStateExpose = expose.features.find((e) => SwitchHandler.PREDICATE_STATE(e)) as ExposesEntryWithBinaryProperty;
    if (potentialStateExpose === undefined) {
      throw new Error(`Required "state" property not found for ${serviceTypeName}.`);
    }
    this.stateExpose = potentialStateExpose;

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);

    accessory.log.debug(`Configuring ${serviceTypeName} for ${serviceName}`);
    const service = accessory.getOrAddService(
      exposeAsOutlet ? new hap.Service.Outlet(serviceName, endpoint) : new hap.Service.Switch(serviceName, endpoint)
    );

    getOrAddCharacteristic(service, hap.Characteristic.On).on('set', this.handleSetOn.bind(this));
    const onOffValues = new Map<CharacteristicValue, CharacteristicValue>();
    onOffValues.set(this.stateExpose.value_on, true);
    onOffValues.set(this.stateExpose.value_off, false);
    this.monitor = new MappingCharacteristicMonitor(this.stateExpose.property, service, hap.Characteristic.On, onOffValues);
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

  static generateIdentifier(exposeAsOutlet: boolean, endpoint: string | undefined) {
    let identifier = exposeAsOutlet ? hap.Service.Outlet.UUID : hap.Service.Switch.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
