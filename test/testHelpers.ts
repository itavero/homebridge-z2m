import {
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicProps,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logger,
  Service,
  SessionIdentifier,
  WithUUID,
} from 'homebridge';
import { BasicAccessory, ServiceHandler } from '../src/converters/interfaces';
import { DeviceDefinition, DeviceListEntry, ExposesEntry, isDeviceDefinition, isDeviceListEntry, isExposesEntry } from '../src/z2mModels';
import { mock, mockClear, MockProxy } from 'jest-mock-extended';
import { when } from 'jest-when';
import 'jest-chain';
import { BasicServiceCreatorManager } from '../src/converters/creators';
import fs from 'fs';
import path from 'path';

export interface HomebridgeCharacteristicSetCallback {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (value: CharacteristicValue, cb: CharacteristicSetCallback, context?: any, connectionID?: SessionIdentifier): void;
}

export const loadExposesFromFile = (filename: string): ExposesEntry[] => {
  // Check if file exists
  let filePath = filename;
  if (!fs.existsSync(filePath)) {
    // Look for manually overriden path first.
    // These files do not get updated by the documentation generation script.
    const manualOverriddenPath = path.join(__dirname, './exposes/_manual/', filename);
    if (fs.existsSync(manualOverriddenPath)) {
      filePath = manualOverriddenPath;
    } else {
      filePath = path.join(__dirname, './exposes/', filename);
    }

    if (!fs.existsSync(filePath)) {
      // Try to find it in the output of the documentation script
      const pathToGeneratedFile = path.join(__dirname, '../exposes/', filename);
      if (fs.existsSync(pathToGeneratedFile)) {
        // Copy it to filePath to make sure we put it into Git as well
        const baseDir = path.dirname(filePath);
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true });
        }
        fs.copyFileSync(pathToGeneratedFile, filePath);
      } else {
        return [];
      }
    }
    expect(fs.existsSync(filePath)).toBeTruthy();
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const output = JSON.parse(fileContent);
  expect(Array.isArray(output)).toBeTruthy();

  if (Array.isArray(output)) {
    expect(output.length).toBeGreaterThan(0);
    const invalidExposes = output.find((e) => !isExposesEntry(e));
    expect(invalidExposes).toBeUndefined();
    if (invalidExposes !== undefined) {
      return [];
    }
    return output;
  }
  return [];
};

export const testJsonDeviceListEntry = (json: string): DeviceListEntry | undefined => {
  const output = JSON.parse(json);
  expect(isDeviceListEntry(output)).toBeTruthy();

  if (isDeviceListEntry(output)) {
    expect(isDeviceDefinition(output.definition)).toBeTruthy();

    if (isDeviceDefinition(output.definition)) {
      expect(output.definition.exposes.length).toBeGreaterThan(0);
      const invalidExposes = output.definition.exposes.find((e) => !isExposesEntry(e));
      expect(invalidExposes).toBeUndefined();
      if (invalidExposes !== undefined) {
        return undefined;
      }
      return output;
    }
  }
  return undefined;
};

export const testJsonDeviceDefinition = (json: string): DeviceDefinition | undefined => {
  const output = JSON.parse(json);
  expect(isDeviceDefinition(output)).toBeTruthy();

  if (isDeviceDefinition(output)) {
    expect(output.exposes.length).toBeGreaterThan(0);
    const invalidExposes = output.exposes.find((e) => !isExposesEntry(e));
    expect(invalidExposes).toBeUndefined();
    if (invalidExposes !== undefined) {
      return undefined;
    }
    return output;
  }
  return undefined;
};

export const testJsonExposes = (json: string): ExposesEntry[] => {
  const output = JSON.parse(json);
  expect(Array.isArray(output)).toBeTruthy();

  if (Array.isArray(output)) {
    expect(output.length).toBeGreaterThan(0);
    const invalidExposes = output.find((e) => !isExposesEntry(e));
    expect(invalidExposes).toBeUndefined();
    if (invalidExposes !== undefined) {
      return [];
    }
    return output;
  }
  return [];
};

class TestCharacteristic {
  setFunction?: HomebridgeCharacteristicSetCallback;
  public readonly mock: (MockProxy<Characteristic> & Characteristic) | undefined;

  constructor(
    readonly topLevelProperty: string,
    readonly characteristic: WithUUID<{ new (): Characteristic }> | undefined,
    readonly doExpectSet: boolean
  ) {
    if (characteristic !== undefined) {
      this.mock = mock<Characteristic>();
    }
  }
}

