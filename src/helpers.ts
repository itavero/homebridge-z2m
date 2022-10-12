import { Characteristic, Service, WithUUID } from 'homebridge';
import { ExposesEntry, exposesHasFeatures, exposesHasNumericRangeProperty } from './z2mModels';

export function errorToString(e: unknown): string {
  if (typeof e === 'string') {
    return e;
  }
  if (e instanceof Error) {
    return e.message; // works, `e` narrowed to Error
  }
  return JSON.stringify(e);
}

export function getDiffFromArrays<T>(a: T[], b: T[]): T[] {
  return a.filter((x) => !b.includes(x)).concat(b.filter((x) => !a.includes(x)));
}

export function getOrAddCharacteristic(service: Service, characteristic: WithUUID<{ new (): Characteristic }>): Characteristic {
  return service.getCharacteristic(characteristic) || service.addCharacteristic(characteristic);
}

export function roundToDecimalPlaces(input: number, decimalPlaces: number): number {
  if (decimalPlaces !== Math.round(decimalPlaces) || decimalPlaces < 1 || decimalPlaces > 10) {
    throw new Error(`decimalPlaces must be a whole number between 1 and 10, not ${decimalPlaces}`);
  }
  const maxDecimals = Math.pow(10, decimalPlaces);
  return Math.round((input + Number.EPSILON) * maxDecimals) / maxDecimals;
}

export function copyExposesRangeToCharacteristic(exposes: ExposesEntry, characteristic: Characteristic): boolean {
  if (exposesHasNumericRangeProperty(exposes)) {
    characteristic.setProps({
      minValue: exposes.value_min,
      maxValue: exposes.value_max,
      minStep: exposes.value_step,
    });
    return true;
  }
  return false;
}

export function groupByEndpoint<Entry extends ExposesEntry>(entries: Entry[]): Map<string | undefined, Entry[]> {
  const endpointMap = new Map<string | undefined, Entry[]>();
  entries.forEach((entry) => {
    const collection = endpointMap.get(entry.endpoint);
    if (!collection) {
      endpointMap.set(entry.endpoint, [entry]);
    } else {
      collection.push(entry);
    }
  });
  return endpointMap;
}

export function getAllEndpoints(entries: ExposesEntry[], parentEndpoint?: string): (string | undefined)[] {
  const endpoints = new Set<string | undefined>();
  entries.forEach((entry) => {
    const endpoint = entry.endpoint ?? parentEndpoint;
    if (endpoint !== undefined || entry.property !== undefined) {
      endpoints.add(endpoint);
    }
    if (exposesHasFeatures(entry)) {
      getAllEndpoints(entry.features, endpoint).forEach((e) => {
        endpoints.add(e);
      });
    }
  });
  const result = Array.from(endpoints);
  result.sort();
  return result;
}

export function sanitizeAndFilterExposesEntries(
  input: ExposesEntry[],
  filter?: (entry: ExposesEntry) => boolean,
  valueFilter?: (entry: ExposesEntry) => string[],
  parentEndpoint?: string | undefined
): ExposesEntry[] {
  return input
    .filter((e) => filter === undefined || filter(e))
    .map((e) => sanitizeAndFilterExposesEntry(e, filter, valueFilter, parentEndpoint));
}

function sanitizeAndFilterExposesEntry(
  input: ExposesEntry,
  filter?: (entry: ExposesEntry) => boolean,
  valueFilter?: (entry: ExposesEntry) => string[],
  parentEndpoint?: string | undefined
): ExposesEntry {
  const output: ExposesEntry = {
    ...input,
  };

  if (output.endpoint === undefined && parentEndpoint !== undefined) {
    // Make sure features inherit the endpoint from their parent, if it is not defined explicitly.
    output.endpoint = parentEndpoint;
  }

  if (exposesHasFeatures(output)) {
    output.features = sanitizeAndFilterExposesEntries(output.features, filter, valueFilter, output.endpoint);
  }

  if (Array.isArray(output.values) && valueFilter !== undefined) {
    output.values = valueFilter(output);
  }

  return output;
}
