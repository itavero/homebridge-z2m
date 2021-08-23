import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlersTestHarness, testJsonDeviceDefinition } from './testHelpers';
import { Characteristic, CharacteristicValue, WithUUID } from 'hap-nodejs';

describe('Air Quality Sensor', () => {
  beforeEach(() => {
    setHap(hapNodeJs);
  });

  describe('lumi.airmonitor.acn01', () => {
    const deviceDefinitionJson = `{
      "description": "Aqara TVOC air quality monitor",
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
          "description": "Measured temperature value",
          "name": "temperature",
          "property": "temperature",
          "type": "numeric",
          "unit": "°C"
        },
        {
          "access": 1,
          "description": "Measured relative humidity",
          "name": "humidity",
          "property": "humidity",
          "type": "numeric",
          "unit": "%"
        },
        {
          "access": 1,
          "description": "Measured VOC value",
          "name": "voc",
          "property": "voc",
          "type": "numeric",
          "unit": "ppb"
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
      "model": "VOCKQJK11LM",
      "supports_ota": false,
      "vendor": "Xiaomi"
    }`;

    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Test JSON Device List entry
        const definition = testJsonDeviceDefinition(deviceDefinitionJson);
        deviceExposes = definition?.exposes ?? [];
        expect(deviceExposes?.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness.getOrAddHandler(hap.Service.AirQualitySensor)
          .addExpectedCharacteristic('voc', hap.Characteristic.VOCDensity)
          .addExpectedCharacteristic('aq', hap.Characteristic.AirQuality, false, undefined, false);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys([]);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: VOC 333 / Excellent', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"voc": 333}', hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 333],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.EXCELLENT],
        ]));
    });

    test('Status update is handled: VOC 1000 / Good', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"voc": 1000}', hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 1000],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.GOOD],
        ]));
    });

    test('Status update is handled: VOC 1000 / Good', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"voc": 1000}', hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 1000],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.GOOD],
        ]));
    });

    test('Status update is handled: VOC 3333 / Fair', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"voc": 3333}', hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 3333],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.FAIR],
        ]));
    });

    test('Status update is handled: VOC 8332 / Inferior', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"voc": 8332}', hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 8332],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.INFERIOR],
        ]));
    });

    test('Status update is handled: VOC 8333 / Poor', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"voc": 8333}', hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 8333],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.POOR],
        ]));
    });
  });
});