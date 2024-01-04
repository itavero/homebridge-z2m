export class SwitchActionMapping {
  public serviceLabelIndex: number | undefined;
  public extension: number | undefined;
  public valueSinglePress: string | undefined;
  public valueDoublePress: string | undefined;
  public valueLongPress: string | undefined;

  private _id: string | undefined;

  get subType(): string | undefined {
    if (this.extension === undefined || this.extension === 0) {
      return this.identifier;
    }
    return `${this._id ?? ''}#ext${this.extension}`;
  }

  get identifier(): string | undefined {
    return this._id;
  }

  set identifier(value: string | undefined) {
    if (this._id !== undefined || this.serviceLabelIndex !== undefined || this.extension !== undefined) {
      throw new Error('Can only set identifier once and before serviceLabelIndex has been set.');
    }
    this._id = value;
  }

  public merge(other: SwitchActionMapping): this {
    if (this.subType !== other.subType) {
      throw new Error(
        'Can NOT merge SwitchActionMapping instances with different identifiers and/or extensions. ' +
          `(got subtype ${this.subType} and ${other.subType})`
      );
    }

    if (this.serviceLabelIndex === undefined) {
      this.serviceLabelIndex = other.serviceLabelIndex;
    } else {
      this.compareValuesForMerge('service label index', this.serviceLabelIndex, other.serviceLabelIndex);
    }

    if (this.valueSinglePress === undefined) {
      this.valueSinglePress = other.valueSinglePress;
    } else {
      this.compareValuesForMerge('single press', this.valueSinglePress, other.valueSinglePress);
    }

    if (this.valueDoublePress === undefined) {
      this.valueDoublePress = other.valueDoublePress;
    } else {
      this.compareValuesForMerge('double press', this.valueDoublePress, other.valueDoublePress);
    }

    if (this.valueLongPress === undefined) {
      this.valueLongPress = other.valueLongPress;
    } else {
      this.compareValuesForMerge('long press', this.valueLongPress, other.valueLongPress);
    }
    return this;
  }

  private compareValuesForMerge(description: string, local: string | number, other: string | number | undefined) {
    if (other === undefined) {
      return;
    }
    if (other !== local) {
      throw new Error(
        `Can NOT merge SwitchActionMapping instances that both have a different value for ${description}. ` + `(got ${local} and ${other})`
      );
    }
  }

  public hasValidValues(): boolean {
    return this.valueSinglePress !== undefined || this.valueDoublePress !== undefined || this.valueLongPress !== undefined;
  }

  public isValidMapping(): boolean {
    return this.serviceLabelIndex !== undefined && this.hasValidValues();
  }

  public toString(): string | undefined {
    if (!this.isValidMapping()) {
      return undefined;
    }
    let str = `Button ${this.serviceLabelIndex}`;
    if (this.identifier !== undefined) {
      str += ` (${this.identifier})`;
    }
    if (this.extension !== undefined && this.extension > 0) {
      str += ` #ext${this.extension}`;
    }
    str += ':';
    if (this.valueSinglePress !== undefined) {
      str += `\n\t- SINGLE: ${this.valueSinglePress}`;
    }
    if (this.valueDoublePress !== undefined) {
      str += `\n\t- DOUBLE: ${this.valueDoublePress}`;
    }
    if (this.valueLongPress !== undefined) {
      str += `\n\t- LONG  : ${this.valueLongPress}`;
    }
    return str;
  }
}

export class SwitchActionHelper {
  private static readonly singleAction: Set<string> = new Set(['single', 'click', 'press']);

  private static readonly doubleAction: Set<string> = new Set(['double']);

  private static readonly longAction: Set<string> = new Set(['hold', 'long']);

  private static readonly tripleAction: Set<string> = new Set(['triple', 'tripple']);

  private static readonly quadrupleAction: Set<string> = new Set(['quadruple']);

  private static readonly ignoredAdditions: Set<string> = new Set(['release', 'hold-release']);

  private static readonly separators: string[] = ['_', '-'];

  private static readonly regex_number = /(\d{1,3})/;

  private readonly regex_id_start: RegExp;
  private readonly regex_id_end: RegExp;
  private readonly regex_separator_count: RegExp;

  private static instance: SwitchActionHelper;

