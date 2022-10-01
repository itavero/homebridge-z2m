/* eslint-disable @typescript-eslint/no-explicit-any */
export declare type MqttValue = string | boolean | number;

export interface ExposesEntry {
  type: string;
  name?: string;
  endpoint?: string;
  access?: number;
  property?: string;
  unit?: string;
  values?: string[];
  value_off?: MqttValue;
  value_on?: MqttValue;
  value_step?: number;
  value_min?: number;
  value_max?: number;
}

export enum ExposesAccessLevel {
  PUBLISHED = 0x1,
  SET = 0x2,
  GET = 0x4,
}

export enum ExposesKnownTypes {
  NUMERIC = 'numeric',
  BINARY = 'binary',
  SWITCH = 'switch',
  LOCK = 'lock',
  ENUM = 'enum',
  TEXT = 'text',
  COMPOSITE = 'composite',
  LIGHT = 'light',
  COVER = 'cover',
  FAN = 'fan',
  CLIMATE = 'climate',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isExposesEntry = (x: any): x is ExposesEntry => {
  if (x === undefined || x.type === undefined) {
    return false;
  }

  return (x.name !== undefined
    || x.property !== undefined
    || x.access !== undefined
    || x.endpoint !== undefined
    || x.values !== undefined
    || (x.value_off !== undefined && x.value_on !== undefined)
    || (x.value_min !== undefined && x.value_max !== undefined)
    || Array.isArray(x.features));
};

export interface ExposesEntryWithFeatures extends ExposesEntry {
  features: ExposesEntry[];
}

export interface ExposesEntryWithProperty extends ExposesEntry {
  name: string;
  property: string;
  access: number;
}

export interface ExposesEntryWithNumericRangeProperty extends ExposesEntryWithProperty {
  name: string;
  property: string;
  access: number;
  value_min: number;
  value_max: number;
}

export interface ExposesEntryWithBinaryProperty extends ExposesEntryWithProperty {
  name: string;
  property: string;
  access: number;
  value_off: MqttValue;
  value_on: MqttValue;
}

export interface ExposesEntryWithEnumProperty extends ExposesEntryWithProperty {
  name: string;
  property: string;
  access: number;
  values: string[];
}

export const exposesHasFeatures = (x: ExposesEntry): x is ExposesEntryWithFeatures => ('features' in x);
export const exposesHasProperty = (x: ExposesEntry): x is ExposesEntryWithProperty => (x.name !== undefined
  && x.property !== undefined && x.access !== undefined);
export const exposesHasNumericProperty = (x: ExposesEntry): x is ExposesEntryWithProperty => (exposesHasProperty(x)
  && x.type === ExposesKnownTypes.NUMERIC);
export const exposesHasNumericRangeProperty = (x: ExposesEntry): x is ExposesEntryWithNumericRangeProperty => (exposesHasNumericProperty(x)
  && x.value_min !== undefined && x.value_max !== undefined);
export const exposesHasBinaryProperty = (x: ExposesEntry): x is ExposesEntryWithBinaryProperty => (exposesHasProperty(x)
  && x.type === ExposesKnownTypes.BINARY && x.value_on !== undefined && x.value_off !== undefined);
export const exposesHasEnumProperty = (x: ExposesEntry): x is ExposesEntryWithEnumProperty => (exposesHasProperty(x)
  && x.type === ExposesKnownTypes.ENUM && Array.isArray(x.values) && x.values.length > 0);

export function exposesCanBeSet(entry: ExposesEntry): boolean {
  return (entry.access !== undefined) && ((entry.access & ExposesAccessLevel.SET) !== 0);
}

export function exposesCanBeGet(entry: ExposesEntry): boolean {
  return (entry.access !== undefined) && ((entry.access & ExposesAccessLevel.GET) !== 0);
}

export function exposesIsPublished(entry: ExposesEntry): boolean {
  return (entry.access !== undefined) && ((entry.access & ExposesAccessLevel.PUBLISHED) !== 0);
}

export interface ExposesPredicate {
  (expose: ExposesEntry): boolean;
}

export function exposesHasAllRequiredFeatures(entry: ExposesEntryWithFeatures, features: ExposesPredicate[]): boolean {
  for (const f of features) {
    if (entry.features.findIndex(e => f(e)) < 0) {
      // given feature not found
      return false;
    }
  }

  // All mentioned features where matched.
  return true;
}

export function exposesGetOverlap(first: ExposesEntry[], second: ExposesEntry[]): ExposesEntry[] {
  const result: ExposesEntry[] = [];

  const secondNormalized = normalizeExposes(second);

  for (const entry of normalizeExposes(first)) {
    const match = secondNormalized.find((x) => x.name === entry.name && x.property === entry.property && x.type === entry.type);
    if (match !== undefined) {
      const merged = exposesGetMergedEntry(entry, match);
      if (merged !== undefined) {
        result.push(merged);
      }
    }
  }

  return result;
}

// Removes endpoint specific info and possible duplicates
export function normalizeExposes(entries: ExposesEntry[]): ExposesEntry[] {
  const result: ExposesEntry[] = [];
  for (const entry of entries) {
    const normalized = exposesRemoveEndpoint(entry);
    if (result.findIndex((x) => exposesAreEqual(normalized, x)) < 0) {
      result.push(normalized);
    }
  }

  return result;
}

// Remove endpoint specific info from an exposes entry.
function exposesRemoveEndpoint(entry: ExposesEntry): ExposesEntry {
  const result = { ...entry };
  if (entry.endpoint !== undefined) {
    delete result.endpoint;
    if (entry.property !== undefined && entry.name !== undefined) {
      result.property = entry.name;
    }
  }
  if (exposesHasFeatures(entry)) {
    result['features'] = entry.features.map(exposesRemoveEndpoint);
  }

  return result;
}

export function exposesGetMergedEntry(first: ExposesEntry, second: ExposesEntry): ExposesEntry | undefined {
  const result: ExposesEntry | ExposesEntryWithFeatures = {
    type: first.type,
  };
  for (const member in first) {
    if (!Array.isArray(first[member])) {
      if ((member in second) && (second[member] === first[member])) {
        result[member] = first[member];
      }
    }
  }

  switch (first.type) {
    case ExposesKnownTypes.NUMERIC:
      if (first.value_min !== second.value_min) {
        if (first.value_min === undefined) {
          result.value_min = second.value_min;
        } else if (second.value_min !== undefined) {
          result.value_min = Math.min(first.value_min, second.value_min);
        }
      }
      if (first.value_max !== second.value_max) {
        if (first.value_max === undefined) {
          result.value_max = second.value_max;
        } else if (second.value_max !== undefined) {
          result.value_max = Math.max(first.value_max, second.value_max);
        }
      }
      break;
    case ExposesKnownTypes.BINARY:
      if (first.value_on !== second.value_on || first.value_off !== second.value_off) {
        return undefined;
      }
      break;
    case ExposesKnownTypes.ENUM:
      {
        const matches = first.values?.filter((x) => second.values?.includes(x));
        if (matches === undefined || matches.length === 0) {
          return undefined;
        }
        result.values = matches;
      }
      break;
    default:
      // no action needed
      break;
  }

  // process features
  if (exposesHasFeatures(first) && exposesHasFeatures(second)) {
    result['features'] = [];
    for (const feature of first.features) {
      const match = second.features.find((x) => x.name === feature.name && x.property === feature.property && x.type === feature.type);
      if (match !== undefined) {

        const merged = exposesGetMergedEntry(feature, match);
        if (merged !== undefined) {
          result['features'].push(merged);
        }
      }
    }
  } else if ('features' in result) {
    delete result['features'];
  }
  return result;
}

export function exposesAreEqual(first: ExposesEntry, second: ExposesEntry): boolean {
  if (first.type !== second.type
    || first.name !== second.name
    || first.property !== second.property
    || first.access !== second.access
    || first.endpoint !== second.endpoint
    || first.value_min !== second.value_min
    || first.value_max !== second.value_max
    || first.value_off !== second.value_off
    || first.value_on !== second.value_on
    || first.values?.length !== second.values?.length) {
    return false;
  }

  if (first.values !== undefined && second?.values !== undefined) {
    const missing = first.values.filter(v => !(second.values?.includes(v) ?? false));
    if (missing.length > 0) {
      return false;
    }
  }

  if (exposesHasFeatures(first) || exposesHasFeatures(second)) {
    if (!exposesHasFeatures(first) || !exposesHasFeatures(second)) {
      return false;
    }

    return exposesCollectionsAreEqual(first.features, second.features);
  }

  return true;
}

export function exposesCollectionsAreEqual(first: ExposesEntry[], second: ExposesEntry[]): boolean {
  if (first.length !== second.length) {
    return false;
  }

  for (const firstEntry of first) {
    if (second.findIndex(e => exposesAreEqual(firstEntry, e)) < 0) {
      return false;
    }
  }
  return true;
}

export interface DeviceDefinition {
  vendor: string;
  model: string;
  exposes: ExposesEntry[];
}

export const isDeviceDefinition = (x: any): x is DeviceDefinition => (x.vendor && x.model && Array.isArray(x.exposes));

export interface DeviceListEntry {
  definition?: DeviceDefinition | null;
  friendly_name: string;
  ieee_address: string;
  supported: boolean;
  software_build_id?: string;
  date_code?: string;
}

export interface DeviceListEntryForGroup extends DeviceListEntry {
  group_id: number;
}

const isNullOrUndefined = (x: unknown): x is null | undefined => (x === null || x === undefined);

export const isDeviceListEntry = (x: any): x is DeviceListEntry => (x.ieee_address && x.friendly_name && x.supported);
export const isDeviceListEntryForGroup = (x: any): x is DeviceListEntryForGroup => {
  return (isDeviceListEntry(x) && 'group_id' in x && typeof x['group_id'] === 'number');
};
export function deviceListEntriesAreEqual(first: DeviceListEntry | undefined, second: DeviceListEntry | undefined): boolean {
  if (first === undefined || second === undefined) {
    return (first === undefined && second === undefined);
  }

  if (first.friendly_name !== second.friendly_name
    || first.ieee_address !== second.ieee_address
    || first.supported !== second.supported
    || first.software_build_id !== second.software_build_id
    || first.date_code !== second.date_code) {
    return false;
  }

  if (isNullOrUndefined(first.definition) || isNullOrUndefined(second.definition)) {
    return isNullOrUndefined(first.definition) && isNullOrUndefined(second.definition);
  }

  return (first.definition.model === second.definition.model
    && first.definition.vendor === second.definition.vendor
    && exposesCollectionsAreEqual(first.definition.exposes, second.definition.exposes));
}

export interface GroupMember {
  ieee_address: string;
  endpoint: number;
}

export const isGroupMember = (x: any): x is GroupMember => (x.ieee_address && x.endpoint);
export interface GroupListEntry {
  friendly_name: string;
  id: number;
  members: GroupMember[];
}

export const isGroupListEntry = (x: any): x is GroupListEntry => (x.id && x.friendly_name && x.members);