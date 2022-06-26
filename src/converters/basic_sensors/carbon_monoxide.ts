import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { hap } from '../../hap';
import { BinarySensorHandler } from './binary';


export class CarbonMonoxideSensorHandler extends BinarySensorHandler {
  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, CarbonMonoxideSensorHandler.generateIdentifier,
      'CarbonMonoxideSensor', (n, t) => new hap.Service.CarbonMonoxideSensor(n, t), hap.Characteristic.CarbonMonoxideDetected,
      hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL, hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.CarbonMonoxideSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
