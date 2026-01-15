import { vi } from 'vitest';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from '@homebridge/hap-nodejs';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';
import { Characteristic, CharacteristicValue, WithUUID } from 'homebridge';

const co2DetectionThreshold = 1200;

describe('Carbon Dioxide Sensor', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Titan Products TPZRCO2HT-Z3', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('titan_products/tpzrco2ht-z3.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness
          .getOrAddHandler(hap.Service.CarbonDioxideSensor)
          .addExpectedCharacteristic('co2', hap.Characteristic.CarbonDioxideLevel)
          .addExpectedCharacteristic('detected', hap.Characteristic.CarbonDioxideDetected, undefined, 'co2')
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();
        newHarness.checkExpectedGetableKeys([]);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    describe('Status update', (): void => {
      test('Abnormal CO2 Level', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          `{"co2":${co2DetectionThreshold},"battery_low":false}`,
          hap.Service.CarbonDioxideSensor,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
            [hap.Characteristic.CarbonDioxideDetected, hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL],
            [hap.Characteristic.CarbonDioxideLevel, co2DetectionThreshold],
          ])
        );
      });
      test('Normal CO2 Level', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateState(
          `{"co2":${co2DetectionThreshold - 1},"battery_low":false}`,
          hap.Service.CarbonDioxideSensor,
          new Map<WithUUID<new () => Characteristic> | string, CharacteristicValue>([
            [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
            [hap.Characteristic.CarbonDioxideDetected, hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL],
            [hap.Characteristic.CarbonDioxideLevel, co2DetectionThreshold - 1],
          ])
        );
      });
    });
  });
});
