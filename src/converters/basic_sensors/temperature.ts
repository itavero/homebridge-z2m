import { Characteristic } from 'homebridge';
import { hap } from '../../hap';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { BasicLogger } from '../../logger';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { BasicSensorHandler, isHistoryConfig } from './basic';

export class TemperatureSensorHandler extends BasicSensorHandler {
  public static readonly exposesName: string = 'temperature';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;
  public static readonly converterConfigTag: string = 'temperature';

  public readonly mainCharacteristics: Characteristic[] = [];

  public static isValidConverterConfiguration(config: unknown, _tag: string, _logger: BasicLogger | undefined): boolean {
    return isHistoryConfig(config);
  }

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
    this.mainCharacteristics.push(characteristic);
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentTemperature));
    this.trySetupHistory(accessory, 'weather', 'temp', TemperatureSensorHandler.converterConfigTag);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.TemperatureSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
