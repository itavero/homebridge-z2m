import {
  Characteristic, CharacteristicEventTypes, CharacteristicProps, CharacteristicSetCallback, CharacteristicValue, Logger, Service,
  SessionIdentifier, WithUUID,
} from 'homebridge';
import { BasicAccessory, BasicPlatform, ServiceHandler } from '../src/converters/interfaces';
import { DeviceDefinition, DeviceListEntry, ExposesEntry, isDeviceDefinition, isDeviceListEntry, isExposesEntry } from '../src/z2mModels';
import { AdaptiveLightingConfiguration } from '../src/configModels';
import { mock, mockClear, MockProxy } from 'jest-mock-extended';
import { when } from 'jest-when';
import 'jest-chain';
import { BasicServiceCreatorManager } from '../src/converters/creators';
import * as semver from 'semver';

export interface HomebridgeCharacteristicSetCallback {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (value: CharacteristicValue, cb: CharacteristicSetCallback, context?: any, connectionID?: SessionIdentifier): void;
}

export const testJsonDeviceListEntry = (json: string): DeviceListEntry | undefined => {
  const output = JSON.parse(json);
  expect(isDeviceListEntry(output)).toBeTruthy();

  if (isDeviceListEntry(output)) {
    expect(isDeviceDefinition(output.definition)).toBeTruthy();

    if (isDeviceDefinition(output.definition)) {
      expect(output.definition.exposes.length).toBeGreaterThan(0);
      const invalidExposes = output.definition.exposes.find(e => !isExposesEntry(e));
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
    const invalidExposes = output.exposes.find(e => !isExposesEntry(e));
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
    const invalidExposes = output.find(e => !isExposesEntry(e));
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
  public readonly mock: MockProxy<Characteristic> & Characteristic | undefined;

  constructor(
    readonly topLevelProperty: string,
    readonly characteristic: WithUUID<{ new(): Characteristic }> | undefined,
    readonly doExpectSet: boolean,
    readonly doExpectCheckPropertyExcluded: boolean,
  ) {
    if (characteristic !== undefined) {
      this.mock = mock<Characteristic>();
    }
  }
}

export declare type ServiceIdentifier = string | WithUUID<{ new(): Service }>;

export interface ServiceHandlerContainer {
  addExpectedPropertyCheck(property: string): ServiceHandlerContainer;
  addExpectedCharacteristic(identifier: string, characteristic: WithUUID<{ new(): Characteristic }>, doExpectSet?: boolean,
    property?: string, doExpectCheckPropertyExcluded?: boolean): ServiceHandlerContainer;

  checkCharacteristicPropertiesHaveBeenSet(identifier: string, props: Partial<CharacteristicProps>): ServiceHandlerContainer;

  checkCharacteristicUpdateValue(identifier: string, value: CharacteristicValue): ServiceHandlerContainer;

  checkCharacteristicUpdateValues(expectedUpdates: Map<string, CharacteristicValue>): ServiceHandlerContainer;

  checkCharacteristicUpdate(characteristic: WithUUID<{ new(): Characteristic }> | string,
    value: CharacteristicValue): ServiceHandlerContainer;

  checkCharacteristicUpdates(expectedUpdates: Map<WithUUID<{ new(): Characteristic }> | string,
    CharacteristicValue>): ServiceHandlerContainer;

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

  constructor(readonly serviceUuid: string, readonly subType: string | undefined, readonly serviceIdentifier: string) {
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
    this.characteristics.set(property, new TestCharacteristic(property, undefined, false, true));

    return this;
  }

  addExpectedCharacteristic(identifier: string, characteristic: WithUUID<{ new(): Characteristic }>, doExpectSet = false,
    property: string | undefined = undefined, doExpectCheckPropertyExcluded = true): ServiceHandlerContainer {
    if (property === undefined) {
      property = identifier;
    }
    expect(this.characteristics.has(identifier)).toBeFalsy();
    this.characteristics.set(identifier, new TestCharacteristic(property, characteristic, doExpectSet,
      doExpectCheckPropertyExcluded));

    return this;
  }

  checkCharacteristicPropertiesHaveBeenSet(identifier: string, props: Partial<CharacteristicProps>): ServiceHandlerContainer {
    const mock = this.getCharacteristicMock(identifier);
    expect(mock.setProps)
      .toBeCalledTimes(1)
      .toBeCalledWith(props);

    return this;
  }

  getCharacteristicMock(identifier: string): MockProxy<Characteristic> & Characteristic {
    const characteristicMock = this.characteristics.get(identifier)?.mock;
    if (characteristicMock === undefined) {
      throw new Error(`Characterstic mock for identifier ${identifier} not found.`);
    }
    return characteristicMock;
  }

  prepareGetCharacteristicMock(property: string) {
    const mapping = this.characteristics.get(property);
    if (mapping === undefined) {
      throw new Error(`Unknown property ${property} passed to prepareGetCharacteristicMock`);
    }

    when(this.serviceMock.getCharacteristic)
      .calledWith(mapping.characteristic)
      .mockReturnValue(mapping.mock);
  }

  checkCharacteristicUpdate(characteristic: WithUUID<{ new(): Characteristic }> | string, value: CharacteristicValue):
    ServiceHandlerContainer {
    return this.checkCharacteristicUpdates(new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
      [characteristic, value],
    ]));
  }

  checkCharacteristicUpdates(expectedUpdates: Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>):
    ServiceHandlerContainer {
    expect(this.serviceMock.updateCharacteristic)
      .toBeCalledTimes(expectedUpdates.size);

    for (const [characteristic, value] of expectedUpdates) {
      expect(this.serviceMock.updateCharacteristic)
        .toBeCalledWith(characteristic, value);
    }
    return this;
  }

  checkCharacteristicUpdateValue(identifier: string, value: CharacteristicValue): ServiceHandlerContainer {
    return this.checkCharacteristicUpdateValues(new Map<string, CharacteristicValue>([
      [identifier, value],
    ]));
  }

  checkCharacteristicUpdateValues(expectedUpdates: Map<string, CharacteristicValue>): ServiceHandlerContainer {
    for (const [identifier, value] of expectedUpdates) {
      const mock = this.getCharacteristicMock(identifier);
      expect(mock.updateValue)
        .toBeCalledTimes(1)
        .toBeCalledWith(value);
    }
    return this;
  }

  checkNoCharacteristicUpdates(): ServiceHandlerContainer {
    expect(this.serviceMock.updateCharacteristic)
      .not.toBeCalled();
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

    expect(callbackMock)
      .toBeCalledTimes(1)
      .toBeCalledWith(null);

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
  private readonly allowedValues = new Map<string, string[]>();
  private readonly experimentalFeatures = new Set<string>();
  readonly accessoryMock: MockProxy<BasicAccessory> & BasicAccessory;
  public serverVersion = '1.1.7';
  public adaptiveLighting: AdaptiveLightingConfiguration = {
    enabled: true,
    min_ct_change: 0,
    transition: 0,
  };

  public numberOfExpectedControllers = 0;

  constructor() {
    this.accessoryMock = mock<BasicAccessory>();
    this.accessoryMock.log = mock<Logger>();
    this.accessoryMock.platform = mock<BasicPlatform>();

    // Mock implementations of certain accessory functions
    this.accessoryMock.isValueAllowedForProperty
      .mockImplementation((property: string, value: string): boolean => {
        return this.allowedValues.get(property)?.includes(value) ?? true;
      });

    this.accessoryMock.isExperimentalFeatureEnabled
      .mockImplementation((feature: string): boolean => {
        return this.experimentalFeatures.has(feature.trim().toLocaleUpperCase());
      });

    this.accessoryMock.getOrAddService
      .mockImplementation((service: Service) => {
        const handler = [...this.handlers.values()].find(h => h.serviceUuid === service.UUID && h.subType === service.subtype);
        expect(handler).toBeDefined();
        if (handler) {
          return handler.serviceMock;
        }

        // Next line should NEVER be executed, but needs to be there for the code to be valid.
        return service;
      });

    this.accessoryMock.isServiceHandlerIdKnown
      .mockImplementation((id: string): boolean => {
        // Ignore all identifiers that have not been registered before
        return !this.handlers.has(id);
      });

    this.accessoryMock.registerServiceHandler
      .mockImplementation((serviceHandler: ServiceHandler) => {
        // Check service identifier is known and store service handler once
        expect(serviceHandler).toBeDefined();
        const testHandler = this.handlers.get(serviceHandler.identifier);
        expect(testHandler).toBeDefined();
        if (testHandler !== undefined) {
          expect(testHandler.serviceHandler).toBeUndefined();
          testHandler.serviceHandler = serviceHandler;
        }
      });

    // Mock implementation for certain platform functions
    this.accessoryMock.platform.isHomebridgeServerVersionGreaterOrEqualTo
      .mockImplementation((v: string) => semver.gte(this.serverVersion, v));

    // Mock implementation for adaptive lighting functions
    this.accessoryMock.isAdaptiveLightingEnabled.mockImplementation(() => this.adaptiveLighting.enabled ?? true);
    this.accessoryMock.getAdaptiveLightingMinimumColorTemperatureChange.mockImplementation(() => this.adaptiveLighting.min_ct_change ?? 0);
    this.accessoryMock.getAdaptiveLightingTransitionTime.mockImplementation(() => this.adaptiveLighting.transition ?? 0);
  }

  configureAllowedValues(property: string, values: string[]) {
    this.allowedValues.set(property, values);
  }

  addExperimentalFeatureFlags(feature: string): void {
    this.experimentalFeatures.add(feature);
  }

  clearExperimentalFeatureFlags(): void {
    this.experimentalFeatures.clear();
  }

  private extractServiceId(id: ServiceIdentifier): string {
    if (typeof id === 'string') {
      return id;
    }
    return id.UUID;
  }

  generateServiceId(serviceType: WithUUID<{ new(): Service }> | string, subType: string | undefined = undefined): string {
    let serviceIdentifier = (typeof serviceType === 'string') ? serviceType : serviceType.UUID;
    if (subType !== undefined) {
      serviceIdentifier += '_' + subType;
    }
    return serviceIdentifier;
  }

  getOrAddHandler(serviceType: WithUUID<{ new(): Service }> | string, subType: string | undefined = undefined,
    serviceIdentifier: string | undefined = undefined): ServiceHandlerContainer {
    // Determine identifier
    const serviceUuid = (typeof serviceType === 'string') ? serviceType : serviceType.UUID;
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
        if (mapping.doExpectCheckPropertyExcluded) {
          when(this.accessoryMock.isPropertyExcluded)
            .calledWith(mapping.topLevelProperty)
            .mockReturnValue(false);
        }
        if (mapping.characteristic !== undefined) {
          when(data.serviceMock.getCharacteristic)
            .calledWith(mapping.characteristic)
            .mockReturnValue(undefined);

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
    const actualKeys = [...this.handlers.values()].map(h => h.serviceHandler?.getableKeys ?? []).reduce((a, b) => {
      return a.concat(b);
    }, []);

    // Compare to expectations
    expect(actualKeys.sort()).toEqual(keys.sort());
  }

  checkCreationExpectations(): void {
    let expectedCallsToGetOrAddService = 0;
    let expectedCallsToRegisterServiceHandler = 0;

    expect(this.accessoryMock.configureController)
      .toBeCalledTimes(this.numberOfExpectedControllers);

    for (const handler of this.handlers.values()) {
      expect(this.accessoryMock.isServiceHandlerIdKnown)
        .toHaveBeenCalledWith(handler.serviceIdentifier);

      ++expectedCallsToGetOrAddService;

      let characteristicCount = 0;
      for (const mapping of handler.characteristics.values()) {
        if (mapping.characteristic !== undefined) {
          characteristicCount += 1;
        }
      }

      expect(handler.serviceMock.getCharacteristic)
        .toBeCalledTimes(characteristicCount);

      expect(handler.serviceMock.addCharacteristic)
        .toBeCalledTimes(characteristicCount);

      ++expectedCallsToRegisterServiceHandler;
      expect(this.accessoryMock.registerServiceHandler.mock.calls.length).toBeGreaterThanOrEqual(expectedCallsToRegisterServiceHandler);

      for (const mapping of handler.characteristics.values()) {
        if (mapping.doExpectCheckPropertyExcluded) {
          expect(this.accessoryMock.isPropertyExcluded)
            .toBeCalledWith(mapping.topLevelProperty);
        }

        if (mapping.characteristic !== undefined) {
          expect(handler.serviceMock.getCharacteristic)
            .toBeCalledWith(mapping.characteristic);

          expect(handler.serviceMock.addCharacteristic)
            .toBeCalledWith(mapping.characteristic);

          if (mapping.doExpectSet && mapping.mock !== undefined) {
            expect(mapping.mock.on)
              .toHaveBeenCalledTimes(1)
              .toHaveBeenCalledWith(CharacteristicEventTypes.SET, expect.anything());

            // Store set callback for future tests
            mapping.setFunction = (mapping.mock.on.mock.calls[0][1] as unknown) as HomebridgeCharacteristicSetCallback;
          }
        }
      }
    }

    expect(this.accessoryMock.getOrAddService)
      .toHaveBeenCalledTimes(expectedCallsToGetOrAddService);
    expect(this.accessoryMock.registerServiceHandler)
      .toHaveBeenCalledTimes(expectedCallsToRegisterServiceHandler);
  }

  checkSingleUpdateState(json: string, serviceIdentifier: ServiceIdentifier,
    characteristic: WithUUID<{ new(): Characteristic }> | string, value: CharacteristicValue, checkOtherHandlersIgnoreThisUpdate = true) {
    const map = new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>();
    map.set(characteristic, value);
    this.checkUpdateState(json, serviceIdentifier, map, checkOtherHandlersIgnoreThisUpdate);
  }

  checkUpdateStateIsIgnored(json: string) {
    const state = JSON.parse(json);
    const noUpdates = new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>();
    for (const handler of this.handlers.values()) {
      expect(handler?.serviceHandler).toBeDefined();
      handler?.serviceHandler?.updateState(state);
      handler?.checkCharacteristicUpdates(noUpdates);
    }
  }

  checkUpdateState(json: string, serviceIdentifier: ServiceIdentifier,
    expectedUpdates: Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>, checkOtherHandlersIgnoreThisUpdate = true) {
    const state = JSON.parse(json);

    const serviceId = this.extractServiceId(serviceIdentifier);
    const handler = this.handlers.get(serviceId);
    expect(handler).toBeDefined();

    expect(handler?.serviceHandler).toBeDefined();
    handler?.serviceHandler?.updateState(state);

    handler?.checkCharacteristicUpdates(expectedUpdates);

    if (checkOtherHandlersIgnoreThisUpdate) {
      const noUpdates = new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>();
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

  checkHomeKitUpdateWithSingleValue(serviceIdentifier: ServiceIdentifier, identifier: string, setValue: CharacteristicValue, value: unknown,
    property: string | undefined = undefined) {
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
    expect(this.accessoryMock.queueDataForSetAction)
      .toBeCalledTimes(1)
      .toBeCalledWith(expectedData);
  }

  checkNoSetDataQueued() {
    expect(this.accessoryMock.queueDataForSetAction)
      .not.toBeCalled();
  }

  checkGetKeysQueued(expectedKeys: string | string[]) {
    expect(this.accessoryMock.queueKeyForGetAction)
      .toBeCalledTimes(1)
      .toBeCalledWith(expectedKeys);
  }

  checkNoGetKeysQueued() {
    expect(this.accessoryMock.queueKeyForGetAction)
      .not.toBeCalled();
  }

  clearMocks(): void {
    mockClear(this.accessoryMock);
    this.handlers.forEach(h => h.clearMocks());
  }

}