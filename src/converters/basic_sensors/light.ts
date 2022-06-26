import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { hap } from '../../hap';
import { BasicSensorHandler } from './basic';

export class LightSensorHandler extends BasicSensorHandler {
  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, LightSensorHandler.generateIdentifier, (n, t) => new hap.Service.LightSensor(n, t));
    accessory.log.debug(`Configuring LightSensor for ${this.serviceName}`);

    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentAmbientLightLevel);
    if (!copyExposesRangeToCharacteristic(expose, characteristic)) {
      // Cannot take over range from exposes entry -> Set default props
      characteristic.setProps({
        minValue: 0,
      });
    }

    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentAmbientLightLevel));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.LightSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}