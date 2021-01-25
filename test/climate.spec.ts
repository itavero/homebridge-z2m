import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlersTestHarness, testJsonDeviceDefinition } from './testHelpers';

describe('Climate', () => {
  beforeEach(() => {
    setHap(hapNodeJs);
  });

  describe('Immax 07703L radiator valve', () => {
    const deviceDefinitionJson = `{
      "description": "Radiator valve",
      "exposes": [
        {
          "access": 1,
          "description": "Indicates if the battery of this device is almost empty",
          "name": "battery_low",
          "property": "battery_low",
          "type": "binary",
          "value_off": false,
          "value_on": true
        },
        {
          "features": [
            {
              "access": 7,
              "description": "Enables/disables physical input on the device",
              "name": "state",
              "property": "child_lock",
              "type": "binary",
              "value_off": "UNLOCK",
              "value_on": "LOCK"
            }
          ],
          "type": "lock"
        },
        {
          "features": [
            {
              "access": 7,
              "description": "Temperature setpoint",
              "name": "current_heating_setpoint",
              "property": "current_heating_setpoint",
              "type": "numeric",
              "unit": "°C",
              "value_max": 35,
              "value_min": 5,
              "value_step": 0.5
            },
            {
              "access": 5,
              "description": "Current temperature measured on the device",
              "name": "local_temperature",
              "property": "local_temperature",
              "type": "numeric",
              "unit": "°C"
            },
            {
              "access": 7,
              "description": "Mode of this device",
              "name": "system_mode",
              "property": "system_mode",
              "type": "enum",
              "values": ["off", "heat", "auto"]
            },
            {
              "access": 5,
              "description": "The current running state",
              "name": "running_state",
              "property": "running_state",
              "type": "enum",
              "values": ["idle", "heat"]
            },
            {
              "access": 7,
              "description": "Away mode",
              "name": "away_mode",
              "property": "away_mode",
              "type": "binary",
              "value_off": "OFF",
              "value_on": "ON"
            }
          ],
          "type": "climate"
        },
        {
          "access": 1,
          "description": "Link quality (signal strength)",
          "name": "linkquality",
          "property": "linkquality",
          "type": "numeric",
          "unit": "lqi",
          "value_max": 255,
          "value_min": 0
        }
      ],
      "model": "07703L",
      "vendor": "Immax"
    }`;

    // Shared "state"
    let deviceExposes : ExposesEntry[] = [];
    let harness : ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Test JSON Device List entry
        const definition = testJsonDeviceDefinition(deviceDefinitionJson);
        deviceExposes = definition?.exposes ?? [];
        expect(deviceExposes?.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness.getOrAddHandler(hap.Service.Thermostat)
          .addExpectedCharacteristic('current_heating_setpoint', hap.Characteristic.TargetTemperature, true)
          .addExpectedCharacteristic('local_temperature', hap.Characteristic.CurrentTemperature)
          .addExpectedCharacteristic('system_mode', hap.Characteristic.TargetHeatingCoolingState, true)
          .addExpectedCharacteristic('running_state', hap.Characteristic.CurrentHeatingCoolingState)
          .addExpectedCharacteristic('unit', hap.Characteristic.TemperatureDisplayUnits, false, undefined, false);
        newHarness.prepareCreationMocks();
        
        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys(['current_heating_setpoint', 'local_temperature', 'system_mode', 'running_state']);
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
      harness.checkSingleUpdateState('{"local_temperature":19.5}', hap.Service.Thermostat,
        hap.Characteristic.CurrentTemperature, 19.5);
    });

    test('Status update is handled: Target Temperature', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"current_heating_setpoint":21.5}', hap.Service.Thermostat,
        hap.Characteristic.TargetTemperature, 21.5);
    });

    test('Status update is handled: Idle state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"running_state":"idle"}', hap.Service.Thermostat,
        hap.Characteristic.CurrentHeatingCoolingState, hap.Characteristic.CurrentHeatingCoolingState.OFF);
    });

    test('Status update is handled: Heating state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"running_state":"heat"}', hap.Service.Thermostat,
        hap.Characteristic.CurrentHeatingCoolingState, hap.Characteristic.CurrentHeatingCoolingState.HEAT);
    });

    test('Status update is handled: Target Off state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"system_mode":"off"}', hap.Service.Thermostat,
        hap.Characteristic.TargetHeatingCoolingState, hap.Characteristic.TargetHeatingCoolingState.OFF);
    });

    test('Status update is handled: Target Auto state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"system_mode":"auto"}', hap.Service.Thermostat,
        hap.Characteristic.TargetHeatingCoolingState, hap.Characteristic.TargetHeatingCoolingState.AUTO);
    });

    test('Status update is handled: Target Heat state', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"system_mode":"heat"}', hap.Service.Thermostat,
        hap.Characteristic.TargetHeatingCoolingState, hap.Characteristic.TargetHeatingCoolingState.HEAT);
    });

    test('HomeKit: Change setpoint', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Thermostat, 'current_heating_setpoint', 19.0, 19.0);
    });

    test('HomeKit: Set to Off mode', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Thermostat, 'system_mode',
        hap.Characteristic.TargetHeatingCoolingState.OFF, 'off');
    });

    test('HomeKit: Set to Heat mode', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Thermostat, 'system_mode',
        hap.Characteristic.TargetHeatingCoolingState.HEAT, 'heat');
    });

    test('HomeKit: Set to Auto mode', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Thermostat, 'system_mode',
        hap.Characteristic.TargetHeatingCoolingState.AUTO, 'auto');
    });
  });
});