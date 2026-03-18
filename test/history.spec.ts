import * as hapNodeJs from '@homebridge/hap-nodejs';
import { Logger } from 'homebridge';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockClear } from 'vitest-mock-extended';
import { HistoryServiceCreator, HistoryServiceHandler } from '../src/converters/history';
import { BasicAccessory, HistoryService, ServiceHandler } from '../src/converters/interfaces';
import { setHap } from '../src/hap';
import { ExposesEntry } from '../src/z2mModels';
import { loadExposesFromFile } from './testHelpers';

describe('History Service', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockAccessory = (historyServiceResult: HistoryService | undefined = undefined) => {
    const accessoryMock = mock<BasicAccessory>();
    accessoryMock.log = mock<Logger>();
    accessoryMock.displayName = 'Test Device';
    accessoryMock.isServiceHandlerIdKnown.mockReturnValue(false);
    accessoryMock.addFakeGatoHistoryService.mockReturnValue(historyServiceResult);
    return accessoryMock;
  };

  const createMockHistoryService = () => mock<HistoryService>();

  describe('HistoryServiceHandler', () => {
    it('does not call addEntry when no relevant properties are in state', () => {
      const accessoryMock = createMockAccessory();
      const historyService = createMockHistoryService();
      const properties = [{ stateKey: 'temperature', entryKey: 'temp' }];
      const handler = new HistoryServiceHandler(accessoryMock, historyService, properties);

      handler.updateState({ linkquality: 100 });

      expect(historyService.addEntry).not.toHaveBeenCalled();
    });

    it('calls addEntry with temperature when temperature state is received', () => {
      const accessoryMock = createMockAccessory();
      const historyService = createMockHistoryService();
      const properties = [{ stateKey: 'temperature', entryKey: 'temp' }];
      const handler = new HistoryServiceHandler(accessoryMock, historyService, properties);

      handler.updateState({ temperature: 22.5 });

      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      const call = historyService.addEntry.mock.calls[0][0];
      expect(call.temp).toBe(22.5);
      expect(call.time).toBeTypeOf('number');
      expect(call.time).toBeGreaterThan(0);
    });

    it('calls addEntry with humidity when humidity state is received', () => {
      const accessoryMock = createMockAccessory();
      const historyService = createMockHistoryService();
      const properties = [
        { stateKey: 'temperature', entryKey: 'temp' },
        { stateKey: 'humidity', entryKey: 'humidity' },
      ];
      const handler = new HistoryServiceHandler(accessoryMock, historyService, properties);

      handler.updateState({ humidity: 65.0 });

      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      const call = historyService.addEntry.mock.calls[0][0];
      expect(call.humidity).toBe(65.0);
      expect(call.temp).toBeUndefined();
    });

    it('calls addEntry with multiple properties when both are in state', () => {
      const accessoryMock = createMockAccessory();
      const historyService = createMockHistoryService();
      const properties = [
        { stateKey: 'temperature', entryKey: 'temp' },
        { stateKey: 'humidity', entryKey: 'humidity' },
      ];
      const handler = new HistoryServiceHandler(accessoryMock, historyService, properties);

      handler.updateState({ temperature: 21.0, humidity: 60.0 });

      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      const call = historyService.addEntry.mock.calls[0][0];
      expect(call.temp).toBe(21.0);
      expect(call.humidity).toBe(60.0);
    });

    it('applies transform function to property values', () => {
      const accessoryMock = createMockAccessory();
      const historyService = createMockHistoryService();
      const properties = [
        {
          stateKey: 'contact',
          entryKey: 'status',
          transform: (v: unknown) => (v ? 0 : 1),
        },
      ];
      const handler = new HistoryServiceHandler(accessoryMock, historyService, properties);

      // contact=true means closed, fakegato status=0 means closed
      handler.updateState({ contact: true });
      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      expect(historyService.addEntry.mock.calls[0][0].status).toBe(0);

      mockClear(historyService);

      // contact=false means open, fakegato status=1 means open
      handler.updateState({ contact: false });
      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      expect(historyService.addEntry.mock.calls[0][0].status).toBe(1);
    });

    it('has empty getableKeys and mainCharacteristics', () => {
      const accessoryMock = createMockAccessory();
      const historyService = createMockHistoryService();
      const handler = new HistoryServiceHandler(accessoryMock, historyService, []);

      expect(handler.getableKeys).toEqual([]);
      expect(handler.mainCharacteristics).toEqual([]);
    });

    it('has a fixed identifier', () => {
      const accessoryMock = createMockAccessory();
      const historyService = createMockHistoryService();
      const handler = new HistoryServiceHandler(accessoryMock, historyService, []);

      expect(handler.identifier).toBe('FAKEGATO_HISTORY');
    });
  });

  describe('HistoryServiceCreator', () => {
    const creator = new HistoryServiceCreator();

    it('does not register a handler when addFakeGatoHistoryService returns undefined', () => {
      const accessoryMock = createMockAccessory(undefined);
      const exposes: ExposesEntry[] = [{ type: 'numeric', name: 'temperature', property: 'temperature', access: 1 } as ExposesEntry];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.registerServiceHandler).not.toHaveBeenCalled();
    });

    it('does not register a handler when no matching exposes are found', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [{ type: 'text', name: 'action', property: 'action', access: 1 } as ExposesEntry];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).not.toHaveBeenCalled();
      expect(accessoryMock.registerServiceHandler).not.toHaveBeenCalled();
    });

    it('does not register a handler if already registered', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      accessoryMock.isServiceHandlerIdKnown.mockReturnValue(true);
      const exposes: ExposesEntry[] = [{ type: 'numeric', name: 'temperature', property: 'temperature', access: 1 } as ExposesEntry];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).not.toHaveBeenCalled();
      expect(accessoryMock.registerServiceHandler).not.toHaveBeenCalled();
    });

    it('registers a weather history handler for temperature sensor', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [{ type: 'numeric', name: 'temperature', property: 'temperature', access: 1 } as ExposesEntry];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('weather');
      expect(accessoryMock.registerServiceHandler).toHaveBeenCalledTimes(1);

      const registeredHandler = accessoryMock.registerServiceHandler.mock.calls[0][0] as ServiceHandler;
      expect(registeredHandler.identifier).toBe('FAKEGATO_HISTORY');
    });

    it('registers a weather history handler for humidity sensor', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [{ type: 'numeric', name: 'humidity', property: 'humidity', access: 1 } as ExposesEntry];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('weather');
    });

    it('registers a weather history handler for air pressure sensor', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [{ type: 'numeric', name: 'pressure', property: 'pressure', access: 1 } as ExposesEntry];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('weather');
    });

    it('registers an energy history handler for power sensor', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [{ type: 'numeric', name: 'power', property: 'power', access: 1 } as ExposesEntry];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('energy');
    });

    it('registers an energy history handler when active_power is present', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [{ type: 'numeric', name: 'active_power', property: 'active_power', access: 1 } as ExposesEntry];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('energy');
    });

    it('prefers energy type over weather when both power and temperature are present', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [
        { type: 'numeric', name: 'power', property: 'power', access: 1 } as ExposesEntry,
        { type: 'numeric', name: 'temperature', property: 'temperature', access: 1 } as ExposesEntry,
      ];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('energy');
    });

    it('registers a door history handler for contact sensor', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [
        { type: 'binary', name: 'contact', property: 'contact', value_on: true, value_off: false, access: 1 } as ExposesEntry,
      ];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('door');
    });

    it('registers a motion history handler for occupancy sensor', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [
        { type: 'binary', name: 'occupancy', property: 'occupancy', value_on: true, value_off: false, access: 1 } as ExposesEntry,
      ];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('motion');
    });

    it('registers a motion history handler for presence sensor', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const exposes: ExposesEntry[] = [
        { type: 'binary', name: 'presence', property: 'presence', value_on: true, value_off: false, access: 1 } as ExposesEntry,
      ];

      creator.createServicesFromExposes(accessoryMock, exposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('motion');
    });

    it('registers weather handler with all available weather properties using Aqara WSDCGQ12LM device exposes', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const deviceExposes = loadExposesFromFile('aqara/wsdcgq12lm.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      creator.createServicesFromExposes(accessoryMock, deviceExposes);

      expect(accessoryMock.addFakeGatoHistoryService).toHaveBeenCalledWith('weather');

      const registeredHandler = accessoryMock.registerServiceHandler.mock.calls[0][0] as HistoryServiceHandler;
      expect(registeredHandler).toBeDefined();
      expect(registeredHandler.identifier).toBe('FAKEGATO_HISTORY');

      // Verify handler tracks temp, humidity, and pressure
      registeredHandler.updateState({ temperature: 20.0, humidity: 55.0, pressure: 1013 });
      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      const entry = historyService.addEntry.mock.calls[0][0];
      expect(entry.temp).toBe(20.0);
      expect(entry.humidity).toBe(55.0);
      expect(entry.pressure).toBe(1013);
    });
  });
});
