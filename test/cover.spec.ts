import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlersTestHarness, testJsonDeviceListEntry } from './testHelpers';

jest.useFakeTimers();

describe('Cover', () => {
  beforeAll(() => {
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
        const windowCovering = newHarness.getOrAddHandler(hap.Service.WindowCovering)
          .addExpectedCharacteristic('position', hap.Characteristic.CurrentPosition, false)
          .addExpectedCharacteristic('target_position', hap.Characteristic.TargetPosition, true, undefined, false)
          .addExpectedCharacteristic('position_state', hap.Characteristic.PositionState, false, undefined, false);
        newHarness.prepareCreationMocks();

        const positionCharacteristicMock = windowCovering.getCharacteristicMock('position');
        if (positionCharacteristicMock !== undefined) {
          positionCharacteristicMock.props.minValue = 0;
          positionCharacteristicMock.props.maxValue = 100;
        }

        const targetPositionCharacteristicMock = windowCovering.getCharacteristicMock('target_position');
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
      harness.checkUpdateState('{"position":100}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 100],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
        [hap.Characteristic.TargetPosition, 100],
      ]));
      harness.clearMocks();
    });

    test('HomeKit: Change target position', () => {
      expect(harness).toBeDefined();

      // Set current position to a known value, to check assumed position state
      harness.checkUpdateState('{"position":50}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 50],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
        [hap.Characteristic.TargetPosition, 50],
      ]));
      harness.clearMocks();

      // Check changing the position to a higher value
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 51, { position: 51 });
      const windowCovering = harness.getOrAddHandler(hap.Service.WindowCovering).checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING],
      ]));
      harness.clearMocks();

      // Receive status update with target position that was previously send.
      // This should be ignored.
      harness.checkUpdateStateIsIgnored('{"position":51}');
      harness.clearMocks();

      // Check changing the position to a lower value
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { position: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING],
      ]));
      harness.clearMocks();

      // Send two updates - should stop timer
      harness.checkUpdateState('{"position":51}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 51],
      ]));
      harness.clearMocks();
      harness.checkUpdateState('{"position":49}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 49],
      ]));
      harness.clearMocks();
      harness.checkUpdateState('{"position":49}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 49],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
        [hap.Characteristic.TargetPosition, 49],
      ]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      windowCovering.checkNoCharacteristicUpdates();
      harness.checkNoGetKeysQueued();

      // Check changing the position to the same value as was last received
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { position: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
      ]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      harness.checkGetKeysQueued('position');
      harness.clearMocks();
    });
  });

  describe('Insta Flush-Mount Blinds Actuator', () => {
    const deviceModelJson = `{
      "date_code": "",
      "definition": {
        "description": "Blinds actor with Lift/Tilt Calibration & with inputs for wall switches",
        "exposes": [
          {
            "features": [
              {
                "access": 3,
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
              },
              {
                "access": 7,
                "description": "Tilt of this cover",
                "name": "tilt",
                "property": "tilt",
                "type": "numeric",
                "value_max": 100,
                "value_min": 0
              }
            ],
            "type": "cover"
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
        "model": "57008000",
        "supports_ota": false,
        "vendor": "Insta GmbH"
      },
      "endpoints": {
        "6": {
          "bindings": [
            {
              "cluster": "genOta",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00212effff06eebd",
                "type": "endpoint"
              }
            },
            {
              "cluster": "closuresWindowCovering",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00212effff06eebd",
                "type": "endpoint"
              }
            },
            {
              "cluster": "genBasic",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00212effff06eebd",
                "type": "endpoint"
              }
            },
            {
              "cluster": "genOnOff",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00212effff06eebd",
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
              "closuresWindowCovering"
            ],
            "output": [
              "genIdentify",
              "genOta"
            ]
          },
          "configured_reportings": [
            {
              "attribute": "currentPositionLiftPercentage",
              "cluster": "closuresWindowCovering",
              "maximum_report_interval": 62000,
              "minimum_report_interval": 1,
              "reportable_change": 1
            }
          ]
        },
        "7": {
          "bindings": [
            {
              "cluster": "genBasic",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00212effff06eebd",
                "type": "endpoint"
              }
            },
            {
              "cluster": "closuresWindowCovering",
              "target": {
                "endpoint": 1,
                "ieee_address": "0x00212effff06eebd",
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
              "genIdentify",
              "genGroups",
              "genOta",
              "closuresWindowCovering"
            ]
          },
          "configured_reportings": []
        },
        "242": {
          "bindings": [],
          "clusters": {
            "input": [],
            "output": [
              "greenPower"
            ]
          },
          "configured_reportings": []
        }
      },
      "friendly_name": "Rollo",
      "ieee_address": "0x842e14fffea1cd5f",
      "interview_completed": true,
      "interviewing": false,
      "model_id": "Generic UP Device",
      "network_address": 22147,
      "power_source": "Mains (single phase)",
      "software_build_id": "00.47.00",
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
        const windowCovering = newHarness.getOrAddHandler(hap.Service.WindowCovering)
          .addExpectedCharacteristic('position', hap.Characteristic.CurrentPosition, false)
          .addExpectedCharacteristic('target_position', hap.Characteristic.TargetPosition, true, undefined, false)
          .addExpectedCharacteristic('position_state', hap.Characteristic.PositionState, false, undefined, false)
          .addExpectedCharacteristic('tilt', hap.Characteristic.CurrentHorizontalTiltAngle, false)
          .addExpectedCharacteristic('target_tilt', hap.Characteristic.TargetHorizontalTiltAngle, true, undefined, false);
        newHarness.prepareCreationMocks();

        const positionCharacteristicMock = windowCovering.getCharacteristicMock('position');
        if (positionCharacteristicMock !== undefined) {
          positionCharacteristicMock.props.minValue = 0;
          positionCharacteristicMock.props.maxValue = 100;
        }

        const targetPositionCharacteristicMock = windowCovering.getCharacteristicMock('target_position');
        if (targetPositionCharacteristicMock !== undefined) {
          targetPositionCharacteristicMock.props.minValue = 0;
          targetPositionCharacteristicMock.props.maxValue = 100;
        }

        const tiltCharacteristicMock = windowCovering.getCharacteristicMock('tilt');
        if (tiltCharacteristicMock !== undefined) {
          tiltCharacteristicMock.props.minValue = -90;
          tiltCharacteristicMock.props.maxValue = 90;
        }

        const targetTiltCharacteristicMock = windowCovering.getCharacteristicMock('target_tilt');
        if (targetTiltCharacteristicMock !== undefined) {
          targetTiltCharacteristicMock.props.minValue = -90;
          targetTiltCharacteristicMock.props.maxValue = 90;
        }

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys(['position', 'tilt']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Check new changed Tilt', () => {
      expect(harness).toBeDefined();

      // Expect CurrentHorizontalTiltAngle to be retrieved to determine range
      harness.getOrAddHandler(hap.Service.WindowCovering).prepareGetCharacteristicMock('tilt');

      // External tilt update 100%
      harness.checkUpdateState('{"position":100, "tilt":100}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 100],
        [hap.Characteristic.CurrentHorizontalTiltAngle, 90],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
        [hap.Characteristic.TargetPosition, 100],
      ]));
      harness.clearMocks();

      // External tilt update 50%
      harness.checkUpdateState('{"position":100, "tilt":50}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 100],
        [hap.Characteristic.CurrentHorizontalTiltAngle, 0],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
        [hap.Characteristic.TargetPosition, 100],
      ]));
      harness.clearMocks();

      // External tilt update 0%
      harness.checkUpdateState('{"position":100, "tilt":0}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 100],
        [hap.Characteristic.CurrentHorizontalTiltAngle, -90],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
        [hap.Characteristic.TargetPosition, 100],
      ]));
    });

    test('HomeKit: Change target tilt', () => {
      expect(harness).toBeDefined();

      // Check changing the tilt to -90°
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_tilt', -90, { tilt: 0 });
      harness.clearMocks();

      // Check changing the tilt to -90°
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_tilt', 0, { tilt: 50 });
      harness.clearMocks();

      // Check changing the tilt to -90°
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_tilt', 90, { tilt: 100 });
      harness.clearMocks();
    });
  });

  describe('Current Products Corp CP180335E-01', () => {
    const deviceModelJson = `{
      "date_code":"",
      "definition":{
        "description":"Gen. 2 hybrid E-Wand",
        "exposes":[
          {
            "access":1,
            "description":"Remaining battery in %",
            "name":"battery",
            "property":"battery",
            "type":"numeric",
            "unit":"%",
            "value_max":100,
            "value_min":0
          },
          {
            "features":[
              {
                "access":3,
                "name":"state",
                "property":"state",
                "type":"enum",
                "values":[
                  "OPEN",
                  "CLOSE",
                  "STOP"
                ]
              },
              {
                "access":7,
                "description":"Tilt of this cover",
                "name":"tilt",
                "property":"tilt",
                "type":"numeric",
                "value_max":100,
                "value_min":0
              }
            ],
            "type":"cover"
          },
          {
            "access":1,
            "description":"Link quality (signal strength)",
            "name":"linkquality",
            "property":"linkquality",
            "type":"numeric",
            "unit":"lqi",
            "value_max":255,
            "value_min":0
          }
        ],
        "model":"CP180335E-01",
        "supports_ota":false,
        "vendor":"Current Products Corp"
      },
      "endpoints":{
        "1":{
          "bindings":[
            {
              "cluster":"genPowerCfg",
              "target":{
                "endpoint":1,
                "ieee_address":"0x00212effff074469",
                "type":"endpoint"
              }
            },
            {
              "cluster":"closuresWindowCovering",
              "target":{
                "endpoint":1,
                "ieee_address":"0x00212effff074469",
                "type":"endpoint"
              }
            }
          ],
          "clusters":{
            "input":[
              "genBasic",
              "genPowerCfg",
              "genIdentify",
              "genGroups",
              "genScenes",
              "genOnOff",
              "genLevelCtrl",
              "genPollCtrl",
              "closuresWindowCovering",
              "haDiagnostic"
            ],
            "output":[
              "genIdentify",
              "genOta"
            ]
          },
          "configured_reportings":[
            {
              "attribute":"batteryPercentageRemaining",
              "cluster":"genPowerCfg",
              "maximum_report_interval":62000,
              "minimum_report_interval":3600,
              "reportable_change":0
            },
            {
              "attribute":"currentPositionTiltPercentage",
              "cluster":"closuresWindowCovering",
              "maximum_report_interval":62000,
              "minimum_report_interval":1,
              "reportable_change":1
            }
          ]
        }
      },
      "friendly_name":"0x847127fffe4cf99c",
      "ieee_address":"0x847127fffe4cf99c",
      "interview_completed":true,
      "interviewing":false,
      "manufacturer":"Current Products Corp",
      "model_id":"E-Wand",
      "network_address":57023,
      "power_source":"Battery",
      "supported":true,
      "type":"EndDevice"
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
        const windowCovering = newHarness.getOrAddHandler(hap.Service.WindowCovering)
          .addExpectedCharacteristic('position', hap.Characteristic.CurrentPosition, false, 'tilt')
          .addExpectedCharacteristic('target_position', hap.Characteristic.TargetPosition, true, undefined, false)
          .addExpectedCharacteristic('position_state', hap.Characteristic.PositionState, false, undefined, false);
        newHarness.prepareCreationMocks();

        const positionCharacteristicMock = windowCovering.getCharacteristicMock('position');
        if (positionCharacteristicMock !== undefined) {
          positionCharacteristicMock.props.minValue = 0;
          positionCharacteristicMock.props.maxValue = 100;
        }

        const targetPositionCharacteristicMock = windowCovering.getCharacteristicMock('target_position');
        if (targetPositionCharacteristicMock !== undefined) {
          targetPositionCharacteristicMock.props.minValue = 0;
          targetPositionCharacteristicMock.props.maxValue = 100;
        }

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
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
      harness.checkUpdateState('{"tilt":100}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 100],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
        [hap.Characteristic.TargetPosition, 100],
      ]));
      harness.clearMocks();
    });

    test('HomeKit: Change target position', () => {
      expect(harness).toBeDefined();

      // Set current position to a known value, to check assumed position state
      harness.checkUpdateState('{"tilt":50}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 50],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
        [hap.Characteristic.TargetPosition, 50],
      ]));
      harness.clearMocks();

      // Check changing the position to a higher value
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 51, { tilt: 51 });
      const windowCovering = harness.getOrAddHandler(hap.Service.WindowCovering).checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING],
      ]));
      harness.clearMocks();

      // Receive status update with target position that was previously send.
      // This should be ignored.
      harness.checkUpdateStateIsIgnored('{"tilt":51}');
      harness.clearMocks();

      // Check changing the position to a lower value
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { tilt: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING],
      ]));
      harness.clearMocks();

      // Send two updates - should stop timer
      harness.checkUpdateState('{"tilt":51}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 51],
      ]));
      harness.clearMocks();
      harness.checkUpdateState('{"tilt":49}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 49],
      ]));
      harness.clearMocks();
      harness.checkUpdateState('{"tilt":49}', hap.Service.WindowCovering, new Map([
        [hap.Characteristic.CurrentPosition, 49],
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
        [hap.Characteristic.TargetPosition, 49],
      ]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      windowCovering.checkNoCharacteristicUpdates();
      harness.checkNoGetKeysQueued();

      // Check changing the position to the same value as was last received
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { tilt: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([
        [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
      ]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      harness.checkGetKeysQueued('tilt');
      harness.clearMocks();
    });
  });

});