import { Characteristic, CharacteristicValue } from 'homebridge';
import { hap } from '../../hap';
import { getOrAddCharacteristic } from '../../helpers';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { MappingCharacteristicMonitor } from '../monitor';
import { BasicSensorHandler } from './basic';

export class SoilFertilityWarningSensorHandler extends BasicSensorHandler {
  public static readonly exposesName: string = 'soil_fertility_warning';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.ENUM;

  public readonly mainCharacteristics: Characteristic[] = [];

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose,
      allExposes,
      SoilFertilityWarningSensorHandler.generateIdentifier,
      (n, t) => new hap.Service.ContactSensor(n, t),
      'soil_fertility_warning'
    );
    accessory.log.debug(`Configuring SoilFertilityWarningSensor for ${this.serviceName}`);

    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.ContactSensorState);
    this.mainCharacteristics.push(characteristic);

    const mapping = new Map<CharacteristicValue, CharacteristicValue>();
    mapping.set('alarm', hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    mapping.set('none', hap.Characteristic.ContactSensorState.CONTACT_DETECTED);
    this.monitors.push(new MappingCharacteristicMonitor(expose.property, this.service, hap.Characteristic.ContactSensorState, mapping));
  }

  public static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'soil_fertility_warning_' + hap.Service.ContactSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
