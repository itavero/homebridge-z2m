import { hap } from '../../hap';
import { BasicLogger } from '../../logger';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { BasicAccessory } from '../interfaces';
import { BinarySensorHandler, isBinarySensorConfig } from './binary';

export class MovingSensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'moving';
  public static readonly converterConfigTag: string = 'moving';

  public static isValidConverterConfiguration(config: unknown, _tag: string, _logger: BasicLogger | undefined): boolean {
    return isBinarySensorConfig(config);
  }

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      MovingSensorHandler.generateIdentifier,
      'Motion Sensor (moving)',
      (n, t) => new hap.Service.MotionSensor(n, (MovingSensorHandler.exposesName + ' ' + (t ?? '')).trim()),
      hap.Characteristic.MotionDetected,
      true,
      false
    );
    this.trySetupHistory(accessory, 'motion', 'status', MovingSensorHandler.converterConfigTag, (v) => (v ? 1 : 0));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = MovingSensorHandler.exposesName + '_' + hap.Service.MotionSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
