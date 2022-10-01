import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesKnownTypes } from '../../z2mModels';
import { MappingCharacteristicMonitor } from '../monitor';
import { Characteristic, CharacteristicValue, WithUUID } from 'homebridge';
import { getOrAddCharacteristic } from '../../helpers';
import { BasicSensorHandler, IdentifierGenerator, ServiceConstructor } from './basic';

export class BinarySensorTypeDefinition {
  public constructor(
    public readonly service: ServiceConstructor,
    public readonly characteristic: WithUUID<{ new (): Characteristic }>,
    public readonly hapOnValue: CharacteristicValue,
    public readonly hapOffValue: CharacteristicValue,
    public readonly additionalSubType?: string | undefined
  ) {}
}

export interface BinarySensorConfig {
  type?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isBinarySensorConfig = (x: any): x is BinarySensorConfig =>
  x !== undefined && (x.type === undefined || (typeof x.type === 'string' && x.type.length > 0));

export abstract class ConfigurableBinarySensorHandler extends BasicSensorHandler {
  public static readonly exposesType: ExposesKnownTypes = ExposesKnownTypes.BINARY;

  constructor(
    accessory: BasicAccessory,
    expose: ExposesEntryWithBinaryProperty,
    otherExposes: ExposesEntryWithBinaryProperty[],
    identifierGen: IdentifierGenerator,
    logName: string,
    configTag: string | undefined,
    defaultType: string,
    typeDefinitions: Map<string, BinarySensorTypeDefinition>
  ) {
    let definition = typeDefinitions.get(defaultType);
    if (definition === undefined) {
      throw new Error(`Unknown default binary sensor type ${defaultType} for ${logName}`);
    }

    if (configTag !== undefined) {
      const converterConfig = accessory.getConverterConfiguration(configTag);
      if (isBinarySensorConfig(converterConfig) && converterConfig.type !== undefined) {
        const chosenDefinition = typeDefinitions.get(converterConfig.type);
        if (chosenDefinition !== undefined) {
          definition = chosenDefinition;
        } else {
          accessory.log.error(`Invalid type chosen for ${logName}: ${converterConfig.type} (${accessory.displayName})`);
        }
      }
    }

    super(accessory, expose, otherExposes, identifierGen, definition.service, definition.additionalSubType);
    accessory.log.debug(`Configuring ${logName} for ${this.serviceName}`);

    getOrAddCharacteristic(this.service, definition.characteristic);
    const mapping = new Map<CharacteristicValue, CharacteristicValue>();
    mapping.set(expose.value_on, definition.hapOnValue);
    mapping.set(expose.value_off, definition.hapOffValue);
    this.monitors.push(new MappingCharacteristicMonitor(expose.property, this.service, definition.characteristic, mapping));
  }
}

export abstract class BinarySensorHandler extends ConfigurableBinarySensorHandler {
  constructor(
    accessory: BasicAccessory,
    expose: ExposesEntryWithBinaryProperty,
    otherExposes: ExposesEntryWithBinaryProperty[],
    identifierGen: IdentifierGenerator,
    logName: string,
    service: ServiceConstructor,
    characteristic: WithUUID<{ new (): Characteristic }>,
    hapOnValue: CharacteristicValue,
    hapOffValue: CharacteristicValue,
    additionalSubType?: string | undefined
  ) {
    super(
      accessory,
      expose,
      otherExposes,
      identifierGen,
      logName,
      undefined,
      '',
      new Map<string, BinarySensorTypeDefinition>([
        ['', new BinarySensorTypeDefinition(service, characteristic, hapOnValue, hapOffValue, additionalSubType)],
      ])
    );
  }
}
