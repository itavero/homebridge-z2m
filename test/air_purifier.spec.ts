import * as hapNodeJs from '@homebridge/hap-nodejs';
import { vi } from 'vitest';
import { hap, setHap } from '../src/hap';
import { ExposesEntry } from '../src/z2mModels';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';

describe('Air Purifier', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('IKEA STARKVIND E2007', () => {
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      if (deviceExposes.length === 0 && harness === undefined) {
        deviceExposes = loadExposesFromFile('ikea/e2007.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // AirPurifier service
        newHarness
          .getOrAddHandler(hap.Service.AirPurifier)
          .addExpectedCharacteristic('fan_state', hap.Characteristic.Active, true)
          .addExpectedCharacteristic('fan_state_current', hap.Characteristic.CurrentAirPurifierState, false, 'fan_state')
          .addExpectedCharacteristic('fan_mode', hap.Characteristic.TargetAirPurifierState, true)
          .addExpectedCharacteristic('fan_mode_speed', hap.Characteristic.RotationSpeed, true, 'fan_mode');

        // ContactSensor for replace_filter (custom identifier matches ReplaceFilterSensorHandler.generateIdentifier)
        newHarness
          .getOrAddHandler(hap.Service.ContactSensor, 'replace_filter', 'replace_filter_' + hap.Service.ContactSensor.UUID)
          .addExpectedCharacteristic('replace_filter', hap.Characteristic.ContactSensorState);

        newHarness.prepareCreationMocks();
        newHarness.callCreators(deviceExposes);
        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();
        newHarness.checkExpectedGetableKeys(['fan_state']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('Status update: fan ON → Active=ACTIVE + CurrentAirPurifierState=PURIFYING_AIR', () => {
      expect(harness).toBeDefined();
      const expectedUpdates = new Map<typeof hap.Characteristic.Active | typeof hap.Characteristic.CurrentAirPurifierState, number>();
      expectedUpdates.set(hap.Characteristic.Active, hap.Characteristic.Active.ACTIVE);
      expectedUpdates.set(hap.Characteristic.CurrentAirPurifierState, hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
      harness.checkUpdateState('{"fan_state":"ON"}', hap.Service.AirPurifier, expectedUpdates);
    });

    test('Status update: fan OFF → Active=INACTIVE + CurrentAirPurifierState=INACTIVE', () => {
      expect(harness).toBeDefined();
      const expectedUpdates = new Map<typeof hap.Characteristic.Active | typeof hap.Characteristic.CurrentAirPurifierState, number>();
      expectedUpdates.set(hap.Characteristic.Active, hap.Characteristic.Active.INACTIVE);
      expectedUpdates.set(hap.Characteristic.CurrentAirPurifierState, hap.Characteristic.CurrentAirPurifierState.INACTIVE);
      harness.checkUpdateState('{"fan_state":"OFF"}', hap.Service.AirPurifier, expectedUpdates);
    });

    test('Status update: fan_mode "auto" → TargetAirPurifierState=AUTO', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"fan_mode":"auto"}',
        hap.Service.AirPurifier,
        hap.Characteristic.TargetAirPurifierState,
        hap.Characteristic.TargetAirPurifierState.AUTO
      );
    });

    test('Status update: fan_mode "off" → TargetAirPurifierState=MANUAL', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"fan_mode":"off"}',
        hap.Service.AirPurifier,
        hap.Characteristic.TargetAirPurifierState,
        hap.Characteristic.TargetAirPurifierState.MANUAL
      );
    });

    test('Status update: fan_mode "1" → TargetAirPurifierState=MANUAL + RotationSpeed=11', () => {
      expect(harness).toBeDefined();
      const expected = new Map();
      expected.set(hap.Characteristic.TargetAirPurifierState, hap.Characteristic.TargetAirPurifierState.MANUAL);
      expected.set(hap.Characteristic.RotationSpeed, 11);
      harness.checkUpdateState('{"fan_mode":"1"}', hap.Service.AirPurifier, expected);
    });

    test('Status update: fan_mode "9" → TargetAirPurifierState=MANUAL + RotationSpeed=100', () => {
      expect(harness).toBeDefined();
      const expected = new Map();
      expected.set(hap.Characteristic.TargetAirPurifierState, hap.Characteristic.TargetAirPurifierState.MANUAL);
      expected.set(hap.Characteristic.RotationSpeed, 100);
      harness.checkUpdateState('{"fan_mode":"9"}', hap.Service.AirPurifier, expected);
    });

    test('Status update: fan_mode "5" → TargetAirPurifierState=MANUAL + RotationSpeed=56', () => {
      expect(harness).toBeDefined();
      const expected = new Map();
      expected.set(hap.Characteristic.TargetAirPurifierState, hap.Characteristic.TargetAirPurifierState.MANUAL);
      expected.set(hap.Characteristic.RotationSpeed, 56);
      harness.checkUpdateState('{"fan_mode":"5"}', hap.Service.AirPurifier, expected);
    });

    test('Status update: replace_filter true → ContactSensorState=CONTACT_NOT_DETECTED', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"replace_filter":true}',
        'replace_filter_' + hap.Service.ContactSensor.UUID,
        hap.Characteristic.ContactSensorState,
        hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      );
    });

    test('Status update: replace_filter false → ContactSensorState=CONTACT_DETECTED', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"replace_filter":false}',
        'replace_filter_' + hap.Service.ContactSensor.UUID,
        hap.Characteristic.ContactSensorState,
        hap.Characteristic.ContactSensorState.CONTACT_DETECTED
      );
    });

    test('HomeKit: Set Active=ACTIVE → fan_state ON', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.AirPurifier, 'fan_state', hap.Characteristic.Active.ACTIVE, 'ON');
    });

    test('HomeKit: Set Active=INACTIVE → fan_state OFF', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.AirPurifier, 'fan_state', hap.Characteristic.Active.INACTIVE, 'OFF');
    });

    test('HomeKit: Set TargetAirPurifierState=AUTO → fan_mode auto', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(
        hap.Service.AirPurifier,
        'fan_mode',
        hap.Characteristic.TargetAirPurifierState.AUTO,
        'auto'
      );
    });

    test('HomeKit: Set TargetAirPurifierState=MANUAL → restores last known numeric mode', () => {
      expect(harness).toBeDefined();
      // Seed lastManualMode by sending a state update with a known numeric mode
      harness.getOrAddHandler(hap.Service.AirPurifier).serviceHandler?.updateState({ fan_mode: '3' });
      harness.clearMocks();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.AirPurifier, 'fan_mode', hap.Characteristic.TargetAirPurifierState.MANUAL, '3');
    });

    test('HomeKit: Set RotationSpeed=0 → fan_state OFF', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdate(hap.Service.AirPurifier, 'fan_mode_speed', 0, { fan_state: 'OFF' });
    });

    test('HomeKit: Set RotationSpeed=100 → fan_mode "9"', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdate(hap.Service.AirPurifier, 'fan_mode_speed', 100, { fan_mode: '9' });
    });

    test('HomeKit: Set RotationSpeed=50 → fan_mode "5"', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdate(hap.Service.AirPurifier, 'fan_mode_speed', 50, { fan_mode: '5' });
    });

    test('Status update: fan_speed 9 → RotationSpeed=100', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"fan_speed":9}', hap.Service.AirPurifier, hap.Characteristic.RotationSpeed, 100);
    });

    test('Status update: fan_speed 1 → RotationSpeed=11', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"fan_speed":1}', hap.Service.AirPurifier, hap.Characteristic.RotationSpeed, 11);
    });

    test('Status update: fan_speed 5 → RotationSpeed=56', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"fan_speed":5}', hap.Service.AirPurifier, hap.Characteristic.RotationSpeed, 56);
    });

    test('Status update: fan_speed 0 → RotationSpeed=0', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"fan_speed":0}', hap.Service.AirPurifier, hap.Characteristic.RotationSpeed, 0);
    });
  });
});
