import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { hap } from '../../hap';
import { BasicSensorHandler } from './basic';

export class HumiditySensorHandler extends BasicSensorHandler {
  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, HumiditySensorHandler.generateIdentifier, (n, t) => new hap.Service.HumiditySensor(n, t));
    accessory.log.debug(`Configuring HumiditySensor for ${this.serviceName}`);

    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentRelativeHumidity);
    copyExposesRangeToCharacteristic(expose, characteristic);
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentRelativeHumidity));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.HumiditySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}