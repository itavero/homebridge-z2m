import { vi } from 'vitest';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from '@homebridge/hap-nodejs';
import { ServiceHandlersTestHarness } from './testHelpers';

// Custom Service UUID (from homebridge-3em-energy-meter)
const ELECTRICAL_SERVICE_UUID = '00000001-0000-1777-8000-775D67EC4377';

// Characteristic Names (matching what we use in electrical.ts)
const CHARACTERISTIC_WATT = 'Consumption';
const CHARACTERISTIC_VOLT = 'Voltage';
const CHARACTERISTIC_AMPERE = 'Current';
const CHARACTERISTIC_KWH = 'Total Consumption';
const CHARACTERISTIC_PRODUCED_KWH = 'Total Production';

describe('Electrical Sensors', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Smart plug with power monitoring (power, voltage, current, energy)', () => {
    // Harness is reused across tests for performance; clearMocks() resets state between tests
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      if (harness === undefined) {
        const newHarness = new ServiceHandlersTestHarness();

        // Create exposes for a plug with all electrical properties
        const exposes: ExposesEntry[] = [
          {
            name: 'power',
            access: 1,
            type: 'numeric',
            property: 'power',
            unit: 'W',
          },
          {
            name: 'voltage',
            access: 1,
            type: 'numeric',
            property: 'voltage',
            unit: 'V',
          },
          {
            name: 'current',
            access: 1,
            type: 'numeric',
            property: 'current',
            unit: 'A',
          },
          {
            name: 'energy',
            access: 1,
            type: 'numeric',
            property: 'energy',
            unit: 'kWh',
          },
        ];

        // Register the expected handler
        newHarness.getOrAddHandler(ELECTRICAL_SERVICE_UUID);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(exposes);

        newHarness.checkExpectedGetableKeys(['power', 'voltage', 'current', 'energy']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('Update power', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"power":123.5}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_WATT, 123.5);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"power":0}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_WATT, 0);
    });

    test('Update voltage', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"voltage":230.5}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_VOLT, 230.5);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"voltage":110}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_VOLT, 110);
    });

    test('Update current', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"current":0.537}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_AMPERE, 0.537);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"current":0}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_AMPERE, 0);
    });

    test('Update energy', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"energy":12.345}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_KWH, 12.345);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"energy":0}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_KWH, 0);
    });
  });

  describe('Bidirectional meter with consumed and produced energy', () => {
    // Harness is reused across tests for performance; clearMocks() resets state between tests
    let harness: ServiceHandlersTestHarness;
    const producedEnergySensorId = 'produced_' + ELECTRICAL_SERVICE_UUID;

    beforeEach(() => {
      if (harness === undefined) {
        const newHarness = new ServiceHandlersTestHarness();

        // Create exposes for a bidirectional meter
        const exposes: ExposesEntry[] = [
          {
            name: 'power',
            access: 1,
            type: 'numeric',
            property: 'power',
            unit: 'W',
          },
          {
            name: 'voltage',
            access: 1,
            type: 'numeric',
            property: 'voltage',
            unit: 'V',
          },
          {
            name: 'current',
            access: 1,
            type: 'numeric',
            property: 'current',
            unit: 'A',
          },
          {
            name: 'energy',
            access: 1,
            type: 'numeric',
            property: 'energy',
            unit: 'kWh',
          },
          {
            name: 'produced_energy',
            access: 1,
            type: 'numeric',
            property: 'produced_energy',
            unit: 'kWh',
          },
        ];

        // Register expected handlers
        newHarness.getOrAddHandler(ELECTRICAL_SERVICE_UUID);
        newHarness.getOrAddHandler(ELECTRICAL_SERVICE_UUID, 'produced', producedEnergySensorId);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(exposes);

        newHarness.checkExpectedGetableKeys(['power', 'voltage', 'current', 'energy', 'produced_energy']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('Update consumed energy', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"energy":100.5}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_KWH, 100.5);
    });

    test('Update produced energy', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"produced_energy":50.25}', producedEnergySensorId, CHARACTERISTIC_PRODUCED_KWH, 50.25);
    });
  });

  describe('Multi-endpoint switch with power monitoring', () => {
    // Harness is reused across tests for performance; clearMocks() resets state between tests
    let harness: ServiceHandlersTestHarness;
    const electricalSensorId1 = ELECTRICAL_SERVICE_UUID + '_1';
    const electricalSensorId2 = ELECTRICAL_SERVICE_UUID + '_2';

    beforeEach(() => {
      if (harness === undefined) {
        const newHarness = new ServiceHandlersTestHarness();

        // Create exposes for multi-endpoint device (only electrical properties for simpler test)
        const exposes: ExposesEntry[] = [
          {
            name: 'power',
            access: 1,
            type: 'numeric',
            endpoint: '1',
            property: 'power_1',
            unit: 'W',
          },
          {
            name: 'energy',
            access: 1,
            type: 'numeric',
            endpoint: '1',
            property: 'energy_1',
            unit: 'kWh',
          },
          {
            name: 'power',
            access: 1,
            type: 'numeric',
            endpoint: '2',
            property: 'power_2',
            unit: 'W',
          },
          {
            name: 'energy',
            access: 1,
            type: 'numeric',
            endpoint: '2',
            property: 'energy_2',
            unit: 'kWh',
          },
        ];

        // Register expected handlers for each endpoint
        newHarness.getOrAddHandler(ELECTRICAL_SERVICE_UUID, '1', electricalSensorId1);
        newHarness.getOrAddHandler(ELECTRICAL_SERVICE_UUID, '2', electricalSensorId2);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(exposes);

        newHarness.checkExpectedGetableKeys(['power_1', 'energy_1', 'power_2', 'energy_2']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('Update power on endpoint 1', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"power_1":50}', electricalSensorId1, CHARACTERISTIC_WATT, 50);
    });

    test('Update power on endpoint 2', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"power_2":75}', electricalSensorId2, CHARACTERISTIC_WATT, 75);
    });

    test('Update energy on both endpoints', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"energy_1":10.5}', electricalSensorId1, CHARACTERISTIC_KWH, 10.5, false);
      harness.checkSingleUpdateState('{"energy_2":20.25}', electricalSensorId2, CHARACTERISTIC_KWH, 20.25, false);
    });
  });

  describe('Device with only power expose', () => {
    // Harness is reused across tests for performance; clearMocks() resets state between tests
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      if (harness === undefined) {
        const newHarness = new ServiceHandlersTestHarness();

        // Create minimal device exposes with only power
        const exposes: ExposesEntry[] = [
          {
            name: 'power',
            access: 1,
            type: 'numeric',
            property: 'power',
            unit: 'W',
          },
        ];

        newHarness.getOrAddHandler(ELECTRICAL_SERVICE_UUID);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(exposes);

        newHarness.checkExpectedGetableKeys(['power']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('Update power', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"power":42}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_WATT, 42);
    });
  });

  describe('Device with no electrical exposes', () => {
    test('Should not create electrical sensor for non-electrical device', (): void => {
      const harness = new ServiceHandlersTestHarness();

      // Create device with non-electrical exposes
      const exposes: ExposesEntry[] = [
        {
          name: 'temperature',
          access: 1,
          type: 'numeric',
          property: 'temperature',
          unit: '°C',
        },
        {
          name: 'humidity',
          access: 1,
          type: 'numeric',
          property: 'humidity',
          unit: '%',
        },
      ];

      // Expect temperature and humidity sensors
      harness
        .getOrAddHandler(hap.Service.TemperatureSensor)
        .addExpectedCharacteristic('temperature', hap.Characteristic.CurrentTemperature);
      harness.getOrAddHandler(hap.Service.HumiditySensor).addExpectedCharacteristic('humidity', hap.Characteristic.CurrentRelativeHumidity);

      harness.prepareCreationMocks();

      harness.callCreators(exposes);

      harness.checkCreationExpectations();
    });

    test('Should not create electrical sensor for voltage-only device (e.g., battery voltage)', (): void => {
      const harness = new ServiceHandlersTestHarness();

      // Create device with only voltage (like a door sensor reporting battery voltage)
      const exposes: ExposesEntry[] = [
        {
          name: 'voltage',
          access: 1,
          type: 'numeric',
          property: 'voltage',
          unit: 'V',
        },
        {
          name: 'contact',
          access: 1,
          type: 'binary',
          property: 'contact',
          value_on: true,
          value_off: false,
        },
      ];

      // Expect only contact sensor, no electrical sensor
      harness.getOrAddHandler(hap.Service.ContactSensor).addExpectedCharacteristic('contact', hap.Characteristic.ContactSensorState);

      harness.prepareCreationMocks();

      harness.callCreators(exposes);

      harness.checkCreationExpectations();
    });
  });

  describe('Device with power_outage_memory (should be excluded)', () => {
    // Harness is reused across tests for performance; clearMocks() resets state between tests
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      if (harness === undefined) {
        const newHarness = new ServiceHandlersTestHarness();

        // Create device with power (electrical) and power_outage_memory (non-electrical)
        const exposes: ExposesEntry[] = [
          {
            name: 'power',
            access: 1,
            type: 'numeric',
            property: 'power',
            unit: 'W',
          },
          {
            name: 'power_outage_memory',
            access: 7,
            type: 'enum',
            property: 'power_outage_memory',
            values: ['on', 'off', 'restore'],
          },
        ];

        newHarness.getOrAddHandler(ELECTRICAL_SERVICE_UUID);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(exposes);

        // Only power should be in getable keys, not power_outage_memory
        newHarness.checkExpectedGetableKeys(['power']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('Should only track power property', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"power":100}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_WATT, 100);
    });
  });

  describe('Alternative property names', () => {
    test('Should handle active_power property', (): void => {
      const harness = new ServiceHandlersTestHarness();

      const exposes: ExposesEntry[] = [
        {
          name: 'active_power',
          access: 1,
          type: 'numeric',
          property: 'active_power',
          unit: 'W',
        },
      ];

      harness.getOrAddHandler(ELECTRICAL_SERVICE_UUID);

      harness.prepareCreationMocks();

      harness.callCreators(exposes);

      harness.checkExpectedGetableKeys(['active_power']);
      harness.checkSingleUpdateState('{"active_power":150}', ELECTRICAL_SERVICE_UUID, CHARACTERISTIC_WATT, 150);
    });
  });
});
