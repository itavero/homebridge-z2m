import { hap } from '../../hap';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { NumericLightSensorHandler } from './numeric_light_sensor';

export class IlluminanceAverageSensorHandler extends NumericLightSensorHandler {
  public static readonly exposesName: string = 'illuminance_average_20min';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(expose, allExposes, accessory, IlluminanceAverageSensorHandler.generateIdentifier, 'illuminance_avg');
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'illuminance_avg_' + hap.Service.LightSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