export declare type ServiceIdentifier = string | WithUUID<{ new (): Service }>;

export interface ServiceHandlerContainer {
  addExpectedPropertyCheck(property: string): ServiceHandlerContainer;
  addExpectedCharacteristic(
    identifier: string,
    characteristic: WithUUID<{ new (): Characteristic }>,
    doExpectSet?: boolean,
    property?: string
  ): ServiceHandlerContainer;

  checkCharacteristicPropertiesHaveBeenSet(identifier: string, props: Partial<CharacteristicProps>): ServiceHandlerContainer;

  checkCharacteristicUpdateValue(identifier: string, value: CharacteristicValue): ServiceHandlerContainer;

  checkCharacteristicUpdateValues(expectedUpdates: Map<string, CharacteristicValue>): ServiceHandlerContainer;

  checkCharacteristicUpdate(
    characteristic: WithUUID<{ new (): Characteristic }> | string,
    value: CharacteristicValue
  ): ServiceHandlerContainer;

  checkCharacteristicUpdates(
    expectedUpdates: Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>
  ): ServiceHandlerContainer;

  checkNoCharacteristicUpdates(): ServiceHandlerContainer;
  callAndCheckHomeKitSetCallback(identifier: string, setValue: CharacteristicValue): ServiceHandlerContainer;

  getCharacteristicMock(identifier: string): MockProxy<Characteristic> & Characteristic;
  prepareGetCharacteristicMock(property: string): void;
}

class ServiceHandlerTestData implements ServiceHandlerContainer {
  serviceHandler?: ServiceHandler;
  readonly serviceMock: MockProxy<Service> & Service;
  readonly characteristics: Map<string, TestCharacteristic> = new Map<string, TestCharacteristic>();
  readonly addedCharacteristicUUIDs = new Set<string>();

  constructor(
    readonly serviceUuid: string,
    readonly subType: string | undefined,
    readonly serviceIdentifier: string
  ) {
    this.serviceMock = mock<Service>();
    this.serviceMock.testCharacteristic.mockImplementation((c) => {
      if (typeof c === 'string') {
        return false;
      }
      return this.addedCharacteristicUUIDs.has(c.UUID);
    });
  }

  addExpectedPropertyCheck(property: string): ServiceHandlerContainer {
    expect(this.characteristics.has(property)).toBeFalsy();
    this.characteristics.set(property, new TestCharacteristic(property, undefined, false));

    return this;
  }

  addExpectedCharacteristic(
    identifier: string,
    characteristic: WithUUID<{ new (): Characteristic }>,
    doExpectSet = false,
    property: string | undefined = undefined
  ): ServiceHandlerContainer {
    if (property === undefined) {
      property = identifier;
    }
    expect(this.characteristics.has(identifier)).toBeFalsy();
    this.characteristics.set(identifier, new TestCharacteristic(property, characteristic, doExpectSet));

    return this;
  }

  checkCharacteristicPropertiesHaveBeenSet(identifier: string, props: Partial<CharacteristicProps>): ServiceHandlerContainer {
    const mock = this.getCharacteristicMock(identifier);
    expect(mock.setProps).toHaveBeenCalledTimes(1).toHaveBeenCalledWith(props);

    return this;
  }

  getCharacteristicMock(identifier: string): MockProxy<Characteristic> & Characteristic {
    const characteristicMock = this.characteristics.get(identifier)?.mock;
    if (characteristicMock === undefined) {
      throw new Error(`Characteristic mock for identifier ${identifier} not found.`);
    }
    return characteristicMock;
  }

  prepareGetCharacteristicMock(property: string) {
    const mapping = this.characteristics.get(property);
    if (mapping === undefined) {
      throw new Error(`Unknown property ${property} passed to prepareGetCharacteristicMock`);
    }

    when(this.serviceMock.getCharacteristic).calledWith(mapping.characteristic).mockReturnValue(mapping.mock);
  }

  checkCharacteristicUpdate(
    characteristic: WithUUID<{ new (): Characteristic }> | string,
    value: CharacteristicValue
  ): ServiceHandlerContainer {
    return this.checkCharacteristicUpdates(
      new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([[characteristic, value]])
    );
  }

