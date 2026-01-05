import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from '@homebridge/hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';

describe('Climate', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Immax 07703L radiator valve', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('immax/07703l.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness
          .getOrAddHandler(hap.Service.Thermostat)
          .addExpectedCharacteristic('current_heating_setpoint', hap.Characteristic.TargetTemperature, true)
          .addExpectedCharacteristic('local_temperature', hap.Characteristic.CurrentTemperature)
          .addExpectedCharacteristic('system_mode', hap.Characteristic.TargetHeatingCoolingState, true)
          .addExpectedCharacteristic('running_state', hap.Characteristic.CurrentHeatingCoolingState)
          .addExpectedCharacteristic('unit', hap.Characteristic.TemperatureDisplayUnits);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();
        newHarness.checkExpectedGetableKeys([]);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: Local Temperature', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"local_temperature":19.5}', hap.Service.Thermostat, hap.Characteristic.CurrentTemperature, 19.5);
    });

    test('Status update is handled: Target Temperature', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"current_heating_setpoint":21.5}',
        hap.Service.Thermostat,
        hap.Characteristic.TargetTemperature,
        21.5
      );
    });

    test('Status update is handled: Idle state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"running_state":"idle"}',
        hap.Service.Thermostat,
        hap.Characteristic.CurrentHeatingCoolingState,
        hap.Characteristic.CurrentHeatingCoolingState.OFF
      );
    });

    test('Status update is handled: Heating state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"running_state":"heat"}',
        hap.Service.Thermostat,
        hap.Characteristic.CurrentHeatingCoolingState,
        hap.Characteristic.CurrentHeatingCoolingState.HEAT
      );
    });

    test('Status update is handled: Target Off state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"system_mode":"off"}',
        hap.Service.Thermostat,
        hap.Characteristic.TargetHeatingCoolingState,
        hap.Characteristic.TargetHeatingCoolingState.OFF
      );
    });

    test('Status update is handled: Target Auto state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"system_mode":"auto"}',
        hap.Service.Thermostat,
        hap.Characteristic.TargetHeatingCoolingState,
        hap.Characteristic.TargetHeatingCoolingState.AUTO
      );
    });

    test('Status update is handled: Target Heat state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"system_mode":"heat"}',
        hap.Service.Thermostat,
        hap.Characteristic.TargetHeatingCoolingState,
        hap.Characteristic.TargetHeatingCoolingState.HEAT
      );
    });

    test('HomeKit: Change setpoint', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Thermostat, 'current_heating_setpoint', 19.0, 19.0);
    });

    test('HomeKit: Set to Off mode', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(
        hap.Service.Thermostat,
        'system_mode',
        hap.Characteristic.TargetHeatingCoolingState.OFF,
        'off'
      );
    });

    test('HomeKit: Set to Heat mode', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(
        hap.Service.Thermostat,
        'system_mode',
        hap.Characteristic.TargetHeatingCoolingState.HEAT,
        'heat'
      );
    });

    test('HomeKit: Set to Auto mode', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(
        hap.Service.Thermostat,
        'system_mode',
        hap.Characteristic.TargetHeatingCoolingState.AUTO,
        'auto'
      );
    });
  });
});
