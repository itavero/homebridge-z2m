import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlerTestHarness, testJsonDeviceListEntry } from './testHelpers';

jest.useFakeTimers();

describe('Cover', () => {
  beforeEach(() => {
    setHap(hapNodeJs);
  });

  describe('IKEA KADRILJ roller blind', () => {
    const deviceModelJson = `{
      "date_code": "20190311",
      "definition": {
        "description": "KADRILJ roller blind",
        "exposes": [
          {
            "features": [
              {
                "access": 7,
                "name": "state",
                "property": "state",
                "type": "binary",
                "value_off": "CLOSE",
                "value_on": "OPEN"
              },
              {
                "access": 7,
                "description": "Position of this cover",
                "name": "position",
                "property": "position",
                "type": "numeric",
                "value_max": 100,
                "value_min": 0
              }
            ],
            "type": "cover"
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
        "model": "E1926",
        "vendor": "IKEA"
      },
      "endpoints": {
        "1": {
          "bindings": [
            {
              "cluster": "genPowerCfg",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00124b001caa69fb",
                "type": "endpoint"
              }
            },
            {
              "cluster": "closuresWindowCovering",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00124b001caa69fb",
                "type": "endpoint"
              }
            }
          ],
          "clusters": {
            "input": [
              "genBasic",
              "genPowerCfg",
              "genIdentify",
              "genGroups",
              "genScenes",
              "genPollCtrl",
              "closuresWindowCovering",
              "touchlink"
            ],
            "output": [
              "genOta",
              "touchlink"
            ]
          }
        }
      },
      "friendly_name": "blinds_livingroom_side",
      "ieee_address": "0x000d6ffffea9430d",
      "interview_completed": true,
      "interviewing": false,
      "network_address": 13941,
      "power_source": "Battery",
      "software_build_id": "2.2.009",
      "supported": true,
      "type": "EndDevice"
    }`;

    // Shared "state"
    let deviceExposes : ExposesEntry[] = [];
    let harness : ServiceHandlerTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Test JSON Device List entry
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];
        expect(deviceExposes?.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlerTestHarness(hap.Service.WindowCovering);

        // Check service creation
        newHarness.addExpectedCharacteristic('position', hap.Characteristic.CurrentPosition, false);
        newHarness.addExpectedCharacteristic('target_position', hap.Characteristic.TargetPosition, true, undefined, false);
        newHarness.addExpectedCharacteristic('position_state', hap.Characteristic.PositionState, false, undefined, false);
        newHarness.prepareCreationMocks();

        const positionCharacteristicMock = newHarness.getCharacteristicMock('position');
        if (positionCharacteristicMock !== undefined) {
          positionCharacteristicMock.props.minValue = 0;
          positionCharacteristicMock.props.maxValue = 100;
        }

        const targetPositionCharacteristicMock = newHarness.getCharacteristicMock('target_position');
        if (targetPositionCharacteristicMock !== undefined) {
          targetPositionCharacteristicMock.props.minValue = 0;
          targetPositionCharacteristicMock.props.maxValue = 100;
        }
        
        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys(['position']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: Position changes', () => {
      expect(harness).toBeDefined();

      // First update (previous state is unknown, so)
      harness.checkUpdateState('{"position":100}', new Map([
        [hap.Characteristic.CurrentPosition, 100],
        [hap.Characteristic.PositionState, expect.anything()],
      ]));
      harness.clearMocks();

      // Second update (lower position -> state considered decreasing)
      harness.checkUpdateState('{"position":88}', new Map([
        [hap.Characteristic.CurrentPosition, 88],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING],
      ]));
      harness.clearMocks();

      // Third update (higher position -> state considered increasing)
      harness.checkUpdateState('{"position":89}', new Map([
        [hap.Characteristic.CurrentPosition, 89],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING],
      ]));
      harness.clearMocks();

      // Fourth update (same position -> state considered stopped)
      harness.checkUpdateState('{"position":89}', new Map([
        [hap.Characteristic.CurrentPosition, 89],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
      ]));
    });

    test('HomeKit: Change target position', () => {
      expect(harness).toBeDefined();

      // Set current position to a known value, to check assumed position state
      harness.checkUpdateState('{"position":50}', new Map([
        [hap.Characteristic.CurrentPosition, 50],
        [hap.Characteristic.PositionState, expect.anything()],
      ]));
      harness.clearMocks();

      // Check changing the position to a higher value
      harness.checkHomeKitUpdate('target_position', 51, { position: 51 });
      harness.checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING],
      ]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runTimersToTime(2000);
      harness.checkGetKeysQueued('position');
      harness.clearMocks();

      // Check timer - should update state to stopped and stop timer
      jest.runOnlyPendingTimers();
      harness.checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
      ]));
      harness.clearMocks();

      // Trigger timers again: should not do anything
      jest.runOnlyPendingTimers();
      harness.checkNoCharacteristicUpdates();
      harness.checkNoGetKeysQueued();

      // Check changing the position to a lower value
      harness.checkHomeKitUpdate('target_position', 49, { position: 49 });
      harness.checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING],
      ]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      harness.checkNoCharacteristicUpdates();
      harness.checkGetKeysQueued('position');
      harness.clearMocks();

      // Send two updates - should stop timer
      harness.checkUpdateState('{"position":49}', new Map([
        [hap.Characteristic.CurrentPosition, 49],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING],
      ]));
      harness.clearMocks();
      harness.checkUpdateState('{"position":49}', new Map([
        [hap.Characteristic.CurrentPosition, 49],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
      ]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      harness.checkNoCharacteristicUpdates();
      harness.checkNoGetKeysQueued();

      // Check changing the position to the same value as was last received
      harness.checkHomeKitUpdate('target_position', 49, { position: 49 });
      harness.checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
      ]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      harness.checkGetKeysQueued('position');
      harness.clearMocks();
    });
  });
});