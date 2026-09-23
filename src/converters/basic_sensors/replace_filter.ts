import { hap } from '../../hap';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { BinarySensorHandler } from './binary';

export class ReplaceFilterSensorHandler extends BinarySensorHandler {
  public static readonly exposesName = 'replace_filter';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.BINARY;

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      ReplaceFilterSensorHandler.generateIdentifier,
      'ReplaceFilterSensor',
      (n, t) => new hap.Service.FilterMaintenance(n, t),
      hap.Characteristic.FilterChangeIndication,
      hap.Characteristic.FilterChangeIndication.CHANGE_FILTER,
      hap.Characteristic.FilterChangeIndication.FILTER_OK,
      'replace_filter'
    );
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = `replace_filter_${hap.Service.FilterMaintenance.UUID}`;
    if (endpoint !== undefined) {
      identifier += `_${endpoint.trim()}`;
    }
    return identifier;
  }
}
