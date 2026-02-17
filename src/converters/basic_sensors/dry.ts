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
      'Dry Sensor',
      (n, t) => new hap.Service.ContactSensor(n, t),
      hap.Characteristic.ContactSensorState,
      hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
      hap.Characteristic.ContactSensorState.CONTACT_DETECTED,
      'dry'
    );
  }

  public static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'dry_' + hap.Service.ContactSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
