import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { hap } from '../../hap';
import { BinarySensorHandler } from './binary';
import { IdentifierGenerator } from './basic';

abstract class LeakSensorHandler extends BinarySensorHandler {
  constructor(
    subType: string,
    identifierGen: IdentifierGenerator,
    expose: ExposesEntryWithProperty,
    otherExposes: ExposesEntryWithBinaryProperty[],
    accessory: BasicAccessory
  ) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      identifierGen,
      subType + ' LeakSensor',
      (n, t) => new hap.Service.LeakSensor(n, t),
      hap.Characteristic.LeakDetected,
      hap.Characteristic.LeakDetected.LEAK_DETECTED,
      hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED,
      subType
    );
  }

  static generateIdentifier(endpoint: string | undefined, additionalSubType: string) {
    let identifier = `${additionalSubType}_${hap.Service.LeakSensor.UUID}`;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
export class WaterLeakSensorHandler extends LeakSensorHandler {
  public static readonly exposesName: string = 'water_leak';
  private static readonly SUBTYPE = 'water';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(WaterLeakSensorHandler.SUBTYPE, WaterLeakSensorHandler.generateIdentifier, expose, otherExposes, accessory);
  }

  static generateIdentifier(endpoint: string | undefined) {
    return LeakSensorHandler.generateIdentifier(endpoint, WaterLeakSensorHandler.SUBTYPE);
  }
}
export class GasLeakSensorHandler extends LeakSensorHandler {
  public static readonly exposesName: string = 'gas';
  private static readonly SUBTYPE = 'gas';

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(GasLeakSensorHandler.SUBTYPE, GasLeakSensorHandler.generateIdentifier, expose, otherExposes, accessory);
  }

  static generateIdentifier(endpoint: string | undefined) {
    return LeakSensorHandler.generateIdentifier(endpoint, GasLeakSensorHandler.SUBTYPE);
  }
}
