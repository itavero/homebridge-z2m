import { hap } from '../../hap';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { LightSensorHandler } from './light_sensor';

export class IlluminanceMaximumSensorHandler extends LightSensorHandler {
  public static readonly exposesName: string = 'illuminance_maximum_today';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(expose, allExposes, accessory, IlluminanceMaximumSensorHandler.generateIdentifier, 'illuminance_max');
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'illuminance_max_' + hap.Service.LightSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