  private constructor() {
    const additions = [
      ...SwitchActionHelper.ignoredAdditions,
      ...SwitchActionHelper.singleAction,
      ...SwitchActionHelper.doubleAction,
      ...SwitchActionHelper.longAction,
      ...SwitchActionHelper.tripleAction,
      ...SwitchActionHelper.quadrupleAction,
    ].join('|');
    const separatorsString = SwitchActionHelper.separators.join('');

    this.regex_id_start = new RegExp(`^(${additions})[${separatorsString}]`, 'i');
    this.regex_id_end = new RegExp(`[${separatorsString}](${additions})$`, 'i');
    this.regex_separator_count = new RegExp(`[${separatorsString}]+`, 'ig');
  }

  public static getInstance(): SwitchActionHelper {
    if (SwitchActionHelper.instance === undefined) {
      SwitchActionHelper.instance = new SwitchActionHelper();
    }
    return SwitchActionHelper.instance;
  }

  private firstNumberInString(input: string): number | undefined {
    const numbers = SwitchActionHelper.regex_number.exec(input)?.map((x: string) => parseInt(x));
    if (numbers !== undefined && numbers.length > 0 && !isNaN(numbers[0])) {
      return numbers[0];
    }
    return undefined;
  }

  private numberOfSeparators(input: string): number {
    return (input.match(this.regex_separator_count) || []).length;
  }

  private matchActionValues(mapping: SwitchActionMapping, value: string, type: string | undefined = undefined): boolean {
    if (type === undefined) {
      type = value;
    }
    type = type.toLowerCase();

    if (SwitchActionHelper.singleAction.has(type)) {
      mapping.valueSinglePress = value;
      return true;
    }

    if (SwitchActionHelper.doubleAction.has(type)) {
      mapping.valueDoublePress = value;
      return true;
    }

    if (SwitchActionHelper.longAction.has(type)) {
      mapping.valueLongPress = value;
      return true;
    }

    // Extended actions
    if (SwitchActionHelper.tripleAction.has(type)) {
      mapping.extension = 1;
      mapping.valueSinglePress = value;
      return true;
    }

    if (SwitchActionHelper.quadrupleAction.has(type)) {
      mapping.extension = 1;
      mapping.valueDoublePress = value;
      return true;
    }

    return false;
  }

  private valueToMapping(input: string): SwitchActionMapping {
    // Devices that have a wildcard in the reported values can not be supported.
    if (input.indexOf('*') >= 0) {
      throw new Error('Device found with a wildcard in the exposed possible values for the action, which cannot be mapped: ' + input);
    }

    // Check exact matches first
    const mapping = new SwitchActionMapping();
    if (this.matchActionValues(mapping, input)) {
      return mapping;
    }
    if (SwitchActionHelper.ignoredAdditions.has(input)) {
      return mapping;
    }

    mapping.identifier = input.replace(this.regex_id_start, '').replace(this.regex_id_end, '');

    // Check if identifier is equal to the input
    // If so, consider it a single press action
    if (input === mapping.identifier) {
      mapping.valueSinglePress = input;
      return mapping;
    }

    // Determine action for value
    const startMatch = this.regex_id_start.exec(input);
    if (startMatch && startMatch.length >= 2 && this.matchActionValues(mapping, input, startMatch[1])) {
      return mapping;
    }
    const endMatch = this.regex_id_end.exec(input);
    if (endMatch && endMatch.length >= 2 && this.matchActionValues(mapping, input, endMatch[1])) {
      return mapping;
    }

    return mapping;
  }

  valuesToNumberedMappings(values: string[]): SwitchActionMapping[] {
    // Convert and combine
    const groupedMappings = new Map<string | undefined, SwitchActionMapping>();
    for (const value of values) {
      const mapping = this.valueToMapping(value);
      const existingMapping = groupedMappings.get(mapping.subType);
      if (existingMapping !== undefined) {
        existingMapping.merge(mapping);
      } else {
        groupedMappings.set(mapping.subType, mapping);
      }
    }

    // Filter out invalid mappings and sort them
    const sortedMappings = this.sortMappingsByIdentifier([...groupedMappings.values()].filter((m) => m.hasValidValues()));

    // Determine labels
    this.labelSortedMappings(sortedMappings);

    return sortedMappings;
  }

