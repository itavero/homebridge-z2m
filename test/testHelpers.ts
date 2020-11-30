import { Characteristic, CharacteristicEventTypes, CharacteristicSetCallback, CharacteristicValue, Logger, Service, SessionIdentifier,
  WithUUID } from 'homebridge';
import { BasicAccessory, ServiceHandler } from '../src/converters/interfaces';
import { DeviceListEntry, ExposesEntry, isDeviceDefinition, isDeviceListEntry } from '../src/z2mModels';
import { mock, mockClear, MockProxy } from 'jest-mock-extended';
import { when } from 'jest-when';
import 'jest-chain';
import { BasicServiceCreatorManager } from '../src/converters/creators';

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
      return output;
    }
  }
  return undefined;
};

class TestCharacteristic {
  setFunction? : HomebridgeCharacteristicSetCallback;
  public readonly mock : MockProxy<Characteristic> & Characteristic | undefined;

  constructor(
    readonly topLevelProperty : string,
    readonly characteristic : WithUUID<{new (): Characteristic}> | undefined,
    readonly doExpectSet : boolean,
    readonly doExpectCheckPropertyExcluded : boolean,
  ) {
    if (characteristic !== undefined) {
      this.mock = mock<Characteristic>();
    }
  }
}

export class ServiceHandlerTestHarness {
  serviceHandler? : ServiceHandler;
  serviceIdentifier : string;
  readonly accessoryMock : MockProxy<BasicAccessory> & BasicAccessory;
  readonly serviceMock : MockProxy<Service> & Service;
  private readonly characteristics : Map<string, TestCharacteristic> =
  new Map<string, TestCharacteristic>();

  constructor(
   private readonly serviceType: WithUUID<{new (): Service}> | undefined,
   serviceIdentifier : string | undefined = undefined,
  ) {
    this.accessoryMock = mock<BasicAccessory>();
    this.accessoryMock.log = mock<Logger>();
    this.serviceMock = mock<Service>();

    if (this.serviceType === undefined && serviceIdentifier === undefined) {
      throw new Error('serviceIdentifier must be provided if serviceType is not provided');
    }
    this.serviceIdentifier = serviceIdentifier ?? this.serviceType?.UUID ?? '';
  }

  callCreators(exposes : ExposesEntry[]) {
    BasicServiceCreatorManager.getInstance().createHomeKitEntitiesFromExposes(this.accessoryMock, exposes);
  }

  addExpectedPropertyCheck(property: string) {
    expect(this.characteristics.has(property)).toBeFalsy();
    this.characteristics.set(property, new TestCharacteristic(property, undefined, false, true));
  }

  addExpectedCharacteristic(identifier: string, characteristic: WithUUID<{new (): Characteristic}>, doExpectSet = false,
    property : string | undefined = undefined, doExpectCheckPropertyExcluded = true) : void {
    if (property === undefined) {
      property = identifier;
    }
    expect(this.characteristics.has(identifier)).toBeFalsy();
    this.characteristics.set(identifier, new TestCharacteristic(property, characteristic, doExpectSet,
      doExpectCheckPropertyExcluded));
  }

  getCharacteristicMock(identifier: string) : MockProxy<Characteristic> & Characteristic {
    const characteristicMock = this.characteristics.get(identifier)?.mock;
    if (characteristicMock === undefined) {
      throw new Error(`Characterstic mock for identifier ${identifier} not found.`);
    }
    return characteristicMock;
  }

  prepareCreationMocks(): void {
    when(this.accessoryMock.isServiceHandlerIdKnown)
      .mockReturnValue(true)
      .calledWith(this.serviceIdentifier)
      .mockReturnValue(false);

    when(this.accessoryMock.getOrAddService)
      .calledWith(this.serviceType === undefined ? expect.anything() : expect.any(this.serviceType))
      .mockReturnValueOnce(this.serviceMock);

    for (const mapping of this.characteristics.values()) {
      if (mapping.doExpectCheckPropertyExcluded) {
        when(this.accessoryMock.isPropertyExcluded)
          .calledWith(mapping.topLevelProperty)
          .mockReturnValue(false);
      }
      if (mapping.characteristic !== undefined) {
        when(this.serviceMock.getCharacteristic)
          .calledWith(mapping.characteristic)
          .mockReturnValue(undefined);
      
        when(this.serviceMock.addCharacteristic)
          .calledWith(mapping.characteristic)
          .mockReturnValue(mapping.mock);
      }
    }

    when(this.accessoryMock.registerServiceHandler)
      .calledWith(expect.anything());
  }

