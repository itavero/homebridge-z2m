import { hap } from '../../hap';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { LightSensorHandler } from './light_sensor';

export class RainIntensitySensorHandler extends LightSensorHandler {
  public static readonly exposesName: string = 'rain_intensity';
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.NUMERIC;

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(expose, allExposes, accessory, RainIntensitySensorHandler.generateIdentifier, 'rain_intensity');
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = 'rain_intensity_' + hap.Service.LightSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
