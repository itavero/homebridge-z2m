import { Characteristic } from 'homebridge';
import { hap } from '../../hap';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { BasicLogger } from '../../logger';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { BasicSensorHandler, isHistoryConfig } from './basic';

export class HumiditySensorHandler extends BasicSensorHandler {
  public static readonly exposesName: string = 'humidity';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;
  public static readonly converterConfigTag: string = 'humidity';

  public readonly mainCharacteristics: Characteristic[] = [];

  public static isValidConverterConfiguration(config: unknown, _tag: string, _logger: BasicLogger | undefined): boolean {
    return isHistoryConfig(config);
  }

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, HumiditySensorHandler.generateIdentifier, (n, t) => new hap.Service.HumiditySensor(n, t));
    accessory.log.debug(`Configuring HumiditySensor for ${this.serviceName}`);

    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentRelativeHumidity);
    copyExposesRangeToCharacteristic(expose, characteristic);
    this.mainCharacteristics.push(characteristic);
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentRelativeHumidity));
    this.trySetupHistory(accessory, 'weather', 'humidity', HumiditySensorHandler.converterConfigTag);
  }

  public static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.HumiditySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
