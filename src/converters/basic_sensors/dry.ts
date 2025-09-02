import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { hap } from '../../hap';
import { BinarySensorHandler } from './binary';

export class DrySensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'dry';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.BINARY;

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      DrySensorHandler.generateIdentifier,
      'Dry Sensor (Water Shortage)',
      (n, t) => new hap.Service.LeakSensor(n, t),
      hap.Characteristic.LeakDetected,
      hap.Characteristic.LeakDetected.LEAK_DETECTED,
      hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED,
      'dry'
    );
  }

  public static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'dry_' + hap.Service.LeakSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
