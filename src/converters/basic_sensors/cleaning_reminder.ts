import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { hap } from '../../hap';
import { BinarySensorHandler } from './binary';

export class CleaningReminderSensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'cleaning_reminder';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.BINARY;

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      CleaningReminderSensorHandler.generateIdentifier,
      'Cleaning Reminder',
      (n, t) => new hap.Service.ContactSensor(n, t),
      hap.Characteristic.ContactSensorState,
      hap.Characteristic.ContactSensorState.CONTACT_DETECTED,
      hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
      'cleaning'
    );
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'cleaning_' + hap.Service.ContactSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
