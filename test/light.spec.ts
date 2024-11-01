import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness, testJsonDeviceListEntry } from './testHelpers';
import { EXP_COLOR_MODE } from '../src/experimental';

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
        newHarness.addConverterConfiguration('light', { adaptive_lighting: { enabled: false } });
        newHarness.numberOfExpectedControllers = 0;
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

        newHarness.checkExpectedGetableKeys(['state', 'brightness', 'color_temp', 'color']);

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
        newHarness.addConverterConfiguration('light', { adaptive_lighting: false });
        newHarness.numberOfExpectedControllers = 0;
        newHarness.addExperimentalFeatureFlags(EXP_COLOR_MODE);
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

        newHarness.checkExpectedGetableKeys(['state', 'brightness', 'color_temp', 'color']);

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

  describe('Hue White Single bulb B22', () => {
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

        newHarness.checkExpectedGetableKeys(['state', 'brightness', 'color_temp', 'color']);

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

    test('HomeKit: Turn On', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', true, 'ON');
    });

    test('HomeKit: Turn Off', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Lightbulb, 'state', false, 'OFF');
    });
  });

  describe('Innr RB-249-T', () => {
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

        newHarness.checkExpectedGetableKeys(['state', 'brightness', 'color_temp']);

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
});
