import { SoilMoistureSensorHandler } from '../src/converters/basic_sensors/soil_moisture';
import { DrySensorHandler } from '../src/converters/basic_sensors/dry';
import { BasicAccessory } from '../src/converters/interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty, ExposesKnownTypes } from '../src/z2mModels';
import { hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import { setHap } from '../src/hap';
import { Service, Characteristic } from 'homebridge';

describe('Soil Moisture Sensors', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('SoilMoistureSensorHandler', () => {
    let mockAccessory: BasicAccessory;
    let mockService: Service;
    let mockCharacteristic: Characteristic;
    let serviceSpy: jest.SpyInstance;

    beforeEach(() => {
      mockCharacteristic = {
        props: {
          minValue: 0,
          maxValue: 100,
        },
        setProps: jest.fn().mockReturnThis(),
      } as unknown as Characteristic;
      mockService = {
        updateCharacteristic: jest.fn(),
        getCharacteristic: jest.fn().mockReturnValue(mockCharacteristic),
        addCharacteristic: jest.fn().mockReturnValue(mockCharacteristic),
      } as unknown as Service;

      mockAccessory = {
        log: {
          debug: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
        displayName: 'Test Soil Sensor',
        getDefaultServiceDisplayName: jest.fn().mockReturnValue('Test Service'),
        getOrAddService: jest.fn().mockReturnValue(mockService),
        queueDataForSetAction: jest.fn(),
        registerServiceHandler: jest.fn(),
        isServiceHandlerIdKnown: jest.fn().mockReturnValue(false),
        getConverterConfiguration: jest.fn(),
      } as unknown as BasicAccessory;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      serviceSpy = jest.spyOn(hap.Service, 'HumiditySensor').mockImplementation(() => mockService as unknown as any);

      // Mock the characteristic
      (hap.Characteristic as any).CurrentRelativeHumidity = mockCharacteristic; // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should have correct static properties', () => {
      expect(SoilMoistureSensorHandler.exposesName).toBe('soil_moisture');
      expect(SoilMoistureSensorHandler.exposesType).toBe(ExposesKnownTypes.NUMERIC);
    });

    test('should generate correct identifier without endpoint', () => {
      const identifier = SoilMoistureSensorHandler.generateIdentifier(undefined);
      expect(identifier).toBe('soil_' + hap.Service.HumiditySensor.UUID);
    });

    test('should generate correct identifier with endpoint', () => {
      const identifier = SoilMoistureSensorHandler.generateIdentifier('endpoint1');
      expect(identifier).toBe('soil_' + hap.Service.HumiditySensor.UUID + '_endpoint1');
    });

    test('should create handler with correct service', () => {
      const expose: ExposesEntryWithProperty = {
        type: 'numeric',
        name: 'soil_moisture',
        property: 'soil_moisture',
        unit: '%',
        access: 1,
      };

      const handler = new SoilMoistureSensorHandler(expose, [], mockAccessory);

      expect(serviceSpy).toHaveBeenCalledWith(expect.any(String), 'soil');
      expect(mockAccessory.log.debug).toHaveBeenCalledWith(expect.stringContaining('Configuring SoilMoistureSensor'));
      expect(handler.mainCharacteristics).toHaveLength(1);
      expect(handler.identifier).toBe('soil_' + hap.Service.HumiditySensor.UUID);
    });

    test('should handle state updates', () => {
      const expose: ExposesEntryWithProperty = {
        type: 'numeric',
        name: 'soil_moisture',
        property: 'soil_moisture',
        unit: '%',
        access: 1,
      };

      const handler = new SoilMoistureSensorHandler(expose, [], mockAccessory);
      const state = { soil_moisture: 45 };

      handler.updateState(state);

      expect(mockService.updateCharacteristic).toHaveBeenCalledWith(mockCharacteristic, 45);
    });

    test('should have correct getable keys', () => {
      const expose: ExposesEntryWithProperty = {
        type: 'numeric',
        name: 'soil_moisture',
        property: 'soil_moisture',
        unit: '%',
        access: 1, // Read-only
      };

      const handler = new SoilMoistureSensorHandler(expose, [], mockAccessory);
      expect(handler.getableKeys).toEqual([]);
    });

    test('should handle expose with value range', () => {
      const expose: ExposesEntryWithProperty = {
        type: 'numeric',
        name: 'soil_moisture',
        property: 'soil_moisture',
        unit: '%',
        access: 1,
        value_min: 0,
        value_max: 100,
      };

      mockCharacteristic.setProps = jest.fn().mockReturnValue(mockCharacteristic);

      // Create handler to test prop setting
      const handler = new SoilMoistureSensorHandler(expose, [], mockAccessory);
      expect(handler).toBeDefined();

      expect(mockCharacteristic.setProps).toHaveBeenCalledWith({
        minValue: 0,
        maxValue: 100,
        minStep: 1,
      });
    });
  });

  describe('DrySensorHandler', () => {
    let mockAccessory: BasicAccessory;
    let mockService: Service;
    let mockCharacteristic: Characteristic;
    let serviceSpy: jest.SpyInstance;

    beforeEach(() => {
      mockCharacteristic = {
        props: {
          minValue: 0,
          maxValue: 1,
        },
        setProps: jest.fn().mockReturnThis(),
      } as unknown as Characteristic;
      mockService = {
        updateCharacteristic: jest.fn(),
        getCharacteristic: jest.fn().mockReturnValue(mockCharacteristic),
        addCharacteristic: jest.fn().mockReturnValue(mockCharacteristic),
      } as unknown as Service;

      mockAccessory = {
        log: {
          debug: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
        displayName: 'Test Dry Sensor',
        getDefaultServiceDisplayName: jest.fn().mockReturnValue('Test Service'),
        getOrAddService: jest.fn().mockReturnValue(mockService),
        queueDataForSetAction: jest.fn(),
        registerServiceHandler: jest.fn(),
        isServiceHandlerIdKnown: jest.fn().mockReturnValue(false),
        getConverterConfiguration: jest.fn(),
      } as unknown as BasicAccessory;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      serviceSpy = jest.spyOn(hap.Service, 'LeakSensor').mockImplementation(() => mockService as unknown as any);

      // Mock the characteristic
      (hap.Characteristic as any).LeakDetected = mockCharacteristic; // eslint-disable-line @typescript-eslint/no-explicit-any

      // Mock the static properties of LeakDetected characteristic
      (hap.Characteristic.LeakDetected as any).LEAK_DETECTED = 1; // eslint-disable-line @typescript-eslint/no-explicit-any
      (hap.Characteristic.LeakDetected as any).LEAK_NOT_DETECTED = 0; // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should have correct static properties', () => {
      expect(DrySensorHandler.exposesName).toBe('dry');
      expect(DrySensorHandler.exposesType).toBe(ExposesKnownTypes.BINARY);
    });

    test('should generate correct identifier without endpoint', () => {
      const identifier = DrySensorHandler.generateIdentifier(undefined);
      expect(identifier).toBe('dry_' + hap.Service.LeakSensor.UUID);
    });

    test('should generate correct identifier with endpoint', () => {
      const identifier = DrySensorHandler.generateIdentifier('endpoint1');
      expect(identifier).toBe('dry_' + hap.Service.LeakSensor.UUID + '_endpoint1');
    });

    test('should create handler with correct service', () => {
      const expose: ExposesEntryWithBinaryProperty = {
        type: 'binary',
        name: 'dry',
        property: 'dry',
        value_on: true,
        value_off: false,
        access: 1,
      };

      const handler = new DrySensorHandler(expose, [], mockAccessory);

      expect(serviceSpy).toHaveBeenCalledWith(expect.any(String), 'dry');
      expect(mockAccessory.log.debug).toHaveBeenCalledWith(expect.stringContaining('Configuring Dry Sensor (Water Shortage)'));
      expect(handler.identifier).toBe('dry_' + hap.Service.LeakSensor.UUID);
    });

    test('should handle state updates - dry true (water shortage)', () => {
      const expose: ExposesEntryWithBinaryProperty = {
        type: 'binary',
        name: 'dry',
        property: 'dry',
        value_on: true,
        value_off: false,
        access: 1,
      };

      const handler = new DrySensorHandler(expose, [], mockAccessory);
      const state = { dry: true };

      handler.updateState(state);

      expect(mockService.updateCharacteristic).toHaveBeenCalledWith(mockCharacteristic, hap.Characteristic.LeakDetected.LEAK_DETECTED);
    });

    test('should handle state updates - dry false (no water shortage)', () => {
      const expose: ExposesEntryWithBinaryProperty = {
        type: 'binary',
        name: 'dry',
        property: 'dry',
        value_on: true,
        value_off: false,
        access: 1,
      };

      const handler = new DrySensorHandler(expose, [], mockAccessory);
      const state = { dry: false };

      handler.updateState(state);

      expect(mockService.updateCharacteristic).toHaveBeenCalledWith(mockCharacteristic, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED);
    });

    test('should have correct getable keys', () => {
      const expose: ExposesEntryWithBinaryProperty = {
        type: 'binary',
        name: 'dry',
        property: 'dry',
        value_on: true,
        value_off: false,
        access: 1, // Read-only
      };

      const handler = new DrySensorHandler(expose, [], mockAccessory);
      expect(handler.getableKeys).toEqual([]);
    });

    test('should handle custom value_on and value_off', () => {
      const expose: ExposesEntryWithBinaryProperty = {
        type: 'binary',
        name: 'dry',
        property: 'dry',
        value_on: 'DRY',
        value_off: 'WET',
        access: 1,
      };

      const handler = new DrySensorHandler(expose, [], mockAccessory);

      // Test with custom value_on
      handler.updateState({ dry: 'DRY' });
      expect(mockService.updateCharacteristic).toHaveBeenCalledWith(mockCharacteristic, hap.Characteristic.LeakDetected.LEAK_DETECTED);

      // Test with custom value_off
      handler.updateState({ dry: 'WET' });
      expect(mockService.updateCharacteristic).toHaveBeenCalledWith(mockCharacteristic, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED);
    });
  });
});
