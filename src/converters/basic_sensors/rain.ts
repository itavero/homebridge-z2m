import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { hap } from '../../hap';
import { BinarySensorHandler } from './binary';

export class RainSensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'rain';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.BINARY;

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      RainSensorHandler.generateIdentifier,
      'Rain Sensor',
      (n, t) => new hap.Service.ContactSensor(n, t),
      hap.Characteristic.ContactSensorState,
      hap.Characteristic.ContactSensorState.CONTACT_DETECTED,
      hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
      'rain'
    );
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'rain_' + hap.Service.ContactSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