  checkCharacteristicUpdates(
    expectedUpdates: Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>
  ): ServiceHandlerContainer {
    expect(this.serviceMock.updateCharacteristic).toHaveBeenCalledTimes(expectedUpdates.size);

    for (const [characteristic, value] of expectedUpdates) {
      expect(this.serviceMock.updateCharacteristic).toHaveBeenCalledWith(characteristic, value);
    }
    return this;
  }

  checkCharacteristicUpdateValue(identifier: string, value: CharacteristicValue): ServiceHandlerContainer {
    return this.checkCharacteristicUpdateValues(new Map<string, CharacteristicValue>([[identifier, value]]));
  }

  checkCharacteristicUpdateValues(expectedUpdates: Map<string, CharacteristicValue>): ServiceHandlerContainer {
    for (const [identifier, value] of expectedUpdates) {
      const mock = this.getCharacteristicMock(identifier);
      expect(mock.updateValue).toHaveBeenCalledTimes(1).toHaveBeenCalledWith(value);
    }
    return this;
  }

  checkNoCharacteristicUpdates(): ServiceHandlerContainer {
    expect(this.serviceMock.updateCharacteristic).not.toHaveBeenCalled();
    return this;
  }

  callAndCheckHomeKitSetCallback(identifier: string, setValue: CharacteristicValue): ServiceHandlerContainer {
    expect(this.characteristics.has(identifier)).toBeTruthy();
    const mapping = this.characteristics.get(identifier);
    if (mapping?.setFunction === undefined) {
      throw new Error(`No set callback for identifier ${identifier} found.`);
    }

    const callbackMock = jest.fn();
    mapping.setFunction(setValue, callbackMock);

    expect(callbackMock).toHaveBeenCalledTimes(1).toHaveBeenCalledWith(null);

    return this;
  }

  clearMocks(): void {
    mockClear(this.serviceMock);
    for (const mapping of this.characteristics.values()) {
      if (mapping.mock !== undefined) {
        mockClear(mapping.mock);
      }
    }
  }
}

export class ServiceHandlersTestHarness {
  private readonly handlers = new Map<string, ServiceHandlerTestData>();
  private readonly experimentalFeatures = new Set<string>();
  private readonly converterConfig = new Map<string, unknown>();
  readonly accessoryMock: MockProxy<BasicAccessory> & BasicAccessory;

  public numberOfExpectedControllers = 0;

  constructor() {
    this.accessoryMock = mock<BasicAccessory>();
    this.accessoryMock.log = mock<Logger>();

    // Mock implementations of certain accessory functions
    this.accessoryMock.isExperimentalFeatureEnabled.mockImplementation((feature: string): boolean => {
      return this.experimentalFeatures.has(feature.trim().toLocaleUpperCase());
    });

    this.accessoryMock.getConverterConfiguration.mockImplementation((tag: string): unknown | undefined => {
      return this.converterConfig.get(tag);
    });

    this.accessoryMock.getOrAddService.mockImplementation((service: Service) => {
      const handler = [...this.handlers.values()].find((h) => h.serviceUuid === service.UUID && h.subType === service.subtype);
      expect(handler).toBeDefined();
      if (handler) {
        return handler.serviceMock;
      }

      // Next line should NEVER be executed, but needs to be there for the code to be valid.
      return service;
    });

    this.accessoryMock.isServiceHandlerIdKnown.mockImplementation((id: string): boolean => {
      // Ignore all identifiers that have not been registered before
      return !this.handlers.has(id);
    });

    this.accessoryMock.registerServiceHandler.mockImplementation((serviceHandler: ServiceHandler) => {
      // Check service identifier is known and store service handler once
      expect(serviceHandler).toBeDefined();
      const testHandler = this.handlers.get(serviceHandler.identifier);
      expect(testHandler).toBeDefined();
      if (testHandler !== undefined) {
        expect(testHandler.serviceHandler).toBeUndefined();
        testHandler.serviceHandler = serviceHandler;
      }
    });
  }

  addExperimentalFeatureFlags(feature: string): void {
    this.experimentalFeatures.add(feature);
  }

  clearExperimentalFeatureFlags(): void {
    this.experimentalFeatures.clear();
  }

  clearConverterConfigurations(): void {
    this.converterConfig.clear();
  }

  addConverterConfiguration(tag: string, value: unknown): void {
    this.converterConfig.set(tag, value);
  }

  private extractServiceId(id: ServiceIdentifier): string {
    if (typeof id === 'string') {
      return id;
    }
    return id.UUID;
  }

