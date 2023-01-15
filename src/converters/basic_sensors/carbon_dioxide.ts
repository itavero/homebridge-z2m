import { Characteristic } from 'homebridge';
import { BasicSensorHandler } from './basic';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { hap } from '../../hap';
import { getOrAddCharacteristic, copyExposesRangeToCharacteristic } from '../../helpers';
import { BasicAccessory } from '../interfaces';
import { BinaryConditionCharacteristicMonitor, PassthroughCharacteristicMonitor } from '../monitor';

export class CarbonDioxideSensorHandler extends BasicSensorHandler {
  public static readonly exposesName: string = 'co2';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;

  // Default threshold for CO2 detection (in ppm)
  public static readonly defaultCo2Threshold = 1200;

  public readonly mainCharacteristics: (Characteristic | undefined)[] = [];

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose,
      allExposes,
      CarbonDioxideSensorHandler.generateIdentifier,
      (n, t) => new hap.Service.CarbonDioxideSensor(n, t)
    );
    accessory.log.debug(`Configuring CO2 Sensor for ${this.serviceName}`);

    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CarbonDioxideLevel);
    copyExposesRangeToCharacteristic(expose, characteristic);
    this.mainCharacteristics.push(getOrAddCharacteristic(this.service, hap.Characteristic.CarbonDioxideDetected));
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CarbonDioxideLevel));
    this.monitors.push(
      new BinaryConditionCharacteristicMonitor(
        expose.property,
        this.service,
        hap.Characteristic.CarbonDioxideDetected,
        (v) => (v as number) >= CarbonDioxideSensorHandler.defaultCo2Threshold,
        hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL,
        hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL
      )
    );
  }

  public static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.CarbonDioxideSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
