import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { hap } from '../../hap';
import { BasicSensorHandler } from './basic';
import { Characteristic } from 'homebridge';

export class HumiditySensorHandler extends BasicSensorHandler {
  public static readonly exposesName: string = 'humidity';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, HumiditySensorHandler.generateIdentifier, (n, t) => new hap.Service.HumiditySensor(n, t));
    accessory.log.debug(`Configuring HumiditySensor for ${this.serviceName}`);

    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentRelativeHumidity);
    copyExposesRangeToCharacteristic(expose, characteristic);
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentRelativeHumidity));
  }

  get mainCharacteristics(): Characteristic[] {
    return [this.service.getCharacteristic(hap.Characteristic.CurrentRelativeHumidity)];
  }

  public static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.HumiditySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