  generateServiceId(serviceType: WithUUID<{ new (): Service }> | string, subType: string | undefined = undefined): string {
    let serviceIdentifier = typeof serviceType === 'string' ? serviceType : serviceType.UUID;
    if (subType !== undefined) {
      serviceIdentifier += '_' + subType;
    }
    return serviceIdentifier;
  }

  getOrAddHandler(
    serviceType: WithUUID<{ new (): Service }> | string,
    subType: string | undefined = undefined,
    serviceIdentifier: string | undefined = undefined
  ): ServiceHandlerContainer {
    // Determine identifier
    const serviceUuid = typeof serviceType === 'string' ? serviceType : serviceType.UUID;
    if (serviceIdentifier === undefined) {
      serviceIdentifier = this.generateServiceId(serviceType, subType);
    }

    // Check if handler exists
    const existingHandler = this.handlers.get(serviceIdentifier);
    if (existingHandler !== undefined) {
      return existingHandler;
    }

    const newHandler = new ServiceHandlerTestData(serviceUuid, subType, serviceIdentifier);
    this.handlers.set(serviceIdentifier, newHandler);
    return newHandler;
  }

  callCreators(exposes: ExposesEntry[]) {
    BasicServiceCreatorManager.getInstance().createHomeKitEntitiesFromExposes(this.accessoryMock, exposes);
  }

  prepareCreationMocks(): void {
    for (const data of this.handlers.values()) {
      for (const mapping of data.characteristics.values()) {
        if (mapping.characteristic !== undefined) {
          when(data.serviceMock.getCharacteristic).calledWith(mapping.characteristic).mockReturnValue(undefined);

          when(data.serviceMock.addCharacteristic)
            .calledWith(mapping.characteristic)
            .mockImplementation((characteristic: Characteristic) => {
              data.addedCharacteristicUUIDs.add(characteristic.UUID);
              return mapping.mock;
            });

          if (mapping.mock !== undefined) {
            mapping.mock.on.mockReturnThis();
            mapping.mock.setProps.mockReturnThis();
          }
        }
      }
    }
  }

  checkExpectedGetableKeys(keys: string[]) {
    // Gather all keys
    const actualKeys = [...this.handlers.values()]
      .map((h) => h.serviceHandler?.getableKeys ?? [])
      .reduce((a, b) => {
        return a.concat(b);
      }, []);

    // Compare to expectations
    expect(actualKeys.sort()).toEqual(keys.sort());
  }

  checkHasMainCharacteristics(expectedResult = true): void {
    let foundCharacteristics = false;
    for (const characteristic of [...this.handlers.values()]
      .map((h) => h.serviceHandler)
      .filter((h) => h !== undefined)
      .map((h) => h!.mainCharacteristics)) {
      const count = characteristic.filter((c) => c !== undefined).length;
      if (count > 0) {
        foundCharacteristics = true;
        break;
      }
    }
    expect(foundCharacteristics).toBe(expectedResult);
  }

  checkCreationExpectations(): void {
    let expectedCallsToGetOrAddService = 0;
    let expectedCallsToRegisterServiceHandler = 0;

    expect(this.accessoryMock.configureController).toHaveBeenCalledTimes(this.numberOfExpectedControllers);

    for (const handler of this.handlers.values()) {
      expect(this.accessoryMock.isServiceHandlerIdKnown).toHaveBeenCalledWith(handler.serviceIdentifier);

      ++expectedCallsToGetOrAddService;

      let characteristicCount = 0;
      for (const mapping of handler.characteristics.values()) {
        if (mapping.characteristic !== undefined) {
          characteristicCount += 1;
        }
      }

      expect(handler.serviceMock.getCharacteristic).toHaveBeenCalledTimes(characteristicCount);

      expect(handler.serviceMock.addCharacteristic).toHaveBeenCalledTimes(characteristicCount);

      ++expectedCallsToRegisterServiceHandler;
      expect(this.accessoryMock.registerServiceHandler.mock.calls.length).toBeGreaterThanOrEqual(expectedCallsToRegisterServiceHandler);

      this.checkCharacteristicExpectations(handler);
    }

    expect(this.accessoryMock.getOrAddService).toHaveBeenCalledTimes(expectedCallsToGetOrAddService);
    expect(this.accessoryMock.registerServiceHandler).toHaveBeenCalledTimes(expectedCallsToRegisterServiceHandler);
  }

