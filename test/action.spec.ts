import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { hap, setHap } from '../src/hap';
import { ExposesEntry } from '../src/z2mModels';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlersTestHarness, testJsonDeviceListEntry } from './testHelpers';

describe('Action', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Xiaomi WXKG07LM', () => {
    const deviceModelJson = `{
      "definition": {
        "description": "Aqara D1 double key wireless wall switch",
        "exposes": [
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
            "description": "Triggered action (e.g. a button click)",
            "name": "action",
            "property": "action",
            "type": "enum",
            "values": [
              "left",
              "right",
              "both",
              "left_double",
              "right_double",
              "both_double",
              "left_long",
              "right_long",
              "both_long"
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
        "model": "WXKG07LM",
        "supports_ota": false,
        "vendor": "Xiaomi"
      },
      "endpoints": {
        "1": {
          "bindings": [],
          "clusters": {
            "input": [
              "genBasic",
              "genIdentify",
              "genOta",
              "genMultistateInput"
            ],
            "output": [
              "genBasic",
              "genGroups",
              "genIdentify",
              "genScenes",
              "genOta",
              "genMultistateInput"
            ]
          },
          "configured_reportings": []
        },
        "2": {
          "bindings": [],
          "clusters": {
            "input": [],
            "output": []
          },
          "configured_reportings": []
        },
        "3": {
          "bindings": [],
          "clusters": {
            "input": [],
            "output": []
          },
          "configured_reportings": []
        }
      },
      "friendly_name": "kitchen double rocker",
      "ieee_address": "0x00158d000651a32d",
      "interview_completed": false,
      "interviewing": false,
      "model_id": "lumi.remote.b286acn02",
      "network_address": 64135,
      "power_source": "Battery",
      "supported": true,
      "type": "EndDevice"
    }`;

    // Shared "state"
    const actionProperty = 'action';
    const serviceLabelCharacteristic = 'label';
    let serviceIdLeft = '';
    let serviceIdRight = '';
    let serviceIdBoth = '';
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

        // Expect 3 services (one for each value)
        serviceIdLeft = `${hap.Service.StatelessProgrammableSwitch.UUID}#left`;
        const leftService = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'left', serviceIdLeft)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        serviceIdRight = `${hap.Service.StatelessProgrammableSwitch.UUID}#right`;
        const rightService = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'right', serviceIdRight)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty, false)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        serviceIdBoth = `${hap.Service.StatelessProgrammableSwitch.UUID}#both`;
        const bothService = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'both', serviceIdBoth)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty, false)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys([]);

        // Expect the correct event types to be enabled
        const expectedCharacteristicProps = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          validValues: [
            hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
            hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS,
            hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          ],
        };
        leftService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);
        rightService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);
        bothService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);

        // Expect the correct service label indexes to be set
        bothService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 1);
        leftService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 2);
        rightService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 3);

        // Store harness for future use
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: Left single', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"left"}', serviceIdLeft,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }
    });

    test('Status update is handled: Right double', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"right_double"}', serviceIdRight,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);
      }
    });

    test('Status update is handled: Both long', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"both_long"}', serviceIdBoth,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
      }
    });
  });

  describe('IKEA TRADFRI open/close remote', () => {
    const deviceModelJson = `{
        "date_code": "20190311",
        "definition": {
           "description": "TRADFRI open/close remote",
           "exposes": [
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
                 "description": "Triggered action (e.g. a button click)",
                 "name": "action",
                 "property": "action",
                 "type": "enum",
                 "values": [
                    "close",
                    "open",
                    "stop"
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
           "model": "E1766",
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
                 }
              ],
              "clusters": {
                 "input": [
                    "genBasic",
                    "genPowerCfg",
                    "genIdentify",
                    "genAlarms",
                    "genPollCtrl",
                    "touchlink"
                 ],
                 "output": [
                    "genIdentify",
                    "genGroups",
                    "genOnOff",
                    "genLevelCtrl",
                    "genOta",
                    "closuresWindowCovering",
                    "touchlink"
                 ]
              },
              "configured_reportings": []
           }
        },
        "friendly_name": "remote_livingroom_curtains",
        "ieee_address": "0x086bd7fffe2037f0",
        "interview_completed": true,
        "interviewing": false,
        "model_id": "TRADFRI open/close remote",
        "network_address": 38517,
        "power_source": "Battery",
        "software_build_id": "2.2.010",
        "supported": true,
        "type": "EndDevice"
     }`;

    // Shared "state"
    const actionProperty = 'action';
    const serviceLabelCharacteristic = 'label';
    let serviceIdClose = '';
    let serviceIdOpen = '';
    let serviceIdStop = '';
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

        // Expect 3 services (one for each value)
        serviceIdClose = `${hap.Service.StatelessProgrammableSwitch.UUID}#close`;
        const closeService = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'close', serviceIdClose)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        serviceIdOpen = `${hap.Service.StatelessProgrammableSwitch.UUID}#open`;
        const openService = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'open', serviceIdOpen)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty, false)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        serviceIdStop = `${hap.Service.StatelessProgrammableSwitch.UUID}#stop`;
        const stopService = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'stop', serviceIdStop)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty, false)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys([]);

        // Expect the correct event types to be enabled
        const expectedCharacteristicProps = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          validValues: [hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS],
        };
        closeService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);
        openService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);
        stopService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);

        // Expect the correct service label indexes to be set
        closeService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 1);
        openService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 2);
        stopService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 3);

        // Store harness for future use
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: Close', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"close"}', serviceIdClose,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }
    });

    test('Status update is handled: Open', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"open"}', serviceIdOpen,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }
    });

    test('Status update is handled: Stop', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"stop"}', serviceIdStop,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }
    });

    test('Status update is handled: Empty', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkUpdateStateIsIgnored('{"action":""}');
      }
    });

  });

  describe('Aqara Opple switch 3 bands', () => {
    const deviceModelJson = `{
        "date_code":"20190730",
        "definition":{
          "description":"Aqara Opple switch 3 bands",
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
              "access":1,
              "description":"Triggered action (e.g. a button click)",
              "name":"action",
              "property":"action",
              "type":"enum",
              "values":[
                "button_1_hold",
                "button_1_release",
                "button_2_hold",
                "button_2_release",
                "button_5_single",
                "button_5_double",
                "button_5_triple",
                "button_6_hold",
                "button_6_release",
                "button_2_single",
                "button_2_double",
                "button_2_triple",
                "button_1_single",
                "button_1_double",
                "button_1_triple",
                "button_3_hold",
                "button_3_release",
                "button_3_single",
                "button_3_double",
                "button_3_triple",
                "button_4_hold",
                "button_4_release",
                "button_4_single",
                "button_4_double",
                "button_4_triple",
                "button_5_hold",
                "button_5_release",
                "button_6_single",
                "button_6_double",
                "button_6_triple"
              ]
            },
            {
              "access":7,
              "description":"Operation mode, select command to enable bindings",
              "name":"operation_mode",
              "property":"operation_mode",
              "type":"enum",
              "values":[
                "command",
                "event"
              ]
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
          "model":"WXCJKG13LM",
          "vendor":"Xiaomi"
        },
        "endpoints":{
          "1":{
            "bindings":[
              {
                "cluster":"genOnOff",
                "target":{
                  "endpoint":1,
                  "ieee_address":"0x00124b001caa69fb",
                  "type":"endpoint"
                }
              },
              {
                "cluster":"genLevelCtrl",
                "target":{
                  "endpoint":1,
                  "ieee_address":"0x00124b001caa69fb",
                  "type":"endpoint"
                }
              },
              {
                "cluster":"lightingColorCtrl",
                "target":{
                  "endpoint":1,
                  "ieee_address":"0x00124b001caa69fb",
                  "type":"endpoint"
                }
              },
              {
                "cluster":"genPowerCfg",
                "target":{
                  "endpoint":1,
                  "ieee_address":"0x00124b001caa69fb",
                  "type":"endpoint"
                }
              }
            ],
            "clusters":{
              "input":[
                "genBasic",
                "genIdentify",
                "genPowerCfg"
              ],
              "output":[
                "genIdentify",
                "genOnOff",
                "genLevelCtrl",
                "lightingColorCtrl"
              ]
            },
            "configured_reportings":[
              
            ]
          },
          "2":{
            "bindings":[
              
            ],
            "clusters":{
              "input":[
                
              ],
              "output":[
                
              ]
            },
            "configured_reportings":[
              
            ]
          },
          "3":{
            "bindings":[
              
            ],
            "clusters":{
              "input":[
                
              ],
              "output":[
                
              ]
            },
            "configured_reportings":[
              
            ]
          },
          "4":{
            "bindings":[
              
            ],
            "clusters":{
              "input":[
                
              ],
              "output":[
                
              ]
            },
            "configured_reportings":[
              
            ]
          },
          "5":{
            "bindings":[
              
            ],
            "clusters":{
              "input":[
                
              ],
              "output":[
                
              ]
            },
            "configured_reportings":[
              
            ]
          },
          "6":{
            "bindings":[
              
            ],
            "clusters":{
              "input":[
                
              ],
              "output":[
                
              ]
            },
            "configured_reportings":[
              
            ]
          }
        },
        "friendly_name":"remote_livingroom",
        "ieee_address":"0x04cf8cdf3c7d5ee6",
        "interview_completed":true,
        "interviewing":false,
        "model_id":"lumi.remote.b686opcn01",
        "network_address":20793,
        "power_source":"Battery",
        "software_build_id":"2019",
        "supported":true,
        "type":"EndDevice"
      }`;

    // Shared "state"
    const actionProperty = 'action';
    const serviceLabelCharacteristic = 'label';
    let serviceIdButton1 = '';
    let serviceIdButton2 = '';
    let serviceIdButton5 = '';
    let serviceIdButton5E = '';
    let serviceIdButton6 = '';
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

        // For this test set explicit included values (to check that function from the accessory is used correctly)
        newHarness.configureAllowedValues('action', [
          'button_1_hold',
          'button_1_release',
          'button_1_single',
          'button_1_double',
          'button_2_hold',
          'button_2_release',
          'button_2_single',
          'button_5_hold',
          'button_5_release',
          'button_5_triple',
          'button_6_hold',
          'button_6_release',
          'button_6_single',
          'button_6_double']);


        // Expect 4 services (one for each button)
        serviceIdButton1 = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_1`;
        const serviceButton1 = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_1', serviceIdButton1)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        serviceIdButton2 = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_2`;
        const serviceButton2 = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_2', serviceIdButton2)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty, false)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        serviceIdButton5 = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_5`;
        const serviceButton5 = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_5', serviceIdButton5)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty, false)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        serviceIdButton5E = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_5#ext1`;
        const serviceButton5E = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_5#ext1', serviceIdButton5E)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty, false)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        serviceIdButton6 = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_6`;
        const serviceButton6 = newHarness.getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_6', serviceIdButton6)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty, false)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false, undefined, false);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys([]);

        // Expect the correct event types to be enabled
        const allowAllEvents = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          validValues: [
            hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
            hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS,
            hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          ],
        };
        const allowSingleAndLong = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          validValues: [
            hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
            hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          ],
        };
        const allowSingle = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          validValues: [
            hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          ],
        };
        const allowLong = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          validValues: [
            hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          ],
        };
        serviceButton1.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowAllEvents);
        serviceButton2.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowSingleAndLong);
        serviceButton5.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowLong);
        serviceButton5E.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowSingle);
        serviceButton6.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowAllEvents);

        // Expect the correct service label indexes to be set
        serviceButton1.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 10);
        serviceButton2.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 20);
        serviceButton5.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 50);
        serviceButton5E.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 51);
        serviceButton6.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 60);

        // Store harness for future use
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update: button_1_single', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"button_1_single"}', serviceIdButton1,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }
    });

    test('Status update: button_1_double', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"button_1_double"}', serviceIdButton1,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);
      }
    });

    test('Status update: button_1_hold', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"button_1_hold"}', serviceIdButton1,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
      }
    });

    test('Status update: button_1_release (should be ignored)', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkUpdateStateIsIgnored('{"action":"button_1_release"}');
      }
    });

    test('Status update: button_2_single', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"button_2_single"}', serviceIdButton2,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }
    });

    test('Status update is handled: button_2_double (ignored by accessory)', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkUpdateStateIsIgnored('{"action":"button_2_double"}');
      }
    });

    test('Status update: button_2_hold', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"button_2_hold"}', serviceIdButton2,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
      }
    });

    test('Status update: button_5_hold', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"button_5_hold"}', serviceIdButton5,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
      }
    });

    test('Status update: button_5_triple', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"button_5_triple"}', serviceIdButton5E,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }
    });

    test('Status update: button_6_double', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState('{"action":"button_6_double"}', serviceIdButton6,
          hap.Characteristic.ProgrammableSwitchEvent, hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);
      }
    });

    test('Status update is handled: Empty', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkUpdateStateIsIgnored('{"action":""}');
      }
    });
  });
});