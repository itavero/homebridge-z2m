import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { hap } from '../../hap';
import { BinarySensorHandler } from './binary';


export class PresenceSensorHandler extends BinarySensorHandler {
  public static readonly NAME = 'presence';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, PresenceSensorHandler.generateIdentifier,
      'Occupancy Sensor (presence)',
      (n, t) => new hap.Service.OccupancySensor(n, (PresenceSensorHandler.NAME + ' ' + (t ?? '')).trim()),
      hap.Characteristic.OccupancyDetected,
      hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED, hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = PresenceSensorHandler.NAME + '_' + hap.Service.OccupancySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
