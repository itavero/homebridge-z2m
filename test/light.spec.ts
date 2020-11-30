import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlerTestHarness, testJsonDeviceListEntry } from './testHelpers';

describe('Light', () => {
  beforeEach(() => {
    setHap(hapNodeJs);
  });

  describe('Hue White and color ambiance Play Lightbar', () => {
    const deviceModelJson = `
{
  "date_code": "20191218",
  "definition": {
    "description": "Hue White and color ambiance Play Lightbar",
    "exposes": [
      {
        "features": [
          {
            "access": 7,
            "description": "On/off state of this light",
            "name": "state",
            "property": "state",
            "type": "binary",
            "value_off": "OFF",
            "value_on": "ON",
            "value_toggle": "TOGGLE"
          },
          {
            "access": 7,
            "description": "Brightness of this light",
            "name": "brightness",
            "property": "brightness",
            "type": "numeric",
            "value_max": 254,
            "value_min": 0
          },
          {
            "access": 7,
            "description": "Color temperature of this light",
            "name": "color_temp",
            "property": "color_temp",
            "type": "numeric",
            "unit": "mired",
            "value_max": 500,
            "value_min": 150
          },
          {
            "description": "Color of this light in the CIE 1931 color space (x/y)",
            "features": [
              {
                "access": 7,
                "name": "x",
                "property": "x",
                "type": "numeric"
              },
              {
                "access": 7,
                "name": "y",
                "property": "y",
                "type": "numeric"
              }
            ],
            "name": "color_xy",
            "property": "color",
            "type": "composite"
          }
        ],
        "type": "light"
      },
      {
        "access": 2,
        "description": "Triggers an effect on the light (e.g. make light blink for a few seconds)",
        "name": "effect",
        "property": "effect",
        "type": "enum",
        "values": [
          "blink",
          "breathe",
          "okay",
          "channel_change",
          "finish_effect",
          "stop_effect"
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
    "model": "915005733701",
    "vendor": "Philips"
  },
  "endpoints": {
    "11": {
      "bindings": [
        {
          "cluster": "genOnOff",
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
          "touchlink",
          "lightingColorCtrl",
          "manuSpecificLegrandDevices"
        ],
        "output": [
          "genOta"
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
  "friendly_name": "light_officedesk_right",
  "ieee_address": "0x0017880106117ff9",
  "interview_completed": true,
  "interviewing": false,
  "network_address": 46616,
  "power_source": "Mains (single phase)",
  "software_build_id": "1.50.2_r30933",
  "supported": true,
  "type": "Router"
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

        // Check service creation
        const newHarness = new ServiceHandlerTestHarness(hap.Service.Lightbulb);
        newHarness.addExpectedCharacteristic('state', hap.Characteristic.On, true);
        newHarness.addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true);
        newHarness.addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);
        newHarness.addExpectedPropertyCheck('color');
        newHarness.addExpectedCharacteristic('hue', hap.Characteristic.Hue, true, undefined, false);
        newHarness.addExpectedCharacteristic('saturation', hap.Characteristic.Saturation, true, undefined, false);
        newHarness.prepareCreationMocks();
        
        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();

        newHarness.checkExpectedGetableKeys(['state', 'brightness', 'color_temp', 'color']);
        harness = newHarness;
      }

      harness?.clearMocks();
      const brightnessCharacteristicMock = harness?.getCharacteristicMock('brightness');
      if (brightnessCharacteristicMock !== undefined) {
        brightnessCharacteristicMock.props.minValue = 0;
        brightnessCharacteristicMock.props.maxValue = 100;
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: State On', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state":"ON"}', hap.Characteristic.On, true);
    });

    test('Status update is handled: State Off', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state":"OFF"}', hap.Characteristic.On, false);
    });

    test('Status update is handled: State Toggle', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateStateIsIgnored('{"state":"TOGGLE"}');
    });

    test('Status update is handled: Brightness 0%', () => {
      expect(harness).toBeDefined();
      harness.prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":0}',
        hap.Characteristic.Brightness, 0);
    });

    test('Status update is handled: Brightness 50%', () => {
      expect(harness).toBeDefined();
      harness.prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":127}',
        hap.Characteristic.Brightness, 50);
    });

    test('Status update is handled: Brightness 100%', () => {
      expect(harness).toBeDefined();
      harness.prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":254}',
        hap.Characteristic.Brightness, 100);
    });

    test('Status update is handled: Color changed to yellow', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"color":{"x":0.44416,"y":0.51657}}',
        new Map([
          [hap.Characteristic.Hue, 60],
          [hap.Characteristic.Saturation, 100],
        ]),
      );
    });

    test('HomeKit: Turn On', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('state', true, 'ON');
    });

    test('HomeKit: Turn Off', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('state', false, 'OFF');
    });

    test('HomeKit: Brightness to 50%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('brightness', 50, 127);
    });

    test('HomeKit: Brightness to 0%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('brightness', 0, 0);
    });

    test('HomeKit: Brightness to 100%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('brightness', 100, 254);
    });

    test('HomeKit: Change color to red', () => {
      expect(harness).toBeDefined();
      harness.callAndCheckHomeKitSetCallback('hue', 0);
      harness.callAndCheckHomeKitSetCallback('saturation', 100);
      harness.checkSetDataQueued({color: {x: 0.70061, y: 0.2993}});
    });

    test('HomeKit: Change color to green', () => {
      expect(harness).toBeDefined();
      harness.callAndCheckHomeKitSetCallback('hue', 120);
      harness.callAndCheckHomeKitSetCallback('saturation', 100);
      harness.checkSetDataQueued({color: {x: 0.17242, y: 0.7468}});
    });

    test('HomeKit: Change color to blue', () => {
      expect(harness).toBeDefined();
      harness.callAndCheckHomeKitSetCallback('hue', 240);
      harness.callAndCheckHomeKitSetCallback('saturation', 100);
      harness.checkSetDataQueued({color: {x: 0.1355, y: 0.03988}});
    });

    test('HomeKit: Change color to pink', () => {
      expect(harness).toBeDefined();
      harness.callAndCheckHomeKitSetCallback('hue', 300);
      harness.callAndCheckHomeKitSetCallback('saturation', 100);
      harness.checkSetDataQueued({color: {x: 0.38547, y: 0.15463}});
    });

    test('HomeKit: Change color to yellow', () => {
      expect(harness).toBeDefined();
      harness.callAndCheckHomeKitSetCallback('hue', 60);
      harness.callAndCheckHomeKitSetCallback('saturation', 100);
      harness.checkSetDataQueued({color: {x: 0.44416, y: 0.51657}});
    });
  });

  describe('Hue White Single bulb B22', () => {
    const deviceModelJson = `{
      "date_code": "20191218",
      "definition": {
        "description": "Hue White Single bulb B22",
        "exposes": [
          {
            "features": [
              {
                "access": 7,
                "description": "On/off state of this light",
                "name": "state",
                "property": "state",
                "type": "binary",
                "value_off": "OFF",
                "value_on": "ON",
                "value_toggle": "TOGGLE"
              },
              {
                "access": 7,
                "description": "Brightness of this light",
                "name": "brightness",
                "property": "brightness",
                "type": "numeric",
                "value_max": 254,
                "value_min": 0
              }
            ],
            "type": "light"
          },
          {
            "access": 2,
            "description": "Triggers an effect on the light (e.g. make light blink for a few seconds)",
            "name": "effect",
            "property": "effect",
            "type": "enum",
            "values": [
              "blink",
              "breathe",
              "okay",
              "channel_change",
              "finish_effect",
              "stop_effect"
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
        "model": "8718696449691",
        "vendor": "Philips"
      },
      "endpoints": {
        "11": {
          "bindings": [
            {
              "cluster": "genOnOff",
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
              "genOta"
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
      "friendly_name": "light_hobbyroom",
      "ieee_address": "0x00178801033bbc80",
      "interview_completed": true,
      "interviewing": false,
      "network_address": 7179,
      "power_source": "Mains (single phase)",
      "software_build_id": "1.50.2_r30933",
      "supported": true,
      "type": "Router"
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

        // Check service creation
        const newHarness = new ServiceHandlerTestHarness(hap.Service.Lightbulb);
        newHarness.addExpectedCharacteristic('state', hap.Characteristic.On, true);
        newHarness.addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true);
        newHarness.prepareCreationMocks();
        
        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();

        newHarness.checkExpectedGetableKeys(['state', 'brightness']);
        harness = newHarness;
      }

      harness?.clearMocks();
      const brightnessCharacteristicMock = harness?.getCharacteristicMock('brightness');
      if (brightnessCharacteristicMock !== undefined) {
        brightnessCharacteristicMock.props.minValue = 0;
        brightnessCharacteristicMock.props.maxValue = 100;
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: State On', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state":"ON"}', hap.Characteristic.On, true);
    });

    test('Status update is handled: State Off', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state":"OFF"}', hap.Characteristic.On, false);
    });

    test('Status update is handled: State Toggle', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateStateIsIgnored('{"state":"TOGGLE"}');
    });

    test('Status update is handled: Brightness 0%', () => {
      expect(harness).toBeDefined();
      harness.prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":0}',
        hap.Characteristic.Brightness, 0);
    });

    test('Status update is handled: Brightness 50%', () => {
      expect(harness).toBeDefined();
      harness.prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":127}',
        hap.Characteristic.Brightness, 50);
    });

    test('Status update is handled: Brightness 100%', () => {
      expect(harness).toBeDefined();
      harness.prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":254}',
        hap.Characteristic.Brightness, 100);
    });

    test('HomeKit: Turn On', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('state', true, 'ON');
    });

    test('HomeKit: Turn Off', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('state', false, 'OFF');
    });

    test('HomeKit: Brightness to 50%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('brightness', 50, 127);
    });

    test('HomeKit: Brightness to 0%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('brightness', 0, 0);
    });

    test('HomeKit: Brightness to 100%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue('brightness', 100, 254);
    });
  });
});