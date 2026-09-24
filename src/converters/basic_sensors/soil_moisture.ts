import { Characteristic } from 'homebridge';
import { hap } from '../../hap';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { BasicSensorHandler } from './basic';

export class SoilMoistureSensorHandler extends BasicSensorHandler {
  public static readonly exposesName: string = 'soil_moisture';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;

  public readonly mainCharacteristics: Characteristic[] = [];

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose,
      allExposes,
      SoilMoistureSensorHandler.generateIdentifier,
      (n, t) => new hap.Service.HumiditySensor(n, t),
      'soil'
    );
    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentRelativeHumidity);
    copyExposesRangeToCharacteristic(expose, characteristic);
    this.mainCharacteristics.push(characteristic);
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentRelativeHumidity));
  }

  public static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'soil_' + hap.Service.HumiditySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
