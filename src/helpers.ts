import { Characteristic, Service, WithUUID } from 'homebridge';
import { ExposesEntry, exposesHasNumericRangeProperty } from './z2mModels';

export function errorToString(e: unknown): string {
  if (typeof e === 'string') {
    return e;
  }
  if (e instanceof Error) {
    return e.message; // works, `e` narrowed to Error
  }
  return JSON.stringify(e);
}

export function getOrAddCharacteristic(service: Service, characteristic: WithUUID<{ new(): Characteristic }>): Characteristic {
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