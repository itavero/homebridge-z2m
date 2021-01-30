import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlersTestHarness, testJsonDeviceListEntry } from './testHelpers';
import { Characteristic, CharacteristicValue, WithUUID } from 'homebridge';

describe('Lock', () => {
  beforeEach(() => {
    setHap(hapNodeJs);
  });

  describe('Danalock V3-BTZB', () => {
    const deviceModelJson = `{
      "date_code": "03092018u0000u0000u0000u0000u0000u0000u0000u0000",
      "definition": {
        "description": "BT/ZB smartlock",
        "exposes": [
          {
            "features": [
              {
                "access": 7,
                "description": "State of the lock",
                "name": "state",
                "property": "state",
                "type": "binary",
                "value_off": "UNLOCK",
                "value_on": "LOCK"
              },
              {
                "access": 1,
                "description": "Actual state of the lock",
                "name": "lock_state",
                "property": "lock_state",
                "type": "enum",
                "values": [
                  "not_fully_locked",
                  "locked",
                  "unlocked"
                ]
              }
            ],
            "type": "lock"
          },
          {
            "access": 1,
            "description": "Remaining battery in %",
            "name": "battery",
            "property": "battery",
            "type": "numeric",
            "unit": "%",
            "value_max": 100,
            "value_min": 0
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
        "model": "V3-BTZB",
        "vendor": "Danalock"
      },
      "endpoints": {
        "1": {
          "bindings": [
            {
              "cluster": "closuresDoorLock",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00212effff042817",
                "type": "endpoint"
              }
            },
            {
              "cluster": "genPowerCfg",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00212effff042817",
                "type": "endpoint"
              }
            }
          ],
          "clusters": {
            "input": [
              "genBasic",
              "genPowerCfg",
              "genIdentify",
              "genAlarms",
              "genPollCtrl",
              "closuresDoorLock",
              "haDiagnostic"
            ],
            "output": [
              "genTime",
              "genOta",
              "haDiagnostic"
            ]
          },
          "configured_reportings": [
            {
              "attribute": "lockState",
              "cluster": "closuresDoorLock",
              "maximum_report_interval": 3600,
              "minimum_report_interval": 0,
              "reportable_change": 0
            },
            {
              "attribute": "batteryPercentageRemaining",
              "cluster": "genPowerCfg",
              "maximum_report_interval": 62000,
              "minimum_report_interval": 3600,
              "reportable_change": 0
            }
          ]
        }
      },
      "friendly_name": "0x000b57fffe59e37d",
      "ieee_address": "0x000b57fffe59e37d",
      "interview_completed": true,
      "interviewing": false,
      "model_id": "V3-BTZB",
      "network_address": 50408,
      "power_source": "Battery",
      "supported": true,
      "type": "EndDevice"
    }`;

    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Test JSON Device List entry
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];
        expect(deviceExposes?.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness.getOrAddHandler(hap.Service.LockMechanism)
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
      harness.checkUpdateState('{"lock_state":"locked","state":"LOCK"}',
        hap.Service.LockMechanism, new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.LockTargetState, hap.Characteristic.LockTargetState.SECURED],
          [hap.Characteristic.LockCurrentState, hap.Characteristic.LockCurrentState.SECURED],
        ]));
    });

    test('Status update is handled: Unlocked', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"battery":80,"linkquality":18,"lock_state":"unlocked","state":"UNLOCK"}',
        hap.Service.LockMechanism, new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.LockTargetState, hap.Characteristic.LockTargetState.UNSECURED],
          [hap.Characteristic.LockCurrentState, hap.Characteristic.LockCurrentState.UNSECURED],
        ]));
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