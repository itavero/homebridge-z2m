import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { hap } from '../../hap';
import { BinarySensorHandler } from './binary';

export class ContactSensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'contact';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, ContactSensorHandler.generateIdentifier, 'ContactSensor',
      (n, t) => new hap.Service.ContactSensor(n, t), hap.Characteristic.ContactSensorState,
      hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED, hap.Characteristic.ContactSensorState.CONTACT_DETECTED);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.ContactSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}