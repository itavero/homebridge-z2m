import { Characteristic, CharacteristicValue, Service } from 'homebridge';
import { hap } from '../../hap';
import { getOrAddCharacteristic } from '../../helpers';
import { BasicLogger } from '../../logger';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, exposesCanBeGet, exposesIsPublished } from '../../z2mModels';
import { BasicAccessory, FakeGatoHistoryType, HistoryService, ServiceHandler } from '../interfaces';
import { CharacteristicMonitor, MappingCharacteristicMonitor } from '../monitor';

export type ServiceConstructor = (serviceName: string, subType: string | undefined) => Service;

export type IdentifierGenerator = (endpoint: string | undefined, accessory: BasicAccessory) => string;

export interface HistoryConfig {
  history?: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: type guard function needs to accept any input
export const isHistoryConfig = (x: any): x is HistoryConfig =>
  x !== null && typeof x === 'object' && (x.history === undefined || typeof x.history === 'boolean');

export abstract class BasicSensorHandler implements ServiceHandler {
  protected log: BasicLogger;
  protected monitors: CharacteristicMonitor[] = [];
  protected tamperExpose?: ExposesEntryWithBinaryProperty;
  protected lowBatteryExpose?: ExposesEntryWithBinaryProperty;
  protected service: Service;
  protected serviceName: string;
  identifier = '';

  private historyService?: HistoryService;
  private historyEntryKey?: string;
  private historyTransform?: (value: unknown) => number | boolean;

  constructor(
    accessory: BasicAccessory,
    protected readonly sensorExpose: ExposesEntryWithProperty,
    otherExposes: ExposesEntryWithBinaryProperty[],
    identifierGen: IdentifierGenerator,
    service: ServiceConstructor,
    additionalSubType?: string | undefined
  ) {
    this.log = accessory.log;
    const endpoint = sensorExpose.endpoint;

    let sub = endpoint;
    if (additionalSubType !== undefined) {
      if (sub === undefined) {
        sub = additionalSubType;
      } else {
        sub += ' ' + additionalSubType;
      }
    }

    this.serviceName = accessory.getDefaultServiceDisplayName(sub);

    this.identifier = identifierGen(endpoint, accessory);
    this.service = accessory.getOrAddService(service(this.serviceName, sub));
    this.tryCreateLowBattery(otherExposes, this.service);
    this.tryCreateTamper(otherExposes, this.service);
  }

  abstract mainCharacteristics: (Characteristic | undefined)[];

  get getableKeys(): string[] {
    const keys: string[] = [];
    if (exposesCanBeGet(this.sensorExpose)) {
      keys.push(this.sensorExpose.property);
    }
    if (this.tamperExpose !== undefined && exposesCanBeGet(this.tamperExpose)) {
      keys.push(this.tamperExpose.property);
    }
    if (this.lowBatteryExpose !== undefined && exposesCanBeGet(this.lowBatteryExpose)) {
      keys.push(this.lowBatteryExpose.property);
    }
    return keys;
  }

  /**
   * Registers this sensor as a contributor to a fakegato history service.
   * Multiple sensors on the same accessory sharing the same history type will share
   * the same service instance (e.g. temperature + humidity both contribute to 'weather').
   *
   * History can be disabled per-service via:
   *   `converters: { <configTag>: { history: false } }`
   */
  protected trySetupHistory(
    accessory: BasicAccessory,
    type: FakeGatoHistoryType,
    entryKey: string,
    configTag: string,
    transform?: (value: unknown) => number | boolean
  ): void {
    // Check per-service opt-out via converter config
    const converterConfig = accessory.getConverterConfiguration(configTag);
    if (converterConfig !== undefined && isHistoryConfig(converterConfig) && converterConfig.history === false) {
      return;
    }
    this.historyService = accessory.getOrAddHistoryService(type);
    if (this.historyService !== undefined) {
      this.historyEntryKey = entryKey;
      this.historyTransform = transform;
    }
  }

  protected createOptionalGenericCharacteristics(exposes: ExposesEntryWithBinaryProperty[], service: Service) {
    this.tryCreateTamper(exposes, service);
    this.tryCreateLowBattery(exposes, service);
  }

  private tryCreateTamper(exposes: ExposesEntryWithBinaryProperty[], service: Service) {
    this.tamperExpose = exposes.find((e) => e.name === 'tamper' && exposesIsPublished(e));

    if (this.tamperExpose !== undefined) {
      getOrAddCharacteristic(service, hap.Characteristic.StatusTampered);
      const mapping = new Map<CharacteristicValue, CharacteristicValue>();
      mapping.set(this.tamperExpose.value_on, hap.Characteristic.StatusTampered.TAMPERED);
      mapping.set(this.tamperExpose.value_off, hap.Characteristic.StatusTampered.NOT_TAMPERED);
      this.monitors.push(new MappingCharacteristicMonitor(this.tamperExpose.property, service, hap.Characteristic.StatusTampered, mapping));
    }
  }

  private tryCreateLowBattery(exposes: ExposesEntryWithBinaryProperty[], service: Service) {
    this.lowBatteryExpose = exposes.find((e) => e.name === 'battery_low' && exposesIsPublished(e));

    if (this.lowBatteryExpose !== undefined) {
      getOrAddCharacteristic(service, hap.Characteristic.StatusLowBattery);
      const mapping = new Map<CharacteristicValue, CharacteristicValue>();
      mapping.set(this.lowBatteryExpose.value_on, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
      mapping.set(this.lowBatteryExpose.value_off, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
      this.monitors.push(
        new MappingCharacteristicMonitor(this.lowBatteryExpose.property, service, hap.Characteristic.StatusLowBattery, mapping)
      );
    }
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach((m) => m.callback(state, this.log));
    if (this.historyService !== undefined && this.historyEntryKey !== undefined) {
      const rawValue = state[this.sensorExpose.property];
      if (rawValue !== undefined) {
        const entryValue = this.historyTransform !== undefined ? this.historyTransform(rawValue) : (rawValue as number);
        const entry: { time: number } & Record<string, number | boolean> = { time: Math.round(Date.now() / 1000) };
        entry[this.historyEntryKey] = entryValue;
        try {
          this.historyService.addEntry(entry);
        } catch (e) {
          this.log.debug(`Failed to add history entry: ${e}`);
        }
      }
    }
  }
}
