import { Characteristic } from 'homebridge';
import { hap } from '../../hap';
import { copyExposesRangeToCharacteristic, getOrAddCharacteristic } from '../../helpers';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { BasicSensorHandler } from './basic';

export abstract class LightSensorHandler extends BasicSensorHandler {
  public readonly mainCharacteristics: Characteristic[] = [];

  protected constructor(
    expose: ExposesEntryWithProperty,
    allExposes: ExposesEntryWithBinaryProperty[],
    accessory: BasicAccessory,
    identifierGen: (endpoint: string | undefined) => string,
    subType: string
  ) {
    super(accessory, expose, allExposes, identifierGen, (n, t) => new hap.Service.LightSensor(n, t), subType);
    const characteristic = getOrAddCharacteristic(this.service, hap.Characteristic.CurrentAmbientLightLevel);
    if (!copyExposesRangeToCharacteristic(expose, characteristic)) {
      characteristic.setProps({ minValue: 0 });
    }
    this.mainCharacteristics.push(characteristic);
    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, hap.Characteristic.CurrentAmbientLightLevel));
  }
}
