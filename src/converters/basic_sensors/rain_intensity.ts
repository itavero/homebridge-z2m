import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { hap } from '../../hap';
import { BasicSensorHandler } from './basic';
import { Characteristic } from 'homebridge';

export class RainIntensitySensorHandler extends BasicSensorHandler {
  public static readonly exposesName: string = 'rain_intensity';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;

  public readonly mainCharacteristics: Characteristic[] = [];

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose,
      allExposes,
      RainIntensitySensorHandler.generateIdentifier,
      (n, t) => new hap.Service.LightSensor(n, t),
      'rain_intensity'
    );
    accessory.log.debug(`Configuring RainIntensitySensor for ${this.serviceName}`);

    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentAmbientLightLevel);
    if (!copyExposesRangeToCharacteristic(expose, characteristic)) {
      characteristic.setProps({
        minValue: 0,
      });
    }
    this.mainCharacteristics.push(characteristic);

    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentAmbientLightLevel));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'rain_intensity_' + hap.Service.LightSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