  checkExpectedGetableKeys(keys: string[]) {
    expect(this.serviceHandler).toBeDefined();
    const actualKeys = this.serviceHandler?.getableKeys ?? [];
    expect(actualKeys.sort()).toEqual(keys.sort());
  }

  checkCreationExpectations(): void {
    expect(this.accessoryMock.isServiceHandlerIdKnown)
      .toHaveBeenCalledWith(this.serviceIdentifier);
    expect(this.accessoryMock.getOrAddService)
      .toHaveBeenCalledTimes(1);
    if (this.serviceType !== undefined) {
      expect(this.accessoryMock.getOrAddService)
        .toHaveBeenCalledWith(expect.any(this.serviceType));
    }

    let characteristicCount = 0;
    for (const mapping of this.characteristics.values()) {
      if (mapping.characteristic !== undefined) {
        characteristicCount += 1;
      }
    }
    
    expect(this.serviceMock.getCharacteristic)
      .toBeCalledTimes(characteristicCount);
    
    expect(this.serviceMock.addCharacteristic)
      .toBeCalledTimes(characteristicCount);

    expect(this.accessoryMock.registerServiceHandler)
      .toHaveBeenCalledTimes(1);

    // Store Service Handler for future tests
    this.serviceHandler = this.accessoryMock.registerServiceHandler.mock.calls[0][0];

    for (const mapping of this.characteristics.values()) {
      if (mapping.doExpectCheckPropertyExcluded) {
        expect(this.accessoryMock.isPropertyExcluded)
          .toBeCalledWith(mapping.topLevelProperty);
      }
  
      if (mapping.characteristic !== undefined) {
        expect(this.serviceMock.getCharacteristic)
          .toBeCalledWith(mapping.characteristic);
      
        expect(this.serviceMock.addCharacteristic)
          .toBeCalledWith(mapping.characteristic);
      
        if (mapping.doExpectSet && mapping.mock !== undefined) {
          expect(mapping.mock.on)
            .toHaveBeenCalledTimes(1)
            .toHaveBeenCalledWith(CharacteristicEventTypes.SET, expect.anything());

          // Store set callback for future tests
          mapping.setFunction = mapping.mock.on.mock.calls[0][1] as HomebridgeCharacteristicSetCallback;
        }
      }
    }
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

  checkSingleUpdateState(json: string, characteristic: WithUUID<{new (): Characteristic}> | string, value: CharacteristicValue) {
    const map = new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>();
    map.set(characteristic, value);
    this.checkUpdateState(json, map);
  }

  checkUpdateStateIsIgnored(json: string) {
    this.checkUpdateState(json, new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>());
  }

  checkUpdateState(json: string, expectedUpdates: Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>) {
    const state = JSON.parse(json);

    expect(this.serviceHandler).toBeDefined();
    this.serviceHandler?.updateState(state);

    this.checkCharacteristicUpdates(expectedUpdates);
  }

  checkCharacteristicUpdates(expectedUpdates: Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>) {
    expect(this.serviceMock.updateCharacteristic)
      .toBeCalledTimes(expectedUpdates.size);

    for (const [characteristic, value] of expectedUpdates) {
      expect(this.serviceMock.updateCharacteristic)
        .toBeCalledWith(characteristic, value);
    }
  }

  checkNoCharacteristicUpdates() {
    expect(this.serviceMock.updateCharacteristic)
      .not.toBeCalled();
  }

  checkHomeKitUpdateWithSingleValue(identifier: string, setValue: CharacteristicValue, value: unknown,
    property: string | undefined = undefined) {
    if (property === undefined) {
      property = identifier;
    }
    const data = {};
    data[property] = value;
    this.checkHomeKitUpdate(identifier, setValue, data);
  }

  callAndCheckHomeKitSetCallback(identifier: string, setValue: CharacteristicValue) {
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

  checkHomeKitUpdate(identifier: string, setValue: CharacteristicValue, expectedData: unknown) {
    this.callAndCheckHomeKitSetCallback(identifier, setValue);
    this.checkSetDataQueued(expectedData);
  }

  clearMocks(): void {
    mockClear(this.accessoryMock);
    mockClear(this.serviceMock);
    for (const mapping of this.characteristics.values()) {
      if (mapping.mock !== undefined) {
        mockClear(mapping.mock);
      }
    }
  }

}