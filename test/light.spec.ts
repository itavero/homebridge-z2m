import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from '@homebridge/hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness, testJsonDeviceListEntry } from './testHelpers';

describe('Light', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Hue White and color ambiance Play Lightbar', () => {
    // Use embedded device model JSON to test scenario with only color_xy (no color_hs)
    const deviceModelJson = `{
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
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Test JSON Device List entry
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];

        // Check service creation
        const newHarness = new ServiceHandlersTestHarness();
        // Adaptive Lighting is enabled by default for lights with color_temp
        newHarness.numberOfExpectedControllers = 1;
        const lightbulb = newHarness
          .getOrAddHandler(hap.Service.Lightbulb)
          .addExpectedCharacteristic('state', hap.Characteristic.On, true)
          .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
          .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true)
          .addExpectedPropertyCheck('color')
          .addExpectedCharacteristic('hue', hap.Characteristic.Hue, true)
          .addExpectedCharacteristic('saturation', hap.Characteristic.Saturation, true);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();

        newHarness.checkExpectedGetableKeys(['state', 'color_temp', 'color']);

        // Expect range of color temperature to be configured
        lightbulb.checkCharacteristicPropertiesHaveBeenSet('color_temp', {
          minValue: 150,
          maxValue: 500,
          minStep: 1,
        });
        harness = newHarness;
      }

      harness?.clearMocks();
      const brightnessCharacteristicMock = harness?.getOrAddHandler(hap.Service.Lightbulb).getCharacteristicMock('brightness');
      if (brightnessCharacteristicMock !== undefined) {
        brightnessCharacteristicMock.props.minValue = 0;
        brightnessCharacteristicMock.props.maxValue = 100;
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    describe('Status update is handled:', () => {
      test('State On', () => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Lightbulb, hap.Characteristic.On, true);
      });

      test('State Off', () => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState('{"state":"OFF"}', hap.Service.Lightbulb, hap.Characteristic.On, false);
      });

      test('State Toggle', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateStateIsIgnored('{"state":"TOGGLE"}');
      });

      test('Brightness 0%', () => {
        expect(harness).toBeDefined();
        harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
        harness.checkSingleUpdateState('{"brightness":0}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 0);
      });

      test('Brightness 1% (1/254 from Zigbee)', () => {
        expect(harness).toBeDefined();
        harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
        harness.checkSingleUpdateState('{"brightness":1}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 1);
      });

      test('Brightness 1% (2/254 from Zigbee)', () => {
        expect(harness).toBeDefined();
        harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
        harness.checkSingleUpdateState('{"brightness":2}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 1);
      });

      test('Brightness 50%', () => {
        expect(harness).toBeDefined();
        harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
        harness.checkSingleUpdateState('{"brightness":127}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 50);
      });

      test('Brightness 100%', () => {
        expect(harness).toBeDefined();
        harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
        harness.checkSingleUpdateState('{"brightness":254}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 100);
      });

      test('Color changed to yellow', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          '{"color":{"x":0.44416,"y":0.51657}}',
          hap.Service.Lightbulb,
          new Map([
            [hap.Characteristic.Hue, 60],
            [hap.Characteristic.Saturation, 100],
          ])
        );
      });
    });

    describe('HomeKit:', () => {
      test('Turn On', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', true, 'ON');
      });

      test('Turn Off', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', false, 'OFF');
      });

      test('Brightness to 50%', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 50, 127);
      });

      test('Brightness to 0%', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 0, 0);
      });

      test('Brightness to 100%', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 100, 254);
      });

      test('Change color to red', () => {
        expect(harness).toBeDefined();
        harness
          .getOrAddHandler(hap.Service.Lightbulb)
          .callAndCheckHomeKitSetCallback('hue', 0)
          .callAndCheckHomeKitSetCallback('saturation', 100);
        harness.checkSetDataQueued({ color: { x: 0.70061, y: 0.2993 } });
      });

      test('Change color to green', () => {
        expect(harness).toBeDefined();
        harness
          .getOrAddHandler(hap.Service.Lightbulb)
          .callAndCheckHomeKitSetCallback('hue', 120)
          .callAndCheckHomeKitSetCallback('saturation', 100);
        harness.checkSetDataQueued({ color: { x: 0.17242, y: 0.7468 } });
      });

      test('Change color to blue', () => {
        expect(harness).toBeDefined();
        harness
          .getOrAddHandler(hap.Service.Lightbulb)
          .callAndCheckHomeKitSetCallback('hue', 240)
          .callAndCheckHomeKitSetCallback('saturation', 100);
        harness.checkSetDataQueued({ color: { x: 0.1355, y: 0.03988 } });
      });

      test('Change color to pink', () => {
        expect(harness).toBeDefined();
        harness
          .getOrAddHandler(hap.Service.Lightbulb)
          .callAndCheckHomeKitSetCallback('hue', 300)
          .callAndCheckHomeKitSetCallback('saturation', 100);
        harness.checkSetDataQueued({ color: { x: 0.38547, y: 0.15463 } });
      });

      test('Change color to yellow', () => {
        expect(harness).toBeDefined();
        harness
          .getOrAddHandler(hap.Service.Lightbulb)
          .callAndCheckHomeKitSetCallback('hue', 60)
          .callAndCheckHomeKitSetCallback('saturation', 100);
        harness.checkSetDataQueued({ color: { x: 0.44416, y: 0.51657 } });
      });
    });
  });

  describe('Hue White + Color Play COLOR_MODE (experimental)', () => {
    const deviceModelJson = `{
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
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Test JSON Device List entry
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];

        // Check service creation
        const newHarness = new ServiceHandlersTestHarness();
        // Adaptive Lighting is enabled by default for lights with color_temp
        newHarness.numberOfExpectedControllers = 1;
        const lightbulb = newHarness
          .getOrAddHandler(hap.Service.Lightbulb)
          .addExpectedCharacteristic('state', hap.Characteristic.On, true)
          .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
          .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true)
          .addExpectedPropertyCheck('color')
          .addExpectedCharacteristic('hue', hap.Characteristic.Hue, true)
          .addExpectedCharacteristic('saturation', hap.Characteristic.Saturation, true);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();

        newHarness.checkExpectedGetableKeys(['state', 'color_temp', 'color']);

        // Expect range of color temperature to be configured
        lightbulb.checkCharacteristicPropertiesHaveBeenSet('color_temp', {
          minValue: 150,
          maxValue: 500,
          minStep: 1,
        });
        harness = newHarness;
      }

      harness?.clearMocks();
      const brightnessCharacteristicMock = harness?.getOrAddHandler(hap.Service.Lightbulb).getCharacteristicMock('brightness');
      if (brightnessCharacteristicMock !== undefined) {
        brightnessCharacteristicMock.props.minValue = 0;
        brightnessCharacteristicMock.props.maxValue = 100;
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update: color_mode = color_temp', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"color":{"hue":34,"saturation":77,"x":0.4435,"y":0.4062},"color_mode":"color_temp","color_temp":343,"linkquality":72}',
        hap.Service.Lightbulb,
        new Map([
          [hap.Characteristic.ColorTemperature, 343],
          [hap.Characteristic.Hue, 39],
          [hap.Characteristic.Saturation, 48],
        ])
      );
    });

    test('Status update: color_mode = xy', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"color":{"x":0.44416,"y":0.51657},"color_mode":"xy","color_temp":169,"linkquality":75}',
        hap.Service.Lightbulb,
        new Map([
          [hap.Characteristic.Hue, 60],
          [hap.Characteristic.Saturation, 100],
        ])
      );
    });
  });

  describe('Hue White Single bulb B22 (allow request brightness)', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('philips/8718696449691.json');
        expect(deviceExposes.length).toBeGreaterThan(0);

        // Check service creation
        const newHarness = new ServiceHandlersTestHarness();

        // Enable adaptive lighting to check if it will be ignored (as this device does not have a color temperature)
        newHarness.addConverterConfiguration('light', { request_brightness: true });

        newHarness
          .getOrAddHandler(hap.Service.Lightbulb)
          .addExpectedCharacteristic('state', hap.Characteristic.On, true)
          .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();

        newHarness.checkExpectedGetableKeys(['state', 'brightness']);
        harness = newHarness;
      }

      harness?.clearMocks();
      const brightnessCharacteristicMock = harness?.getOrAddHandler(hap.Service.Lightbulb).getCharacteristicMock('brightness');
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
      harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Lightbulb, hap.Characteristic.On, true);
    });

    test('Status update is handled: State Off', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state":"OFF"}', hap.Service.Lightbulb, hap.Characteristic.On, false);
    });

    test('Status update is handled: State Toggle', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateStateIsIgnored('{"state":"TOGGLE"}');
    });

    test('Status update is handled: Brightness 0%', () => {
      expect(harness).toBeDefined();
      harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":0}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 0);
    });

    test('Status update is handled: Brightness 50%', () => {
      expect(harness).toBeDefined();
      harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":127}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 50);
    });

    test('Status update is handled: Brightness 100%', () => {
      expect(harness).toBeDefined();
      harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":254}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 100);
    });

    test('HomeKit: Turn On', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', true, 'ON');
    });

    test('HomeKit: Turn Off', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', false, 'OFF');
    });

    test('HomeKit: Brightness to 50%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 50, 127);
    });

    test('HomeKit: Brightness to 0%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 0, 0);
    });

    test('HomeKit: Brightness to 100%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 100, 254);
    });
  });

  describe('OSRAM Lightify LED CLA60 E27 RGBW', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('osram/ac03645.json');
        expect(deviceExposes.length).toBeGreaterThan(0);

        // Check service creation
        const newHarness = new ServiceHandlersTestHarness();
        // Adaptive Lighting is enabled by default for lights with color_temp
        newHarness.numberOfExpectedControllers = 1;
        const lightbulb = newHarness
          .getOrAddHandler(hap.Service.Lightbulb)
          .addExpectedCharacteristic('state', hap.Characteristic.On, true)
          .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
          .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true)
          .addExpectedPropertyCheck('color')
          .addExpectedCharacteristic('hue', hap.Characteristic.Hue, true)
          .addExpectedCharacteristic('saturation', hap.Characteristic.Saturation, true);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();

        newHarness.checkExpectedGetableKeys(['state', 'color_temp', 'color']);

        // Expect range of color temperature to be configured
        lightbulb.checkCharacteristicPropertiesHaveBeenSet('color_temp', {
          minValue: 153,
          maxValue: 526,
          minStep: 1,
        });
        harness = newHarness;
      }

      harness?.clearMocks();
      const brightnessCharacteristicMock = harness?.getOrAddHandler(hap.Service.Lightbulb).getCharacteristicMock('brightness');
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
      harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Lightbulb, hap.Characteristic.On, true);
    });

    test('Status update is handled: State Off', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state":"OFF"}', hap.Service.Lightbulb, hap.Characteristic.On, false);
    });

    test('Status update is handled: State Toggle', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateStateIsIgnored('{"state":"TOGGLE"}');
    });

    test('Status update is handled: Brightness 0%', () => {
      expect(harness).toBeDefined();
      harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":0}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 0);
    });

    test('Status update is handled: Brightness 50%', () => {
      expect(harness).toBeDefined();
      harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":127}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 50);
    });

    test('Status update is handled: Brightness 100%', () => {
      expect(harness).toBeDefined();
      harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":254}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 100);
    });

    test('Status update is handled: Color changed to yellow', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"color":{"hue":60,"saturation":100}}',
        hap.Service.Lightbulb,
        new Map([
          [hap.Characteristic.Hue, 60],
          [hap.Characteristic.Saturation, 100],
        ])
      );
    });

    test('HomeKit: Turn On', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', true, 'ON');
    });

    test('HomeKit: Turn Off', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', false, 'OFF');
    });

    test('HomeKit: Brightness to 50%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 50, 127);
    });

    test('HomeKit: Brightness to 0%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 0, 0);
    });

    test('HomeKit: Brightness to 100%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 100, 254);
    });

    test('HomeKit: Change color to red', () => {
      expect(harness).toBeDefined();
      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .callAndCheckHomeKitSetCallback('hue', 0)
        .callAndCheckHomeKitSetCallback('saturation', 100);
      harness.checkSetDataQueued({ color: { hue: 0, saturation: 100 } });
    });

    test('HomeKit: Change color to pink', () => {
      expect(harness).toBeDefined();
      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .callAndCheckHomeKitSetCallback('hue', 300)
        .callAndCheckHomeKitSetCallback('saturation', 100);
      harness.checkSetDataQueued({ color: { hue: 300, saturation: 100 } });
    });
  });
  describe('Namron Zigbee Dimmer (Adaptive Lighting ignored)', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('namron/4512700.json');
        expect(deviceExposes.length).toBeGreaterThan(0);

        // Check service creation
        const newHarness = new ServiceHandlersTestHarness();

        // Enable adaptive lighting to check if it will be ignored (as this device does not have a color temperature)
        newHarness.addConverterConfiguration('light', { adaptive_lighting: true });
        newHarness.numberOfExpectedControllers = 0;

        newHarness
          .getOrAddHandler(hap.Service.Lightbulb)
          .addExpectedCharacteristic('state', hap.Characteristic.On, true)
          .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();

        newHarness.checkExpectedGetableKeys(['state']);
        harness = newHarness;
      }

      harness?.clearMocks();
      const brightnessCharacteristicMock = harness?.getOrAddHandler(hap.Service.Lightbulb).getCharacteristicMock('brightness');
      if (brightnessCharacteristicMock !== undefined) {
        brightnessCharacteristicMock.props.minValue = 0;
        brightnessCharacteristicMock.props.maxValue = 100;
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('HomeKit: Turn On', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', true, 'ON');
    });

    test('HomeKit: Turn Off', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', false, 'OFF');
    });
  });

  describe('Innr RB-249-T (Adaptive Lighting turned on)', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
        expect(deviceExposes.length).toBeGreaterThan(0);

        // Check service creation
        const newHarness = new ServiceHandlersTestHarness();
        newHarness.addConverterConfiguration('light', { adaptive_lighting: true });
        newHarness.numberOfExpectedControllers = 1;
        const lightbulb = newHarness
          .getOrAddHandler(hap.Service.Lightbulb)
          .addExpectedCharacteristic('state', hap.Characteristic.On, true)
          .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
          .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();

        newHarness.checkExpectedGetableKeys(['state', 'color_temp']);

        // Expect range of color temperature to be configured
        lightbulb.checkCharacteristicPropertiesHaveBeenSet('color_temp', {
          minValue: 200,
          maxValue: 454,
          minStep: 1,
        });
        harness = newHarness;
      }

      harness?.clearMocks();
      const brightnessCharacteristicMock = harness?.getOrAddHandler(hap.Service.Lightbulb).getCharacteristicMock('brightness');
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
      harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Lightbulb, hap.Characteristic.On, true);
    });

    test('Status update is handled: State Off', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state":"OFF"}', hap.Service.Lightbulb, hap.Characteristic.On, false);
    });

    test('Status update is handled: Brightness 50%', () => {
      expect(harness).toBeDefined();
      harness.getOrAddHandler(hap.Service.Lightbulb).prepareGetCharacteristicMock('brightness');
      harness.checkSingleUpdateState('{"brightness":127}', hap.Service.Lightbulb, hap.Characteristic.Brightness, 50);
    });

    test('HomeKit: Turn On', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', true, 'ON');
    });

    test('HomeKit: Turn Off', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', false, 'OFF');
    });

    test('HomeKit: Brightness to 50%', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'brightness', 50, 127);
    });

    describe('HomeKit: Color Temperature', () => {
      test('Set to 400', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'color_temp', 400, 400);
      });

      test('Set out of bounds (low)', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'color_temp', 199, 200);
      });

      test('Set out of bounds (high)', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'color_temp', 455, 454);
      });
    });
  });

  describe('Adaptive Lighting Controller Cleanup', () => {
    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('removes cached AL controller when disabled and cached characteristics exist', () => {
      // Load a device with brightness and color temperature
      const deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      // AL is disabled in config
      harness.addConverterConfiguration('light', { adaptive_lighting: false });
      // Expect configureController to be called (to claim cached) AND removeController (to clean up)
      harness.numberOfExpectedControllers = 1;
      harness.numberOfExpectedControllerRemovals = 1;

      const lightbulb = harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
        .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);

      // Simulate cached AL characteristics from a previous session
      lightbulb.addCachedCharacteristicUUID(hap.Characteristic.SupportedCharacteristicValueTransitionConfiguration.UUID);

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();
    });

    test('skips removal when no cached AL characteristics exist', () => {
      // Load a device with brightness and color temperature
      const deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      // AL is disabled in config
      harness.addConverterConfiguration('light', { adaptive_lighting: false });
      // No controllers should be configured or removed since there are no cached AL characteristics
      harness.numberOfExpectedControllers = 0;
      harness.numberOfExpectedControllerRemovals = 0;

      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
        .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);

      // No cached AL characteristics - testCharacteristic will return false

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();
    });

    test('does not attempt AL cleanup for lights without color temperature', () => {
      // Load a device with only brightness (no color temperature)
      const deviceExposes = loadExposesFromFile('namron/4512700.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      // AL is disabled in config
      harness.addConverterConfiguration('light', { adaptive_lighting: false });
      // No controllers should be configured or removed since device lacks color temp
      harness.numberOfExpectedControllers = 0;
      harness.numberOfExpectedControllerRemovals = 0;

      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true);

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();
    });

    test('configures AL controller normally when enabled', () => {
      // Load a device with brightness and color temperature
      const deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      // AL is enabled in config
      harness.addConverterConfiguration('light', { adaptive_lighting: true });
      // Controller should be configured but NOT removed
      harness.numberOfExpectedControllers = 1;
      harness.numberOfExpectedControllerRemovals = 0;

      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
        .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();
    });

    test('configures AL controller with object-based config', () => {
      // Load a device with brightness and color temperature
      const deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      // AL with object config including min_delta and transition
      harness.addConverterConfiguration('light', {
        adaptive_lighting: {
          enabled: true,
          only_when_on: true,
          transition: 1,
          min_delta: 10,
        },
      });
      // Controller should be configured
      harness.numberOfExpectedControllers = 1;
      harness.numberOfExpectedControllerRemovals = 0;

      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
        .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();
    });

    test('disables AL with object-based config when enabled is false', () => {
      // Load a device with brightness and color temperature
      const deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      // AL with object config where enabled is false
      harness.addConverterConfiguration('light', {
        adaptive_lighting: {
          enabled: false,
        },
      });
      // No controllers should be configured since enabled is false
      harness.numberOfExpectedControllers = 0;
      harness.numberOfExpectedControllerRemovals = 0;

      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
        .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();
    });

    test.each([
      { name: 'non-boolean enabled', config: { enabled: 'yes' } },
      { name: 'invalid min_delta (zero)', config: { min_delta: 0 } },
      { name: 'invalid min_delta (negative)', config: { min_delta: -5 } },
      { name: 'invalid min_delta (non-number)', config: { min_delta: 'low' } },
      { name: 'non-number transition', config: { transition: 'slow' } },
      { name: 'non-boolean only_when_on', config: { only_when_on: 'yes' } },
    ])('ignores invalid adaptive_lighting config ($name)', ({ config }) => {
      const deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      // Invalid config should be treated as if no config was provided, so AL is enabled by default
      harness.addConverterConfiguration('light', { adaptive_lighting: config });
      harness.numberOfExpectedControllers = 1;
      harness.numberOfExpectedControllerRemovals = 0;

      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
        .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();
    });
  });

  describe('Adaptive Lighting disable based on state', () => {
    let isActiveSpy: jest.SpyInstance;
    let disableSpy: jest.SpyInstance;

    beforeEach(() => {
      // Spy on AdaptiveLightingController prototype methods
      isActiveSpy = jest.spyOn(hap.AdaptiveLightingController.prototype, 'isAdaptiveLightingActive');
      disableSpy = jest.spyOn(hap.AdaptiveLightingController.prototype, 'disableAdaptiveLighting');
    });

    afterEach(() => {
      isActiveSpy.mockRestore();
      disableSpy.mockRestore();
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('disables AL when color mode changes away from color_temp', () => {
      const deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      harness.numberOfExpectedControllers = 1;

      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
        .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();

      // Mock AL as active
      isActiveSpy.mockReturnValue(true);

      // Send state update with color_mode NOT being color_temp (e.g., user switched to color mode)
      harness.checkUpdateStateIsIgnored('{"color_mode":"xy","color":{"x":0.5,"y":0.5}}');

      // Verify disableAdaptiveLighting was called because color mode changed away from color_temp
      expect(disableSpy).toHaveBeenCalled();
    });

    test('does not disable AL when color mode is color_temp and no previous temperature cached', () => {
      const deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      harness.numberOfExpectedControllers = 1;

      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
        .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();

      // Mock AL as active
      isActiveSpy.mockReturnValue(true);

      // Send state update with color_mode being color_temp
      // Since lastAdaptiveLightingTemperature is not set (AL hasn't sent any updates yet),
      // disableAdaptiveLighting should NOT be called
      harness.checkSingleUpdateState(
        '{"color_mode":"color_temp","color_temp":300}',
        hap.Service.Lightbulb,
        hap.Characteristic.ColorTemperature,
        300
      );

      // Verify disableAdaptiveLighting was NOT called
      expect(disableSpy).not.toHaveBeenCalled();
    });

    test('does not check AL disable when AL is not active', () => {
      const deviceExposes = loadExposesFromFile('innr/rb_249_t.json');
      expect(deviceExposes.length).toBeGreaterThan(0);

      const harness = new ServiceHandlersTestHarness();
      harness.numberOfExpectedControllers = 1;

      harness
        .getOrAddHandler(hap.Service.Lightbulb)
        .addExpectedCharacteristic('state', hap.Characteristic.On, true)
        .addExpectedCharacteristic('brightness', hap.Characteristic.Brightness, true)
        .addExpectedCharacteristic('color_temp', hap.Characteristic.ColorTemperature, true);

      harness.prepareCreationMocks();
      harness.callCreators(deviceExposes);
      harness.checkCreationExpectations();

      // Mock AL as NOT active
      isActiveSpy.mockReturnValue(false);

      // Send state update with color_mode NOT being color_temp
      harness.checkUpdateStateIsIgnored('{"color_mode":"xy","color":{"x":0.5,"y":0.5}}');

      // Verify disableAdaptiveLighting was NOT called because AL is not active
      expect(disableSpy).not.toHaveBeenCalled();
    });
  });
});