  private determineLabelStrategy(mappings: SwitchActionMapping[]): [number, boolean, number] {
    // Check which single digit numbers are present in the identifiers and how often the same number is used
    let maximumExtension = 0;
    let maximumTimesNumberIsUsed = 0;
    let highestNumber = 0;
    const foundNumbers = new Map<number, number>();
    for (const mapping of mappings) {
      const numericId = this.firstNumberInString(mapping.identifier ?? '');

      if ((mapping.extension ?? 0) > maximumExtension) {
        maximumExtension = mapping.extension ?? 0;
      }

      if (numericId !== undefined && numericId <= 9) {
        const newCount = (foundNumbers.get(numericId) ?? 0) + 1;
        foundNumbers.set(numericId, newCount);

        if (newCount > maximumTimesNumberIsUsed) {
          maximumTimesNumberIsUsed = newCount;
        }

        if (numericId > highestNumber) {
          highestNumber = numericId;
        }
      }
    }

    // Determine numbering strategy
    const numericMultiplier = maximumTimesNumberIsUsed <= 1 ? 1 : 10;
    const useIncrementalNumbers = maximumTimesNumberIsUsed > 10;
    const startLabelForNonNumericIds = useIncrementalNumbers ? 1 : (highestNumber + 1) * numericMultiplier;

    return [numericMultiplier, useIncrementalNumbers, startLabelForNonNumericIds];
  }

  private labelSortedMappings(mappings: SwitchActionMapping[]) {
    // Determine strategy
    const [numericMultiplier, useIncrementalNumbers, startLabelForNonNumericIds] = this.determineLabelStrategy(mappings);

    // Apply service labels
    const usedLabels = new Set<number>();
    for (const mapping of mappings) {
      // Use first numeric value in identifier (if present)
      const foundNumber = this.firstNumberInString(mapping.identifier ?? '');
      let maximumNumber = 255;

      let numericId = startLabelForNonNumericIds;
      if (!useIncrementalNumbers && foundNumber !== undefined && foundNumber > 0 && foundNumber <= 9) {
        numericId = foundNumber * numericMultiplier;
        maximumNumber = numericId + (numericMultiplier - 1);
      }

      // Find first available index
      while (usedLabels.has(numericId)) {
        ++numericId;
        if (numericId >= maximumNumber) {
          throw new Error('Service Label Index going out of range!');
        }
      }

      mapping.serviceLabelIndex = numericId;

      // Store used label to prevent duplicates
      usedLabels.add(numericId);
    }
  }

  private sortByFirstNumber(x: string, y: string): number {
    const X_GOES_FIRST = -1;
    const Y_GOES_FIRST = 1;

    const firstNumberInX = this.firstNumberInString(x);
    const firstNumberInY = this.firstNumberInString(y);

    if (firstNumberInX !== undefined) {
      if (firstNumberInY === undefined) {
        return X_GOES_FIRST;
      }
      // Both have numbers, compare first number in string
      if (firstNumberInX === firstNumberInY) {
        // No preference
        return 0;
      }

      // Prefer any number over 0, as the service label in HomeKit can not be 0.
      if (firstNumberInX === 0) {
        return Y_GOES_FIRST;
      }
      if (firstNumberInY === 0) {
        return X_GOES_FIRST;
      }

      // No zero values, just compare them then.
      if (firstNumberInX < firstNumberInY) {
        return X_GOES_FIRST;
      }
      if (firstNumberInX > firstNumberInY) {
        return Y_GOES_FIRST;
      }
    } else if (firstNumberInY !== undefined) {
      return Y_GOES_FIRST;
    }

    return 0;
  }

  private sortMappingsByIdentifier(ids: SwitchActionMapping[]): SwitchActionMapping[] {
    return ids.sort((xMapping: SwitchActionMapping, yMapping: SwitchActionMapping): number => {
      const X_GOES_FIRST = -1;
      const Y_GOES_FIRST = 1;

      const x = xMapping.identifier?.toLowerCase().trim() ?? '';
      const y = yMapping.identifier?.toLowerCase().trim() ?? '';
      if (x === y) {
        const extensionX = xMapping.extension ?? 0;
        const extensionY = yMapping.extension ?? 0;
        return extensionX - extensionY;
      }

      // Prefer strings with a numeric sequence.
      // If both have one, the lowest number is preferred.
      const numberResult = this.sortByFirstNumber(x, y);
      if (numberResult !== 0) {
        return numberResult;
      }

      // Prefer empty string over other values
      if (x === '') {
        return X_GOES_FIRST;
      }
      if (y === '') {
        return Y_GOES_FIRST;
      }

      // Prefer strings with fewer separators
      const separatorCountX = this.numberOfSeparators(x);
      const separatorCountY = this.numberOfSeparators(y);
      if (separatorCountX < separatorCountY) {
        return X_GOES_FIRST;
      }
      if (separatorCountX > separatorCountY) {
        return Y_GOES_FIRST;
      }

      // Use normal alphabetic order
      if (x < y) {
        return X_GOES_FIRST;
      }
      if (x > y) {
        return Y_GOES_FIRST;
      }

      return 0;
    });
  }
}
