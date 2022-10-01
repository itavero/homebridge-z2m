import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';
import { Characteristic, CharacteristicValue, WithUUID } from 'homebridge';

describe('Lock', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Danalock V3-BTZB', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('danalock/v3-btzb_v3-btzbe.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness
          .getOrAddHandler(hap.Service.LockMechanism)
          .addExpectedCharacteristic('state', hap.Characteristic.LockTargetState, true)
          .addExpectedCharacteristic('lock_state', hap.Characteristic.LockCurrentState);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys(['state']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: Locked', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"lock_state":"locked","state":"LOCK"}',
        hap.Service.LockMechanism,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.LockTargetState, hap.Characteristic.LockTargetState.SECURED],
          [hap.Characteristic.LockCurrentState, hap.Characteristic.LockCurrentState.SECURED],
        ])
      );
    });

    test('Status update is handled: Unlocked', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"battery":80,"linkquality":18,"lock_state":"unlocked","state":"UNLOCK"}',
        hap.Service.LockMechanism,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.LockTargetState, hap.Characteristic.LockTargetState.UNSECURED],
          [hap.Characteristic.LockCurrentState, hap.Characteristic.LockCurrentState.UNSECURED],
        ])
      );
    });

    test('HomeKit: Lock', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.LockMechanism, 'state', hap.Characteristic.LockTargetState.SECURED, 'LOCK');
    });

    test('HomeKit: Unlock', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.LockMechanism, 'state', hap.Characteristic.LockTargetState.UNSECURED, 'UNLOCK');
    });
  });
});
