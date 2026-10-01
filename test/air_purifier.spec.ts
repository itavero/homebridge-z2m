import { vi } from 'vitest';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from '@homebridge/hap-nodejs';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';
import { Characteristic, CharacteristicValue, WithUUID } from '@homebridge/hap-nodejs';

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

        // CurrentAirPurifierState: added in handler constructor (not by a property factory)
        // Active: added by FanStateProperty (from fan_state expose)
        // TargetAirPurifierState: added by TargetAirPurifierStateProperty (from fan_mode expose)
        // RotationSpeed: added by RotationSpeedProperty (from fan_speed expose)
        // LockPhysicalControls: added by LockPhysicalControlsProperty (from child_lock expose)
        newHarness
          .getOrAddHandler(hap.Service.AirPurifier)
          .addExpectedCharacteristic('current_state', hap.Characteristic.CurrentAirPurifierState)
          .addExpectedCharacteristic('active', hap.Characteristic.Active, true, 'fan_state')
          .addExpectedCharacteristic('fan_mode', hap.Characteristic.TargetAirPurifierState, true)
          .addExpectedCharacteristic('fan_speed', hap.Characteristic.RotationSpeed, true)
          .addExpectedCharacteristic('child_lock', hap.Characteristic.LockPhysicalControls, true);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();
        // fan_state: access 1 (published only, no GET bit)
        // fan_mode: access 7 (published + set + get)
        // fan_speed: access 5 (published + get, no set)
        // child_lock: access 7 (published + set + get)
        newHarness.checkExpectedGetableKeys(['fan_mode', 'fan_speed', 'child_lock']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    describe('Status update is handled:', () => {
      test('fan_state ON → Active + Purifying Air', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"fan_state": "ON"}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.Active, hap.Characteristic.Active.ACTIVE],
            [hap.Characteristic.CurrentAirPurifierState, hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR],
          ])
        );
      });

      test('fan_state OFF → Inactive', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"fan_state": "OFF"}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.Active, hap.Characteristic.Active.INACTIVE],
            [hap.Characteristic.CurrentAirPurifierState, hap.Characteristic.CurrentAirPurifierState.INACTIVE],
          ])
        );
      });

      test('fan_mode auto → Auto', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"fan_mode": "auto"}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.TargetAirPurifierState, hap.Characteristic.TargetAirPurifierState.AUTO],
          ])
        );
      });

      test('fan_mode off → Manual + Inactive', () => {
        expect(harness).toBeDefined();
        // fan_mode 'off' sets TargetAirPurifierState to MANUAL and also
        // sets Active to INACTIVE and CurrentAirPurifierState to INACTIVE
        harness.checkUpdateState(
          '{"fan_mode": "off"}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.TargetAirPurifierState, hap.Characteristic.TargetAirPurifierState.MANUAL],
            [hap.Characteristic.Active, hap.Characteristic.Active.INACTIVE],
            [hap.Characteristic.CurrentAirPurifierState, hap.Characteristic.CurrentAirPurifierState.INACTIVE],
          ])
        );
      });

      test('fan_mode numeric → Manual', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"fan_mode": "5"}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.TargetAirPurifierState, hap.Characteristic.TargetAirPurifierState.MANUAL],
          ])
        );
      });

      test('fan_speed 5 → 56% (scaled 0-9 to 0-100)', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"fan_speed": 5}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([[hap.Characteristic.RotationSpeed, 56]])
        );
      });

      test('fan_speed 0 → 0%', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"fan_speed": 0}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([[hap.Characteristic.RotationSpeed, 0]])
        );
      });

      test('fan_speed 9 → 100%', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"fan_speed": 9}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([[hap.Characteristic.RotationSpeed, 100]])
        );
      });

      test('child_lock LOCK → Enabled', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"child_lock": "LOCK"}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.LockPhysicalControls, hap.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED],
          ])
        );
      });

      test('child_lock UNLOCK → Disabled', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"child_lock": "UNLOCK"}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.LockPhysicalControls, hap.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED],
          ])
        );
      });

      test('all properties at once', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"fan_state": "ON", "fan_mode": "auto", "fan_speed": 5, "child_lock": "LOCK"}',
          hap.Service.AirPurifier,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.Active, hap.Characteristic.Active.ACTIVE],
            [hap.Characteristic.CurrentAirPurifierState, hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR],
            [hap.Characteristic.TargetAirPurifierState, hap.Characteristic.TargetAirPurifierState.AUTO],
            [hap.Characteristic.RotationSpeed, 56],
            [hap.Characteristic.LockPhysicalControls, hap.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED],
          ])
        );
      });
    });

    describe('HomeKit update is handled:', () => {
      test('Turn on from off → fan_mode: auto (default when no speed set)', () => {
        expect(harness).toBeDefined();
        // In the test mock, getCharacteristic returns undefined (no current speed),
        // so handleSetActive falls back to fan_mode: 'auto'
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.AirPurifier, 'active', hap.Characteristic.Active.ACTIVE, 'auto', 'fan_mode');
      });

      test('Turn off → fan_mode: off', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.AirPurifier, 'active', hap.Characteristic.Active.INACTIVE, 'off', 'fan_mode');
      });

      test('Set target state to Auto → fan_mode: auto', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(
          hap.Service.AirPurifier,
          'fan_mode',
          hap.Characteristic.TargetAirPurifierState.AUTO,
          'auto'
        );
      });

      test('Set rotation speed 56% → fan_mode: 5', () => {
        expect(harness).toBeDefined();
        // 56% → round(0 + (56/100) * 9) = round(5.04) = 5
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.AirPurifier, 'fan_speed', 56, '5', 'fan_mode');
      });

      test('Set rotation speed 100% → fan_mode: 9', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.AirPurifier, 'fan_speed', 100, '9', 'fan_mode');
      });

      test('Set rotation speed 0% → fan_mode: 1 (clamped)', () => {
        expect(harness).toBeDefined();
        // 0% → speed = inputMin (0) → clamped to max(1, 0) = 1
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.AirPurifier, 'fan_speed', 0, '1', 'fan_mode');
      });

      test('Set rotation speed 11% → fan_mode: 1', () => {
        expect(harness).toBeDefined();
        // 11% → round(0 + (11/100) * 9) = round(0.99) = 1
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.AirPurifier, 'fan_speed', 11, '1', 'fan_mode');
      });

      test('Enable child lock → LOCK', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(
          hap.Service.AirPurifier,
          'child_lock',
          hap.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED,
          'LOCK'
        );
      });

      test('Disable child lock → UNLOCK', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(
          hap.Service.AirPurifier,
          'child_lock',
          hap.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED,
          'UNLOCK'
        );
      });
    });
  });
});
