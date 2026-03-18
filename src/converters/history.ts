import { Characteristic } from 'homebridge';
import { BasicLogger } from '../logger';
import { ExposesEntry, ExposesEntryWithProperty, exposesHasProperty, exposesIsPublished } from '../z2mModels';
import { BasicAccessory, FakeGatoHistoryType, HistoryService, ServiceCreator, ServiceHandler } from './interfaces';

// Identifier for the history service handler (only one per accessory)
const HISTORY_SERVICE_HANDLER_ID = 'FAKEGATO_HISTORY';

interface PropertyMapping {
  /** The key in the MQTT state payload */
  stateKey: string;
  /** The key in the fakegato entry object */
  entryKey: string;
  /** Optional transformation from state value to number/boolean entry value */
  transform?: (value: unknown) => number | boolean;
}

interface HistoryTypeDefinition {
  /** Fakegato history type string */
  type: FakeGatoHistoryType;
  /** Properties to watch and include in history entries */
  properties: PropertyMapping[];
  /** At least one of these property names must be present in device exposes */
  requiredNames: string[];
}

function boolToNumber(value: unknown): number {
  return value ? 1 : 0;
}

function invertBoolToNumber(value: unknown): number {
  return value ? 0 : 1;
}

/**
 * Ordered list of history type definitions.
 * The first matching definition wins, so more specific types should come first.
 */
const HISTORY_TYPE_DEFINITIONS: HistoryTypeDefinition[] = [
  {
    // Eve Energy: for devices with power/energy measurements
    type: 'energy',
    requiredNames: ['power', 'active_power', 'load', 'energy', 'consumed_energy', 'energy_consumed'],
    properties: [
      { stateKey: 'power', entryKey: 'power' },
      { stateKey: 'active_power', entryKey: 'power' },
      { stateKey: 'load', entryKey: 'power' },
    ],
  },
  {
    // Eve Weather: for devices with temperature and/or humidity and/or air pressure
    type: 'weather',
    requiredNames: ['temperature', 'humidity', 'pressure'],
    properties: [
      { stateKey: 'temperature', entryKey: 'temp' },
      { stateKey: 'humidity', entryKey: 'humidity' },
      { stateKey: 'pressure', entryKey: 'pressure' },
    ],
  },
  {
    // Eve Door: for contact sensors
    type: 'door',
    requiredNames: ['contact'],
    properties: [
      // contact=true means closed, fakegato door status=0 means closed
      { stateKey: 'contact', entryKey: 'status', transform: invertBoolToNumber },
    ],
  },
  {
    // Eve Motion: for occupancy/motion/presence sensors
    type: 'motion',
    requiredNames: ['occupancy', 'motion', 'presence', 'moving'],
    properties: [
      { stateKey: 'occupancy', entryKey: 'status', transform: boolToNumber },
      { stateKey: 'motion', entryKey: 'status', transform: boolToNumber },
      { stateKey: 'presence', entryKey: 'status', transform: boolToNumber },
      { stateKey: 'moving', entryKey: 'status', transform: boolToNumber },
    ],
  },
];

/**
 * Determines which history type best matches the given exposes list.
 * Returns the matching definition, or undefined if none matches.
 */
function determineHistoryType(exposes: ExposesEntry[]): HistoryTypeDefinition | undefined {
  const propertyNames = new Set<string>(
    exposes.filter((e): e is ExposesEntryWithProperty => exposesHasProperty(e) && exposesIsPublished(e)).map((e) => e.name)
  );

  for (const definition of HISTORY_TYPE_DEFINITIONS) {
    if (definition.requiredNames.some((name) => propertyNames.has(name))) {
      return definition;
    }
  }
  return undefined;
}

export class HistoryServiceHandler implements ServiceHandler {
  protected log: BasicLogger;
  readonly identifier: string;
  readonly mainCharacteristics: (Characteristic | undefined)[] = [];
  readonly getableKeys: string[] = [];

  private readonly historyService: HistoryService;
  private readonly activeProperties: PropertyMapping[];

  constructor(accessory: BasicAccessory, historyService: HistoryService, activeProperties: PropertyMapping[]) {
    this.log = accessory.log;
    this.identifier = HISTORY_SERVICE_HANDLER_ID;
    this.historyService = historyService;
    this.activeProperties = activeProperties;
  }

  updateState(state: Record<string, unknown>): void {
    // Build the history entry from available state properties
    const entry: { time: number } & Record<string, number | boolean> = {
      time: Math.round(Date.now() / 1000),
    };

    let hasAnyProperty = false;
    for (const mapping of this.activeProperties) {
      if (mapping.stateKey in state && state[mapping.stateKey] !== undefined) {
        const rawValue = state[mapping.stateKey];
        const entryValue = mapping.transform !== undefined ? mapping.transform(rawValue) : (rawValue as number);
        entry[mapping.entryKey] = entryValue;
        hasAnyProperty = true;
      }
    }

    if (hasAnyProperty) {
      try {
        this.historyService.addEntry(entry);
      } catch (e) {
        this.log.debug(`Failed to add history entry: ${e}`);
      }
    }
  }
}

export class HistoryServiceCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    // Skip if history handler already registered
    if (accessory.isServiceHandlerIdKnown(HISTORY_SERVICE_HANDLER_ID)) {
      return;
    }

    // Determine which history type to use based on available exposes
    const definition = determineHistoryType(exposes);
    if (definition === undefined) {
      return;
    }

    // Attempt to create the history service (returns undefined if disabled or unavailable)
    const historyService = accessory.addFakeGatoHistoryService(definition.type);
    if (historyService === undefined) {
      return;
    }

    // Determine which properties from the definition are actually present in the exposes
    const propertyNames = new Set<string>(
      exposes.filter((e): e is ExposesEntryWithProperty => exposesHasProperty(e) && exposesIsPublished(e)).map((e) => e.name)
    );

    // Only track properties that exist in both the definition and the device exposes
    const activeProperties = definition.properties.filter((p) => propertyNames.has(p.stateKey));

    if (activeProperties.length === 0) {
      return;
    }

    const handler = new HistoryServiceHandler(accessory, historyService, activeProperties);
    accessory.registerServiceHandler(handler);
    accessory.log.debug(`History service (${definition.type}) configured for ${accessory.displayName}`);
  }
}
