import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { hap } from '../../hap';
import { BinarySensorHandler } from './binary';


export class VibrationSensorHandler extends BinarySensorHandler {
  public static readonly exposesName: string = 'vibration';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose as ExposesEntryWithBinaryProperty, otherExposes, VibrationSensorHandler.generateIdentifier,
      'Motion Sensor (vibration)', (n, t) => new hap.Service.MotionSensor(n, (VibrationSensorHandler.exposesName + ' ' + (t ?? '')).trim()),
      hap.Characteristic.MotionDetected, true, false);
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = VibrationSensorHandler.exposesName + '_' + hap.Service.MotionSensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
