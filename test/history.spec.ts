import * as hapNodeJs from '@homebridge/hap-nodejs';
import { Logger, Service } from 'homebridge';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock, mockClear } from 'vitest-mock-extended';
import { AirPressureSensorHandler } from '../src/converters/basic_sensors/air_pressure';
import { ContactSensorHandler } from '../src/converters/basic_sensors/contact';
import { HumiditySensorHandler } from '../src/converters/basic_sensors/humidity';
import { MovingSensorHandler } from '../src/converters/basic_sensors/moving';
import { OccupancySensorHandler } from '../src/converters/basic_sensors/occupancy';
import { PresenceSensorHandler } from '../src/converters/basic_sensors/presence';
import { TemperatureSensorHandler } from '../src/converters/basic_sensors/temperature';
import { BasicAccessory, HistoryService } from '../src/converters/interfaces';
import { setHap } from '../src/hap';
import { ExposesEntryWithProperty, ExposesKnownTypes } from '../src/z2mModels';

describe('Sensor history integration', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function createMockHistoryService(): HistoryService & { addEntry: ReturnType<(typeof mock<HistoryService>)['addEntry']> } {
    return mock<HistoryService>();
  }

  function createMockAccessory(historyService?: HistoryService): BasicAccessory & ReturnType<typeof mock<BasicAccessory>> {
    const accessoryMock = mock<BasicAccessory>();
    accessoryMock.log = mock<Logger>();
    accessoryMock.displayName = 'Test Device';
    // Return the real HAP service object so characteristic setup works correctly
    accessoryMock.getOrAddService.mockImplementation((service: Service) => service);
    accessoryMock.isServiceHandlerIdKnown.mockReturnValue(false);
    accessoryMock.getConverterConfiguration.mockReturnValue(undefined);
    accessoryMock.getDefaultServiceDisplayName.mockReturnValue('Test Device');
    accessoryMock.getOrAddHistoryService.mockReturnValue(historyService);
    return accessoryMock;
  }

  function makeNumericExpose(name: string): ExposesEntryWithProperty {
    return { type: ExposesKnownTypes.NUMERIC, name, property: name, access: 1 } as ExposesEntryWithProperty;
  }

  function makeBinaryExpose(name: string): ExposesEntryWithProperty {
    return {
      type: ExposesKnownTypes.BINARY,
      name,
      property: name,
      value_on: true,
      value_off: false,
      access: 1,
    } as ExposesEntryWithProperty;
  }

  describe('TemperatureSensorHandler', () => {
    it('requests a weather history service during construction', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      new TemperatureSensorHandler(makeNumericExpose('temperature'), [], accessoryMock);
      expect(accessoryMock.getOrAddHistoryService).toHaveBeenCalledWith('weather');
    });

    it('adds a history entry with the correct key on updateState', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const handler = new TemperatureSensorHandler(makeNumericExpose('temperature'), [], accessoryMock);

      handler.updateState({ temperature: 22.5 });

      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      const entry = historyService.addEntry.mock.calls[0][0];
      expect(entry.temp).toBe(22.5);
      expect(entry.time).toBeTypeOf('number');
    });

    it('does not add a history entry when temperature is absent from state', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const handler = new TemperatureSensorHandler(makeNumericExpose('temperature'), [], accessoryMock);

      handler.updateState({ linkquality: 100 });

      expect(historyService.addEntry).not.toHaveBeenCalled();
    });

    it('skips history setup when getOrAddHistoryService returns undefined', () => {
      const accessoryMock = createMockAccessory(undefined);
      const handler = new TemperatureSensorHandler(makeNumericExpose('temperature'), [], accessoryMock);

      // Should not throw even without a history service
      handler.updateState({ temperature: 22.5 });
    });

    it('skips history when converter config sets history=false', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      accessoryMock.getConverterConfiguration.mockImplementation((tag: string) => {
        if (tag === 'temperature') {
          return { history: false };
        }
        return undefined;
      });
      const handler = new TemperatureSensorHandler(makeNumericExpose('temperature'), [], accessoryMock);

      handler.updateState({ temperature: 22.5 });

      expect(accessoryMock.getOrAddHistoryService).not.toHaveBeenCalled();
      expect(historyService.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('HumiditySensorHandler', () => {
    it('requests a weather history service and uses the humidity entry key', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const handler = new HumiditySensorHandler(makeNumericExpose('humidity'), [], accessoryMock);

      expect(accessoryMock.getOrAddHistoryService).toHaveBeenCalledWith('weather');

      handler.updateState({ humidity: 65.0 });

      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      expect(historyService.addEntry.mock.calls[0][0].humidity).toBe(65.0);
    });
  });

  describe('AirPressureSensorHandler', () => {
    it('requests a weather history service and uses the pressure entry key', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const handler = new AirPressureSensorHandler(makeNumericExpose('pressure'), [], accessoryMock);

      expect(accessoryMock.getOrAddHistoryService).toHaveBeenCalledWith('weather');

      handler.updateState({ pressure: 1013 });

      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      expect(historyService.addEntry.mock.calls[0][0].pressure).toBe(1013);
    });
  });

  describe('ContactSensorHandler', () => {
    it('requests a door history service and applies inverted boolean transform', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const handler = new ContactSensorHandler(makeBinaryExpose('contact'), [], accessoryMock);

      expect(accessoryMock.getOrAddHistoryService).toHaveBeenCalledWith('door');

      // contact=true means closed → fakegato status=0
      handler.updateState({ contact: true });
      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      expect(historyService.addEntry.mock.calls[0][0].status).toBe(0);

      mockClear(historyService);

      // contact=false means open → fakegato status=1
      handler.updateState({ contact: false });
      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      expect(historyService.addEntry.mock.calls[0][0].status).toBe(1);
    });
  });

  describe('OccupancySensorHandler', () => {
    it('requests a motion history service and applies boolean transform', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      const handler = new OccupancySensorHandler(makeBinaryExpose('occupancy'), [], accessoryMock);

      expect(accessoryMock.getOrAddHistoryService).toHaveBeenCalledWith('motion');

      handler.updateState({ occupancy: true });
      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      expect(historyService.addEntry.mock.calls[0][0].status).toBe(1);

      mockClear(historyService);

      handler.updateState({ occupancy: false });
      expect(historyService.addEntry).toHaveBeenCalledTimes(1);
      expect(historyService.addEntry.mock.calls[0][0].status).toBe(0);
    });
  });

  describe('MovingSensorHandler', () => {
    it('requests a motion history service', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      new MovingSensorHandler(makeBinaryExpose('moving'), [], accessoryMock);

      expect(accessoryMock.getOrAddHistoryService).toHaveBeenCalledWith('motion');
    });
  });

  describe('PresenceSensorHandler', () => {
    it('requests a motion history service', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);
      new PresenceSensorHandler(makeBinaryExpose('presence'), [], accessoryMock);

      expect(accessoryMock.getOrAddHistoryService).toHaveBeenCalledWith('motion');
    });
  });

  describe('getOrAddHistoryService sharing mechanism', () => {
    it('temperature and humidity both call getOrAddHistoryService with the weather type', () => {
      const historyService = createMockHistoryService();
      const accessoryMock = createMockAccessory(historyService);

      new TemperatureSensorHandler(makeNumericExpose('temperature'), [], accessoryMock);
      new HumiditySensorHandler(makeNumericExpose('humidity'), [], accessoryMock);

      // Both converters call getOrAddHistoryService('weather') — the accessory caches the result
      const calls = accessoryMock.getOrAddHistoryService.mock.calls;
      expect(calls.filter((c) => c[0] === 'weather').length).toBe(2);
    });
  });
});
