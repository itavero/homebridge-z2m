export interface ExposesEntry {
  type: string;
  name?: string;
  endpoint?: string;
  access?: number;
  property?: string;
  values?: string[];
  value_off?: string | boolean | number;
  value_on?: string | boolean | number;
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
  if (x.type !== undefined) {
    return false;
  }

  return (x.name !== undefined
    || x.property !== undefined
    || x.access !== undefined
    || x.endpoint !== undefined
    || x.values !== undefined
    || (x.value_off !== undefined && x.value_on !== undefined)
    || (x.value_min !== undefined && x.value_max !== undefined)
    || x.features);
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
  value_off: string | boolean | number;
  value_on: string | boolean | number;
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
export const exposesHasNumericRangeProperty = (x: ExposesEntry): x is ExposesEntryWithNumericRangeProperty => (exposesHasProperty(x)
&& x.type === ExposesKnownTypes.NUMERIC && x.value_min !== undefined && x.value_max !== undefined);
export const exposesHasBinaryProperty = (x: ExposesEntry): x is ExposesEntryWithBinaryProperty => (exposesHasProperty(x)
&& x.type === ExposesKnownTypes.BINARY && x.value_on !== undefined && x.value_off !== undefined);
export const exposesHasEnumProperty = (x: ExposesEntry): x is ExposesEntryWithEnumProperty => (exposesHasProperty(x)
&& x.type === ExposesKnownTypes.ENUM && x.values !== undefined && x.values.length > 0);

export function exposesCanBeSet(entry: ExposesEntry): boolean {
  return (entry.access !== undefined) && ((entry.access & ExposesAccessLevel.SET) !== 0);
}

export function exposesCanBeGet(entry: ExposesEntry): boolean {
  return (entry.access !== undefined) && ((entry.access & ExposesAccessLevel.GET) !== 0);
}

export function exposesIsPublished(entry: ExposesEntry): boolean {
  return (entry.access !== undefined) && ((entry.access & ExposesAccessLevel.PUBLISHED) !== 0);
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

    exposesCollectionsAreEqual(first.features, second.features);
  }

  return true;
}

export function exposesCollectionsAreEqual(first: ExposesEntry[], second: ExposesEntry[]): boolean {
  if (first.length !== second.length) {
    return false;
  }

  for (const firstEntry of first) {
    if (second.find(e => exposesAreEqual(firstEntry, e)) === undefined) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isDeviceDefinition = (x: any): x is DeviceDefinition => (x.vendor && x.model && Array.isArray(x.exposes));

export interface DeviceListEntry {
  definition?: DeviceDefinition | null;
  friendly_name: string;
  ieee_address: string;
  supported: boolean;
  software_build_id?: string;
  date_code?: string;
}

const isNullOrUndefined = (x: unknown): x is null | undefined => (x === null || x === undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isDeviceListEntry = (x: any): x is DeviceListEntry => (x.ieee_address && x.friendly_name && x.supported);
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