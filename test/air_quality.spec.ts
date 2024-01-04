import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';
import { Characteristic, CharacteristicValue, WithUUID } from 'hap-nodejs';

describe('Air Quality Sensor', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('lumi.airmonitor.acn01', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('xiaomi/vockqjk11lm.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness
          .getOrAddHandler(hap.Service.AirQualitySensor)
          .addExpectedCharacteristic('voc', hap.Characteristic.VOCDensity)
          .addExpectedCharacteristic('aq', hap.Characteristic.AirQuality);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();
        newHarness.checkExpectedGetableKeys(['voc']);
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
      harness.checkUpdateState(
        '{"voc": 333}',
        hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 333],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.EXCELLENT],
        ])
      );
    });

    test('Status update is handled: VOC 1000 / Good', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"voc": 1000}',
        hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 1000],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.GOOD],
        ])
      );
    });

    test('Status update is handled: VOC 1000 / Good', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"voc": 1000}',
        hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 1000],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.GOOD],
        ])
      );
    });

    test('Status update is handled: VOC 3333 / Fair', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"voc": 3333}',
        hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 3333],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.FAIR],
        ])
      );
    });

    test('Status update is handled: VOC 8332 / Inferior', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"voc": 8332}',
        hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 8332],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.INFERIOR],
        ])
      );
    });

    test('Status update is handled: VOC 8333 / Poor', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"voc": 8333}',
        hap.Service.AirQualitySensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.VOCDensity, 8333],
          [hap.Characteristic.AirQuality, hap.Characteristic.AirQuality.POOR],
        ])
      );
    });
  });
});
