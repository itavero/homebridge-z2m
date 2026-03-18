import { hap } from '../../hap';
import { BasicLogger } from '../../logger';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { BinarySensorHandler, isBinarySensorConfig } from './binary';

export class PresenceSensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'presence';
  public static readonly converterConfigTag: string = 'presence';

  public static isValidConverterConfiguration(config: unknown, _tag: string, _logger: BasicLogger | undefined): boolean {
    return isBinarySensorConfig(config);
  }

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      PresenceSensorHandler.generateIdentifier,
      'Occupancy Sensor (presence)',
      (n, t) => new hap.Service.OccupancySensor(n, (PresenceSensorHandler.exposesName + ' ' + (t ?? '')).trim()),
      hap.Characteristic.OccupancyDetected,
      hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED,
      hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
    );
    this.trySetupHistory(accessory, 'motion', 'status', PresenceSensorHandler.converterConfigTag, (v) => (v ? 1 : 0));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = PresenceSensorHandler.exposesName + '_' + hap.Service.OccupancySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
