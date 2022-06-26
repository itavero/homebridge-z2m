import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlersTestHarness, testJsonDeviceListEntry } from './testHelpers';

describe('Switch', () => {
  beforeAll(() => {
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

    describe('as Switch', () => {
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

    describe('as Outlet', () => {
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
          newHarness.addConverterConfiguration('switch', { type: 'outlet' });
          newHarness.getOrAddHandler(hap.Service.Outlet).addExpectedCharacteristic('state', hap.Characteristic.On, true);
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
        harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Outlet, hap.Characteristic.On, true);
      });

      test('Status update is handled: Off', () => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState('{"state":"OFF"}', hap.Service.Outlet, hap.Characteristic.On, false);
      });

      test('Status update is handled: Toggle', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateStateIsIgnored('{"state":"TOGGLE"}');
      });

      test('HomeKit: Turn On', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Outlet, 'state', true, 'ON');
      });

      test('HomeKit: Turn Off', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Outlet, 'state', false, 'OFF');
      });
    });
  });

  describe('Ubisys S2', () => {
    const deviceModelJson = `{
      "date_code": "20191127-DE-FB0",
      "definition": {
        "description": "Power switch S2",
        "exposes": [
          {
            "endpoint": "l1",
            "features": [
              {
                "access": 7,
                "description": "On/off state of the switch",
                "endpoint": "l1",
                "name": "state",
                "property": "state_l1",
                "type": "binary",
                "value_off": "OFF",
                "value_on": "ON",
                "value_toggle": "TOGGLE"
              }
            ],
            "type": "switch"
          },
          {
            "endpoint": "l2",
            "features": [
              {
                "access": 7,
                "description": "On/off state of the switch",
                "endpoint": "l2",
                "name": "state",
                "property": "state_l2",
                "type": "binary",
                "value_off": "OFF",
                "value_on": "ON",
                "value_toggle": "TOGGLE"
              }
            ],
            "type": "switch"
          },
          {
            "access": 5,
            "description": "Instantaneous measured power",
            "endpoint": "meter",
            "name": "power",
            "property": "power",
            "type": "numeric",
            "unit": "W"
          },
          {
            "access": 1,
            "description": "Triggered action (e.g. a button click)",
            "name": "action",
            "property": "action",
            "type": "enum",
            "values": [
              "toggle_s1",
              "toggle_s2",
              "on_s1",
              "on_s2",
              "off_s1",
              "off_s2",
              "recall_*_s1",
              "recal_*_s2",
              "brightness_move_up_s1",
              "brightness_move_up_s2",
              "brightness_move_down_s1",
              "brightness_move_down_s2",
              "brightness_stop_s1",
              "brightness_stop_s2"
            ]
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
        "model": "S2",
        "supports_ota": true,
        "vendor": "Ubisys"
      },
      "endpoints": {
        "1": {
          "bindings": [
            {
              "cluster": "genOnOff",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00124b0021b7788c",
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
              "genOnOff"
            ],
            "output": []
          },
          "configured_reportings": [
            {
              "attribute": "onOff",
              "cluster": "genOnOff",
              "maximum_report_interval": 300,
              "minimum_report_interval": 0,
              "reportable_change": 0
            }
          ]
        },
        "2": {
          "bindings": [
            {
              "cluster": "genOnOff",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00124b0021b7788c",
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
              "genOnOff"
            ],
            "output": []
          },
          "configured_reportings": [
            {
              "attribute": "onOff",
              "cluster": "genOnOff",
              "maximum_report_interval": 300,
              "minimum_report_interval": 0,
              "reportable_change": 0
            }
          ]
        },
        "3": {
          "bindings": [
            {
              "cluster": "genOnOff",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x001fee00000058d9",
                "type": "endpoint"
              }
            }
          ],
          "clusters": {
            "input": [
              "genBasic",
              "genIdentify"
            ],
            "output": [
              "genScenes",
              "genOnOff",
              "genLevelCtrl"
            ]
          },
          "configured_reportings": []
        },
        "4": {
          "bindings": [
            {
              "cluster": "genOnOff",
              "target": {
                "endpoint": 2,
                "ieee_address": "0x001fee00000058d9",
                "type": "endpoint"
              }
            }
          ],
          "clusters": {
            "input": [
              "genBasic",
              "genIdentify"
            ],
            "output": [
              "genScenes",
              "genOnOff",
              "genLevelCtrl"
            ]
          },
          "configured_reportings": []
        },
        "5": {
          "bindings": [
            {
              "cluster": "seMetering",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00124b0021b7788c",
                "type": "endpoint"
              }
            }
          ],
          "clusters": {
            "input": [
              "genBasic",
              "seMetering",
              "haElectricalMeasurement"
            ],
            "output": []
          },
          "configured_reportings": [
            {
              "attribute": "instantaneousDemand",
              "cluster": "seMetering",
              "maximum_report_interval": 3600,
              "minimum_report_interval": 5,
              "reportable_change": 1
            }
          ]
        },
        "200": {
          "bindings": [],
          "clusters": {
            "input": [],
            "output": []
          },
          "configured_reportings": []
        },
        "232": {
          "bindings": [],
          "clusters": {
            "input": [
              "genBasic",
              "genCommissioning",
              "manuSpecificUbisysDeviceSetup"
            ],
            "output": [
              "genIdentify",
              "genOta"
            ]
          },
          "configured_reportings": []
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
          },
          "configured_reportings": []
        }
      },
      "friendly_name": "KuecheWand",
      "ieee_address": "0x001fee00000058d9",
      "interview_completed": true,
      "interviewing": false,
      "model_id": "S2 (5502)",
      "network_address": 38227,
      "power_source": "Mains (single phase)",
      "supported": true,
      "type": "Router"
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
        newHarness.getOrAddHandler(hap.Service.Switch, 'l1').addExpectedCharacteristic('state_l1', hap.Characteristic.On, true);
        newHarness.getOrAddHandler(hap.Service.Switch, 'l2').addExpectedCharacteristic('state_l2', hap.Characteristic.On, true);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys(['state_l1', 'state_l2']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: On (L1)', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state_l1":"ON"}',
        harness.generateServiceId(hap.Service.Switch, 'l1'), hap.Characteristic.On, true);
    });

    test('Status update is handled: Off (L2)', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state_l2":"OFF"}',
        harness.generateServiceId(hap.Service.Switch, 'l2'), hap.Characteristic.On, false);
    });

    test('Status update is handled: Toggle', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateStateIsIgnored('{"state_l1":"TOGGLE","state_l2":"TOGGLE"}');
    });

    test('HomeKit: Turn On (L1)', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(harness.generateServiceId(hap.Service.Switch, 'l1'), 'state_l1', true, 'ON');
    });

    test('HomeKit: Turn Off (L1)', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(harness.generateServiceId(hap.Service.Switch, 'l1'), 'state_l1', false, 'OFF');
    });

    test('HomeKit: Turn On (L2)', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(harness.generateServiceId(hap.Service.Switch, 'l2'), 'state_l2', true, 'ON');
    });

    test('HomeKit: Turn Off (L2)', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(harness.generateServiceId(hap.Service.Switch, 'l2'), 'state_l2', false, 'OFF');
    });
  });
});