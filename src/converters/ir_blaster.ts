import { Characteristic, CharacteristicSetCallback, CharacteristicValue } from 'homebridge';
import { hap } from '../hap';
import { getOrAddCharacteristic } from '../helpers';
import { ExposesEntry, ExposesKnownTypes, exposesCanBeSet, exposesHasProperty } from '../z2mModels';
import { BasicAccessory, ConverterConfigurationRegistry, ServiceCreator, ServiceHandler } from './interfaces';

export interface IrBlasterCommand {
  name: string;
  value: string;
}

export interface IrBlasterConfig {
  commands?: IrBlasterCommand[];
}

// biome-ignore lint/suspicious/noExplicitAny: type guard function needs to accept any input
export const isIrBlasterConfig = (x: any): x is IrBlasterConfig => {
  if (x === undefined || typeof x !== 'object') {
    return false;
  }
  if (x.commands !== undefined) {
    if (!Array.isArray(x.commands)) {
      return false;
    }
    for (const cmd of x.commands) {
      if (typeof cmd !== 'object' || typeof cmd.name !== 'string' || cmd.name.length === 0) {
        return false;
      }
      if (typeof cmd.value !== 'string' || cmd.value.length === 0) {
        return false;
      }
    }
  }
  return true;
};

export class IrBlasterCreator implements ServiceCreator {
  public static readonly CONFIG_TAG = 'ir_blaster';

  constructor(converterConfigRegistry: ConverterConfigurationRegistry) {
    converterConfigRegistry.registerConverterConfiguration(IrBlasterCreator.CONFIG_TAG, IrBlasterCreator.isValidConverterConfiguration);
  }

  private static isValidConverterConfiguration(config: unknown): boolean {
    return isIrBlasterConfig(config);
  }

  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    const irCodeExpose = exposes.find(
      (e) => e.type === ExposesKnownTypes.TEXT && e.name === 'ir_code_to_send' && exposesHasProperty(e) && exposesCanBeSet(e)
    );

    if (irCodeExpose === undefined) {
      return;
    }

    const config = accessory.getConverterConfiguration(IrBlasterCreator.CONFIG_TAG);
    if (!isIrBlasterConfig(config) || config.commands === undefined || config.commands.length === 0) {
      accessory.log.warn(
        `IR Blaster detected on ${accessory.displayName}, but no commands configured. ` +
          'Add commands to the ir_blaster converter configuration.'
      );
      return;
    }

    config.commands.forEach((command, index) => {
      const id = IrBlasterHandler.generateIdentifier(index);
      if (!accessory.isServiceHandlerIdKnown(id)) {
        try {
          const handler = new IrBlasterHandler(accessory, irCodeExpose.property as string, command, index);
          accessory.registerServiceHandler(handler);
        } catch (error) {
          accessory.log.warn(`Failed to setup IR command "${command.name}" for accessory ${accessory.displayName}: ${error}`);
        }
      }
    });
  }
}

class IrBlasterHandler implements ServiceHandler {
  public readonly identifier: string;
  public readonly mainCharacteristics: Characteristic[];
  private readonly onCharacteristic: Characteristic;

  constructor(
    private readonly accessory: BasicAccessory,
    private readonly property: string,
    private readonly command: IrBlasterCommand,
    index: number
  ) {
    this.identifier = IrBlasterHandler.generateIdentifier(index);

    const subType = `ir_command_${index}`;
    const service = accessory.getOrAddService(new hap.Service.Switch(command.name, subType));

    this.onCharacteristic = getOrAddCharacteristic(service, hap.Characteristic.On).on('set', this.handleSet.bind(this));
    this.mainCharacteristics = [this.onCharacteristic];
  }

  get getableKeys(): string[] {
    return [];
  }

  updateState(_state: Record<string, unknown>): void {
    // IR blaster is write-only; no state to update
  }

  static generateIdentifier(index: number): string {
    return `${hap.Service.Switch.UUID}_ir_command_${index}`;
  }

  private handleSet(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (value) {
      const data: Record<string, unknown> = {};
      data[this.property] = this.command.value;
      this.accessory.queueDataForSetAction(data);
      callback(null);
      // Reset to OFF shortly after ack — IR commands are stateless, avoid flipping state before HomeKit confirms the set
      setTimeout(() => this.onCharacteristic.updateValue(false), 500);
    } else {
      callback(null);
    }
  }
}
