import { hap } from '../hap';
import { exposesHasEnumProperty, exposesIsPublished, exposesCanBeGet, ExposesEntry, ExposesEntryWithEnumProperty } from '../z2mModels';
import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';

import { CharacteristicMonitor, MappingCharacteristicMonitor } from './monitor';
import { Characteristic, CharacteristicProps, CharacteristicValue } from 'homebridge';
import { getOrAddCharacteristic } from '../helpers';
import { SwitchActionHelper, SwitchActionMapping } from './action_helper';

export class StatelessProgrammableSwitchCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    const actionExposes = exposes
      .filter((e) => exposesIsPublished(e) && exposesHasEnumProperty(e) && e.name === 'action')
      .map((e) => e as ExposesEntryWithEnumProperty);

    for (const expose of actionExposes) {
      // Each action expose can map to multiple instances of a Stateless Programmable Switch,
      // depending on the values provided.
      try {
        const mappings = SwitchActionHelper.getInstance()
          .valuesToNumberedMappings(expose.values)
          .filter((m) => m.isValidMapping());
        const logEntries: string[] = [`Mapping of property '${expose.property}' of device '${accessory.displayName}':`];
        for (const mapping of mappings) {
          try {
            const id = StatelessProgrammableSwitchHandler.generateIdentifier(expose.endpoint, mapping.subType);
            if (!accessory.isServiceHandlerIdKnown(id)) {
              const handler = new StatelessProgrammableSwitchHandler(accessory, expose, mapping);
              accessory.registerServiceHandler(handler);
            }
            const logEntry = mapping.toString();
            if (logEntry !== undefined) {
              logEntries.push(logEntry);
            }
          } catch (error) {
            accessory.log.error(
              `Failed to setup stateless programmable switch for accessory ${accessory.displayName} ` +
                `from expose "${JSON.stringify(expose)}" and mapping "${JSON.stringify(mapping)}", error: ${error}`
            );
          }
        }
        accessory.log.info(logEntries.join('\n'));
      } catch (error) {
        accessory.log.error(
          `Failed to setup stateless programmable switch for accessory ${accessory.displayName} ` +
            `from expose "${JSON.stringify(expose)}", error: ${error}`
        );
      }
    }
  }
}

class StatelessProgrammableSwitchHandler implements ServiceHandler {
  public readonly identifier: string;
  private readonly monitor: CharacteristicMonitor;
  public readonly mainCharacteristics: Characteristic[] = [];

  constructor(accessory: BasicAccessory, private readonly actionExpose: ExposesEntryWithEnumProperty, mapping: SwitchActionMapping) {
    this.identifier = StatelessProgrammableSwitchHandler.generateIdentifier(actionExpose.endpoint, mapping.subType);

    // Create service
    let subType = mapping.subType;
    if (actionExpose.endpoint !== undefined) {
      if (subType !== undefined) {
        subType += '.' + actionExpose.endpoint;
      } else {
        subType = actionExpose.endpoint;
      }
    }

    const serviceName = accessory.getDefaultServiceDisplayName(subType);
    const service = accessory.getOrAddService(new hap.Service.StatelessProgrammableSwitch(serviceName, subType));

    // Setup monitor and characteristic
    getOrAddCharacteristic(service, hap.Characteristic.ServiceLabelIndex).updateValue(mapping.serviceLabelIndex ?? 0);
    const eventCharacteristic = getOrAddCharacteristic(service, hap.Characteristic.ProgrammableSwitchEvent);
    const valueMap = new Map<CharacteristicValue, number>();
    if (mapping.valueSinglePress !== undefined) {
      valueMap.set(mapping.valueSinglePress, hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
    }
    if (mapping.valueDoublePress !== undefined) {
      valueMap.set(mapping.valueDoublePress, hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);
    }
    if (mapping.valueLongPress !== undefined) {
      valueMap.set(mapping.valueLongPress, hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
    }
    eventCharacteristic.setProps(StatelessProgrammableSwitchHandler.generateValueConfigForProgrammableSwitchEvents([...valueMap.values()]));
    this.mainCharacteristics.push(eventCharacteristic);
    this.monitor = new MappingCharacteristicMonitor(actionExpose.property, service, hap.Characteristic.ProgrammableSwitchEvent, valueMap);
  }

  private static generateValueConfigForProgrammableSwitchEvents(events: number[]): Partial<CharacteristicProps> {
    const result: Partial<CharacteristicProps> = {
      validValues: events,
    };

    if (events.length > 0) {
      result.minValue = Math.min(...events);
      result.maxValue = Math.max(...events);
    }
    return result;
  }

  get getableKeys(): string[] {
    if (exposesCanBeGet(this.actionExpose)) {
      return [this.actionExpose.property];
    }
    return [];
  }

  updateState(state: Record<string, unknown>): void {
    this.monitor.callback(state);
  }

  static generateIdentifier(endpoint: string | undefined, mappingSubType: string | undefined) {
    let identifier = hap.Service.StatelessProgrammableSwitch.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }

    if (mappingSubType) {
      identifier += '#' + mappingSubType;
    }
    return identifier;
  }
}
