import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { hap } from '../../hap';
import { ConfigurableBinarySensorHandler, isBinarySensorConfig, BinarySensorTypeDefinition } from './binary';
import { BasicLogger } from '../../logger';

export class OccupancySensorHandler extends ConfigurableBinarySensorHandler {
  public static readonly exposesName: string = 'occupancy';
  public static readonly converterConfigTag = 'occupancy';
  private static readonly defaultType: string = 'occupancy';
  private static readonly typeMotion: string = 'motion';
  public static isValidConverterConfiguration(config: unknown, tag: string, logger: BasicLogger | undefined): boolean {
    if (!isBinarySensorConfig(config)) {
      return false;
    }
    if (config.type !== undefined && !OccupancySensorHandler.getTypeDefinitions().has(config.type)) {
      logger?.error(`Invalid type chosen for ${tag} converter: ${config.type}`);
      return false;
    }
    return true;
  }

  private static getTypeDefinitions(): Map<string, BinarySensorTypeDefinition> {
    return new Map<string, BinarySensorTypeDefinition>([
      [
        OccupancySensorHandler.defaultType,
        new BinarySensorTypeDefinition(
          (n, t) => new hap.Service.OccupancySensor(n, t),
          hap.Characteristic.OccupancyDetected,
          hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED,
          hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
        ),
      ],
      [
        OccupancySensorHandler.typeMotion,
        new BinarySensorTypeDefinition(
          (n, t) => new hap.Service.MotionSensor(n, t),
          hap.Characteristic.MotionDetected,
          true,
          false,
          'occupancy'
        ),
      ],
    ]);
  }

  constructor(expose: ExposesEntryWithProperty, otherExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(
      accessory,
      expose as ExposesEntryWithBinaryProperty,
      otherExposes,
      OccupancySensorHandler.generateIdentifier,
      'OccupancySensor',
      OccupancySensorHandler.converterConfigTag,
      OccupancySensorHandler.defaultType,
      OccupancySensorHandler.getTypeDefinitions()
    );
  }

  static generateIdentifier(endpoint: string | undefined, accessory: BasicAccessory) {
    const config = accessory.getConverterConfiguration(OccupancySensorHandler.converterConfigTag);
    let identifier =
      isBinarySensorConfig(config) && config.type === OccupancySensorHandler.typeMotion
        ? `${OccupancySensorHandler.converterConfigTag}_${hap.Service.MotionSensor.UUID}`
        : hap.Service.OccupancySensor.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
