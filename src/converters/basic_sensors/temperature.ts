import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { hap } from '../../hap';
import { BasicSensorHandler } from './basic';
import { Characteristic } from 'homebridge';

export class TemperatureSensorHandler extends BasicSensorHandler {
  public static readonly exposesName: string = 'temperature';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, TemperatureSensorHandler.generateIdentifier, (n, t) => new hap.Service.TemperatureSensor(n, t));
    accessory.log.debug(`Configuring TemperatureSensor for ${this.serviceName}`);
    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentTemperature);
    if (!copyExposesRangeToCharacteristic(expose, characteristic)) {
      // Cannot take over range from exposes entry -> Set default range
      characteristic.setProps({
        minValue: -100,
        maxValue: 100,
      });
    }
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentTemperature));
  }

  get mainCharacteristics(): Characteristic[] {
    return [this.service.getCharacteristic(hap.Characteristic.CurrentTemperature)];
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.TemperatureSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
