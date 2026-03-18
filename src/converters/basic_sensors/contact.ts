import { hap } from '../../hap';
import { BasicLogger } from '../../logger';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { BinarySensorHandler, isBinarySensorConfig } from './binary';

export class ContactSensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'contact';
  public static readonly converterConfigTag: string = 'contact';

  public static isValidConverterConfiguration(config: unknown, _tag: string, _logger: BasicLogger | undefined): boolean {
    return isBinarySensorConfig(config);
  }

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      ContactSensorHandler.generateIdentifier,
      'ContactSensor',
      (n, t) => new hap.Service.ContactSensor(n, t),
      hap.Characteristic.ContactSensorState,
      hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
      hap.Characteristic.ContactSensorState.CONTACT_DETECTED
    );
    // contact=true means closed (CONTACT_DETECTED), fakegato door status=0 means closed
    this.trySetupHistory(accessory, 'door', 'status', ContactSensorHandler.converterConfigTag, (v) => (v ? 0 : 1));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.ContactSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
