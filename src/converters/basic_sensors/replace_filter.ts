import { hap } from '../../hap';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { BinarySensorHandler } from './binary';

export class ReplaceFilterSensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'replace_filter';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.BINARY;

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      ReplaceFilterSensorHandler.generateIdentifier,
      'ReplaceFilterSensor',
      (n, t) => new hap.Service.ContactSensor(n, t),
      hap.Characteristic.ContactSensorState,
      hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
      hap.Characteristic.ContactSensorState.CONTACT_DETECTED,
      'replace_filter'
    );
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'replace_filter_' + hap.Service.ContactSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
