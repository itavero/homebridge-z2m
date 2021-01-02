import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlersTestHarness, testJsonDeviceListEntry } from './testHelpers';

describe('Switch', () => {
  beforeEach(() => {
    setHap(hapNodeJs);
  });

  describe('IKEA TRADFRI control outlet', () => {
    const deviceModelJson = `
    {
      "date_code": "20191026",
      "definition": {
        "description": "TRADFRI control outlet",
        "exposes": [
          {
            "features": [
              {
                "access": 7,
                "description": "On/off state of the switch",
                "name": "state",
                "property": "state",
                "type": "binary",
                "value_off": "OFF",
                "value_on": "ON",
                "value_toggle": "TOGGLE"
              }
            ],
            "type": "switch"
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
        "model": "E1603/E1702",
        "vendor": "IKEA"
      },
      "endpoints": {
        "1": {
          "bindings": [
            {
              "cluster": "genOnOff",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00124b001caa69fb",
                "type": "endpoint"
              }
            },
            {
              "cluster": "genLevelCtrl",
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
              "genIdentify",
              "genGroups",
              "genScenes",
              "genOnOff",
              "genLevelCtrl",
              "touchlink"
            ],
            "output": [
              "genScenes",
              "genOta",
              "genPollCtrl",
              "touchlink"
            ]
          }
        },
        "242": {
          "bindings": [],
          "clusters": {
            "input": [
              "greenPower"
            ],
            "output": [
              "greenPower"
            ]
          }
        }
      },
      "friendly_name": "light_livingroom_sjopenna",
      "ieee_address": "0x000d6ffffeb82582",
      "interview_completed": true,
      "interviewing": false,
      "network_address": 16527,
      "power_source": "Mains (single phase)",
      "software_build_id": "2.0.024",
      "supported": true,
      "type": "Router"
    }`;

    // Shared "state"
    let deviceExposes : ExposesEntry[] = [];
    let harness : ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Test JSON Device List entry
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];
        expect(deviceExposes?.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness.getOrAddHandler(hap.Service.Switch).addExpectedCharacteristic('state', hap.Characteristic.On, true);
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

    test('Status update is handled: On', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Switch, hap.Characteristic.On, true);
    });

    test('Status update is handled: Off', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state":"OFF"}', hap.Service.Switch, hap.Characteristic.On, false);
    });

    test('Status update is handled: Toggle', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateStateIsIgnored('{"state":"TOGGLE"}');
    });

    test('HomeKit: Turn On', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Switch, 'state', true, 'ON');
    });

    test('HomeKit: Turn Off', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Switch, 'state', false, 'OFF');
    });
  });
});