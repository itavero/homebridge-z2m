import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet, ExposesEntry, ExposesEntryWithBinaryProperty, ExposesEntryWithNumericRangeProperty, ExposesEntryWithProperty,
  exposesHasBinaryProperty, exposesHasNumericRangeProperty, exposesHasProperty, exposesIsPublished,
} from '../z2mModels';
import { hap } from '../hap';
import { getOrAddCharacteristic, groupByEndpoint } from '../helpers';
import { CharacteristicValue } from 'homebridge';
import {
  BinaryConditionCharacteristicMonitor,
  CharacteristicMonitor, MappingCharacteristicMonitor, NumericCharacteristicMonitor,
} from './monitor';

export class BatteryCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    const endpointMap = groupByEndpoint(exposes.filter(e =>
      exposesHasProperty(e) && exposesIsPublished(e) && (
        (e.name === 'battery' && exposesHasNumericRangeProperty(e))
        || (e.name === 'battery_low' && exposesHasBinaryProperty(e))
      )).map(e => e as ExposesEntryWithProperty));
    endpointMap.forEach((value, key) => {
      if (!accessory.isServiceHandlerIdKnown(BatteryHandler.generateIdentifier(key))) {
        this.createService(key, value, accessory);
      }
    });
  }

  private createService(endpoint: string | undefined, exposes: ExposesEntryWithProperty[], accessory: BasicAccessory): void {
    try {
      const handler = new BatteryHandler(endpoint, exposes, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn('Failed to setup battery service ' +
        `for accessory ${accessory.displayName} for endpoint ${endpoint}: ${error}`);
    }
  }
}

class BatteryHandler implements ServiceHandler {
  private monitors: CharacteristicMonitor[] = [];
  private batteryLevelExpose: ExposesEntryWithNumericRangeProperty | undefined;
  private batteryLowExpose: ExposesEntryWithBinaryProperty | undefined;

  constructor(endpoint: string | undefined, exposes: ExposesEntryWithProperty[], private readonly accessory: BasicAccessory) {
    this.identifier = BatteryHandler.generateIdentifier(endpoint);

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);
    accessory.log.debug(`Configuring Battery Service for ${serviceName}`);
    const service = accessory.getOrAddService(new hap.Service.BatteryService(serviceName, endpoint));
    getOrAddCharacteristic(service, hap.Characteristic.BatteryLevel);
    getOrAddCharacteristic(service, hap.Characteristic.StatusLowBattery);
    getOrAddCharacteristic(service, hap.Characteristic.ChargingState);

    // Note: no defined exposes name for the charge state, so assuming batteries are non-chargeable.
    service.updateCharacteristic(hap.Characteristic.ChargingState, hap.Characteristic.ChargingState.NOT_CHARGEABLE);

    this.batteryLevelExpose = exposes.find(e => e.name === 'battery') as ExposesEntryWithNumericRangeProperty;
    this.batteryLowExpose = exposes.find(e => e.name === 'battery_low') as ExposesEntryWithBinaryProperty;

    if (this.batteryLevelExpose !== undefined) {
      this.monitors.push(new NumericCharacteristicMonitor(this.batteryLevelExpose.property, service, hap.Characteristic.BatteryLevel,
        this.batteryLevelExpose.value_min, this.batteryLevelExpose.value_max));
    } else {
      if (this.batteryLowExpose === undefined) {
        throw new Error(`Can NOT create Battery Service (${serviceName}), if both 'battery' and 'battery_low' are missing.`);
      }

      // Mimic the battery level based on battery low indication.
      const fakeLevels = new Map<CharacteristicValue, CharacteristicValue>();
      fakeLevels.set(this.batteryLowExpose.value_on, 0);
      fakeLevels.set(this.batteryLowExpose.value_off, 100);
      this.monitors.push(new MappingCharacteristicMonitor(this.batteryLowExpose.property, service, hap.Characteristic.BatteryLevel,
        fakeLevels));
    }

    if (this.batteryLowExpose !== undefined) {
      const batteryLowMapping = new Map<CharacteristicValue, CharacteristicValue>();
      batteryLowMapping.set(this.batteryLowExpose.value_on,
        hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
      batteryLowMapping.set(this.batteryLowExpose.value_off,
        hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
      this.monitors.push(new MappingCharacteristicMonitor(this.batteryLowExpose.property, service, hap.Characteristic.StatusLowBattery,
        batteryLowMapping));
    } else {
      if (this.batteryLevelExpose === undefined) {
        throw new Error(`Can NOT create Battery Service (${serviceName}), if both 'battery' and 'battery_low' are missing.`);
      }
      this.monitors.push(new BinaryConditionCharacteristicMonitor(this.batteryLevelExpose.property, service,
        hap.Characteristic.StatusLowBattery, (v) => ((v as number) < 30),
        hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW,
        hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL));
    }
  }

  identifier: string;
  get getableKeys(): string[] {
    const keys: string[] = [];
    if (this.batteryLevelExpose !== undefined && exposesCanBeGet(this.batteryLevelExpose)) {
      keys.push(this.batteryLevelExpose.property);
    }
    if (this.batteryLowExpose !== undefined && exposesCanBeGet(this.batteryLowExpose)) {
      keys.push(this.batteryLowExpose.property);
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach(m => m.callback(state));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.BatteryService.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}