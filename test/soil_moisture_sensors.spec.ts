import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';

describe('Soil Moisture Sensors', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Soil Moisture, Dry, and Light Sensor', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;
    let soilMoistureSensorId: string;
    let drySensorId: string;
    let lightSensorId: string;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('_manual/soil_moisture_sensor.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        soilMoistureSensorId = 'soil_' + hap.Service.HumiditySensor.UUID;
        drySensorId = 'dry_' + hap.Service.ContactSensor.UUID;
        lightSensorId = hap.Service.LightSensor.UUID;

        newHarness
          .getOrAddHandler(hap.Service.HumiditySensor, 'soil', soilMoistureSensorId)
          .addExpectedCharacteristic('soil_moisture', hap.Characteristic.CurrentRelativeHumidity);
        newHarness
          .getOrAddHandler(hap.Service.ContactSensor, 'dry', drySensorId)
          .addExpectedCharacteristic('dry', hap.Characteristic.ContactSensorState);
        newHarness
          .getOrAddHandler(hap.Service.LightSensor, undefined, lightSensorId)
          .addExpectedCharacteristic('illuminance', hap.Characteristic.CurrentAmbientLightLevel);

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
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Update soil moisture', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"soil_moisture":45}', soilMoistureSensorId, hap.Characteristic.CurrentRelativeHumidity, 45);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"soil_moisture":78}', soilMoistureSensorId, hap.Characteristic.CurrentRelativeHumidity, 78);
    });

    test('Update dry state - not dry (contact detected)', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"dry":false}',
        drySensorId,
        hap.Characteristic.ContactSensorState,
        hap.Characteristic.ContactSensorState.CONTACT_DETECTED
      );
    });

    test('Update dry state - dry (contact not detected)', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"dry":true}',
        drySensorId,
        hap.Characteristic.ContactSensorState,
        hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      );
    });

    test('Update illuminance', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"illuminance":1200}', lightSensorId, hap.Characteristic.CurrentAmbientLightLevel, 1200);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"illuminance":50}', lightSensorId, hap.Characteristic.CurrentAmbientLightLevel, 50);
    });
  });
});
