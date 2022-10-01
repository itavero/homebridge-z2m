import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { hap } from '../../hap';
import { BinarySensorHandler } from './binary';

export class SmokeSensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'smoke';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      SmokeSensorHandler.generateIdentifier,
      'SmokeSensor',
      (n, t) => new hap.Service.SmokeSensor(n, t),
      hap.Characteristic.SmokeDetected,
      hap.Characteristic.SmokeDetected.SMOKE_DETECTED,
      hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED
    );
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.SmokeSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
