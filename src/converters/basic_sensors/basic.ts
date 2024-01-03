import { BasicAccessory, ServiceHandler } from '../interfaces';
import { exposesCanBeGet, ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, exposesIsPublished } from '../../z2mModels';
import { CharacteristicMonitor, MappingCharacteristicMonitor } from '../monitor';
import { Characteristic, CharacteristicValue, Service } from 'homebridge';
import { getOrAddCharacteristic } from '../../helpers';
import { hap } from '../../hap';

export interface ServiceConstructor {
  (serviceName: string, subType: string | undefined): Service;
}

export interface IdentifierGenerator {
  (endpoint: string | undefined, accessory: BasicAccessory): string;
}

export abstract class BasicSensorHandler implements ServiceHandler {
  protected monitors: CharacteristicMonitor[] = [];
  protected tamperExpose?: ExposesEntryWithBinaryProperty;
  protected lowBatteryExpose?: ExposesEntryWithBinaryProperty;
  protected service: Service;
  protected serviceName: string;
  identifier = '';

  constructor(
    accessory: BasicAccessory,
    protected readonly sensorExpose: ExposesEntryWithProperty,
    otherExposes: ExposesEntryWithBinaryProperty[],
    identifierGen: IdentifierGenerator,
    service: ServiceConstructor,
    additionalSubType?: string | undefined
  ) {
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
    this.monitors.forEach((m) => m.callback(state));
  }
}
