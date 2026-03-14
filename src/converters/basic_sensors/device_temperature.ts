import { Characteristic } from 'homebridge';
import { hap } from '../../hap';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { BasicSensorHandler } from './basic';

export class DeviceTemperatureSensorHandler extends BasicSensorHandler {
  public static readonly exposesName: string = 'device_temperature';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;

  public readonly mainCharacteristics: Characteristic[] = [];

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose,
      allExposes,
      DeviceTemperatureSensorHandler.generateIdentifier,
      (n, t) => new hap.Service.TemperatureSensor(n, t),
      DeviceTemperatureSensorHandler.exposesName
    );
    accessory.log.debug(`Configuring Device TemperatureSensor for ${this.serviceName}`);
    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentTemperature);
    if (!copyExposesRangeToCharacteristic(expose, characteristic)) {
      // Cannot take over range from exposes entry -> Set default range
      characteristic.setProps({
        minValue: -100,
        maxValue: 100,
      });
    }
    this.mainCharacteristics.push(characteristic);
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentTemperature));
  }

  static generateIdentifier(endpoint: string | undefined) {
    if (endpoint === DeviceTemperatureSensorHandler.exposesName) {
      endpoint = undefined;
    }
    let identifier = hap.Service.TemperatureSensor.UUID + '_' + DeviceTemperatureSensorHandler.exposesName;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