  private checkCharacteristicExpectations(handler: ServiceHandlerTestData) {
    for (const mapping of handler.characteristics.values()) {
      if (mapping.characteristic !== undefined) {
        expect(handler.serviceMock.getCharacteristic).toHaveBeenCalledWith(mapping.characteristic);

        expect(handler.serviceMock.addCharacteristic).toHaveBeenCalledWith(mapping.characteristic);

        if (mapping.doExpectSet && mapping.mock !== undefined) {
          expect(mapping.mock.on).toHaveBeenCalledTimes(1).toHaveBeenCalledWith(CharacteristicEventTypes.SET, expect.anything());

          // Store set callback for future tests
          mapping.setFunction = mapping.mock.on.mock.calls[0][1] as unknown as HomebridgeCharacteristicSetCallback;
        }
      }
    }
  }

  checkSingleUpdateState(
    json: string,
    serviceIdentifier: ServiceIdentifier,
    characteristic: WithUUID<{ new (): Characteristic }> | string,
    value: CharacteristicValue,
    checkOtherHandlersIgnoreThisUpdate = true
  ) {
    const map = new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>();
    map.set(characteristic, value);
    this.checkUpdateState(json, serviceIdentifier, map, checkOtherHandlersIgnoreThisUpdate);
  }

  checkUpdateStateIsIgnored(json: string) {
    const state = JSON.parse(json);
    const noUpdates = new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>();
    for (const handler of this.handlers.values()) {
      expect(handler?.serviceHandler).toBeDefined();
      handler?.serviceHandler?.updateState(state);
      handler?.checkCharacteristicUpdates(noUpdates);
    }
  }

  checkUpdateState(
    json: string,
    serviceIdentifier: ServiceIdentifier,
    expectedUpdates: Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>,
    checkOtherHandlersIgnoreThisUpdate = true
  ) {
    const state = JSON.parse(json);

    const serviceId = this.extractServiceId(serviceIdentifier);
    const handler = this.handlers.get(serviceId);
    expect(handler).toBeDefined();

    expect(handler?.serviceHandler).toBeDefined();
    handler?.serviceHandler?.updateState(state);

    handler?.checkCharacteristicUpdates(expectedUpdates);

    if (checkOtherHandlersIgnoreThisUpdate) {
      const noUpdates = new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>();
      for (const [id, otherHandler] of this.handlers) {
        if (id === serviceId) {
          // already verified
          continue;
        }

        expect(otherHandler?.serviceHandler).toBeDefined();
        otherHandler?.serviceHandler?.updateState(state);
        otherHandler?.checkCharacteristicUpdates(noUpdates);
      }
    }
  }

  checkHomeKitUpdateWithSingleValue(
    serviceIdentifier: ServiceIdentifier,
    identifier: string,
    setValue: CharacteristicValue,
    value: unknown,
    property: string | undefined = undefined
  ) {
    if (property === undefined) {
      property = identifier;
    }
    const data = {};
    data[property] = value;
    this.checkHomeKitUpdate(serviceIdentifier, identifier, setValue, data);
  }

  checkHomeKitUpdate(serviceIdentifier: ServiceIdentifier, identifier: string, setValue: CharacteristicValue, expectedData: unknown) {
    const handler = this.handlers.get(this.extractServiceId(serviceIdentifier));
    expect(handler).toBeDefined();
    handler?.callAndCheckHomeKitSetCallback(identifier, setValue);
    this.checkSetDataQueued(expectedData);
  }

  checkSetDataQueued(expectedData: unknown) {
    expect(this.accessoryMock.queueDataForSetAction).toHaveBeenCalledTimes(1).toHaveBeenCalledWith(expectedData);
  }

  checkNoSetDataQueued() {
    expect(this.accessoryMock.queueDataForSetAction).not.toHaveBeenCalled();
  }

  checkGetKeysQueued(expectedKeys: string | string[]) {
    expect(this.accessoryMock.queueKeyForGetAction).toHaveBeenCalledTimes(1).toHaveBeenCalledWith(expectedKeys);
  }

  checkNoGetKeysQueued() {
    expect(this.accessoryMock.queueKeyForGetAction).not.toHaveBeenCalled();
  }

  clearMocks(): void {
    mockClear(this.accessoryMock);
    this.handlers.forEach((h) => h.clearMocks());
  }
}
