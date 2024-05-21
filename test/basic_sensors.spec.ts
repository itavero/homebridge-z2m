import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';
import { Characteristic, CharacteristicValue, WithUUID } from 'homebridge';

describe('Basic Sensors', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Aqara T1 temperature, humidity and pressure sensor', () => {
    // Shared "state"
    const airPressureServiceId = 'E863F00A-079E-48FF-8F27-9C2605A29F52';
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;
    let deviceTemperatureServiceId: string;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('aqara/wsdcgq12lm.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        deviceTemperatureServiceId = hap.Service.TemperatureSensor.UUID + '_device_temperature';
        newHarness
          .getOrAddHandler(hap.Service.TemperatureSensor, 'device_temperature')
          .addExpectedCharacteristic('device_temperature', hap.Characteristic.CurrentTemperature);
        newHarness
          .getOrAddHandler(hap.Service.TemperatureSensor)
          .addExpectedCharacteristic('temperature', hap.Characteristic.CurrentTemperature);
        newHarness
          .getOrAddHandler(hap.Service.HumiditySensor)
          .addExpectedCharacteristic('humidity', hap.Characteristic.CurrentRelativeHumidity);
        newHarness.getOrAddHandler(airPressureServiceId);

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

    test('Update device temperature', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"device_temperature":12.5}',
        deviceTemperatureServiceId,
        hap.Characteristic.CurrentTemperature,
        12.5
      );
      harness.clearMocks();
      harness.checkSingleUpdateState(
        '{"device_temperature":32.1}',
        deviceTemperatureServiceId,
        hap.Characteristic.CurrentTemperature,
        32.1
      );
    });

    test('Update temperature', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"temperature":22.5}', hap.Service.TemperatureSensor, hap.Characteristic.CurrentTemperature, 22.5);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"temperature":-3.25}', hap.Service.TemperatureSensor, hap.Characteristic.CurrentTemperature, -3.25);
    });

    test('Update humidity', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"humidity":51.92}', hap.Service.HumiditySensor, hap.Characteristic.CurrentRelativeHumidity, 51.92);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"humidity":64.62}', hap.Service.HumiditySensor, hap.Characteristic.CurrentRelativeHumidity, 64.62);
    });

    test('Update air pressure', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"pressure":975.8}', airPressureServiceId, 'Air Pressure', 975.8);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"pressure":789}', airPressureServiceId, 'Air Pressure', 789);
    });
  });

  describe('MiJia Honeywell smoke detector', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('xiaomi/jtyj-gd-01lm_bw.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness
          .getOrAddHandler(hap.Service.SmokeSensor)
          .addExpectedCharacteristic('smoke', hap.Characteristic.SmokeDetected)
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery)
          .addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);

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

    test('Status updates', (): void => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"battery_low":false,"smoke":false,"tamper":false}',
        hap.Service.SmokeSensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ])
      );
      harness.clearMocks();
      harness.checkUpdateState(
        '{"battery_low":true,"smoke":false,"tamper":false}',
        hap.Service.SmokeSensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ])
      );
      harness.clearMocks();
      harness.checkUpdateState(
        '{"battery_low":false,"smoke":true,"tamper":false}',
        hap.Service.SmokeSensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ])
      );
      harness.clearMocks();
      harness.checkUpdateState(
        '{"battery_low":false,"smoke":false,"tamper":true}',
        hap.Service.SmokeSensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ])
      );
    });
  });

  describe('Aqara PIR sensor', () => {
    describe('as Occupancy Sensor', () => {
      // Shared "state"
      let deviceExposes: ExposesEntry[] = [];
      let harness: ServiceHandlersTestHarness;

      beforeEach(() => {
        // Only test service creation for first test case and reuse harness afterwards
        if (deviceExposes.length === 0 && harness === undefined) {
          // Load exposes from JSON
          deviceExposes = loadExposesFromFile('aqara/rtcgq11lm.json');
          expect(deviceExposes.length).toBeGreaterThan(0);
          const newHarness = new ServiceHandlersTestHarness();

          // Check service creation
          newHarness.addConverterConfiguration('occupancy', { type: 'occupancy' });
          newHarness
            .getOrAddHandler(hap.Service.OccupancySensor)
            .addExpectedCharacteristic('occupancy', hap.Characteristic.OccupancyDetected);
          newHarness
            .getOrAddHandler(hap.Service.LightSensor)
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

      test('Update occupancy', (): void => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState(
          '{"occupancy":false}',
          hap.Service.OccupancySensor,
          hap.Characteristic.OccupancyDetected,
          hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
        );
        harness.clearMocks();
        harness.checkSingleUpdateState(
          '{"occupancy":true}',
          hap.Service.OccupancySensor,
          hap.Characteristic.OccupancyDetected,
          hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
        );
      });

      test('Update illuminance', (): void => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState('{"illuminance":1}', hap.Service.LightSensor, hap.Characteristic.CurrentAmbientLightLevel, 1);
        harness.clearMocks();
        harness.checkSingleUpdateState('{"illuminance":2248}', hap.Service.LightSensor, hap.Characteristic.CurrentAmbientLightLevel, 2248);
      });
    });

    describe('as Motion Sensor', () => {
      // Shared "state"
      let deviceExposes: ExposesEntry[] = [];
      let harness: ServiceHandlersTestHarness;
      let motionSensorId: string;

      beforeEach(() => {
        // Only test service creation for first test case and reuse harness afterwards
        if (deviceExposes.length === 0 && harness === undefined) {
          // Load exposes from JSON
          deviceExposes = loadExposesFromFile('aqara/rtcgq11lm.json');
          expect(deviceExposes.length).toBeGreaterThan(0);
          const newHarness = new ServiceHandlersTestHarness();

          // Check service creation
          motionSensorId = 'occupancy_' + hap.Service.MotionSensor.UUID;

          newHarness.addConverterConfiguration('occupancy', { type: 'motion' });
          newHarness
            .getOrAddHandler(hap.Service.MotionSensor, 'occupancy', motionSensorId)
            .addExpectedCharacteristic('occupancy', hap.Characteristic.MotionDetected);
          newHarness
            .getOrAddHandler(hap.Service.LightSensor)
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

      test('Update motion', (): void => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState('{"occupancy":false}', motionSensorId, hap.Characteristic.MotionDetected, false);
        harness.clearMocks();
        harness.checkSingleUpdateState('{"occupancy":true}', motionSensorId, hap.Characteristic.MotionDetected, true);
      });
    });
  });

  describe('Aqara contact sensor', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('aqara/mccgq11lm.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness.getOrAddHandler(hap.Service.ContactSensor).addExpectedCharacteristic('contact', hap.Characteristic.ContactSensorState);
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

    test('Update contact', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"contact":false}',
        hap.Service.ContactSensor,
        hap.Characteristic.ContactSensorState,
        hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      );
      harness.clearMocks();
      harness.checkSingleUpdateState(
        '{"contact":true}',
        hap.Service.ContactSensor,
        hap.Characteristic.ContactSensorState,
        hap.Characteristic.ContactSensorState.CONTACT_DETECTED
      );
    });
  });

  describe('Aqara water leak sensor', () => {
    // Shared "state"
    let waterLeakSensorId = '';
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('aqara/sjcgq11lm.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        waterLeakSensorId = 'water_' + hap.Service.LeakSensor.UUID;
        newHarness
          .getOrAddHandler(hap.Service.LeakSensor, 'water', waterLeakSensorId)
          .addExpectedCharacteristic('water_leak', hap.Characteristic.LeakDetected)
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
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Update state', (): void => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"battery_low":false,"water_leak":false}',
        waterLeakSensorId,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
        ])
      );
      harness.clearMocks();
      harness.checkUpdateState(
        '{"battery_low":true,"water_leak":false}',
        waterLeakSensorId,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
        ])
      );
      harness.clearMocks();
      harness.checkUpdateState(
        '{"battery_low":false,"water_leak":true}',
        waterLeakSensorId,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_DETECTED],
        ])
      );
    });
  });

  describe('Oujiabao Gas and carbon monoxide alarm', () => {
    // Shared "state"
    let gasLeakSensorId = '';
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('oujiabao/cr701-yz.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        gasLeakSensorId = 'gas_' + hap.Service.LeakSensor.UUID;
        newHarness
          .getOrAddHandler(hap.Service.LeakSensor, 'gas', gasLeakSensorId)
          .addExpectedCharacteristic('gas', hap.Characteristic.LeakDetected)
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery)
          .addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
        newHarness
          .getOrAddHandler(hap.Service.CarbonMonoxideSensor)
          .addExpectedCharacteristic('carbon_monoxide', hap.Characteristic.CarbonMonoxideDetected)
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery)
          .addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
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
    test('Update battery and tamper', (): void => {
      expect(harness).toBeDefined();
      harness.checkUpdateState(
        '{"battery_low":true,"tamper":false}',
        gasLeakSensorId,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]),
        false
      );
      harness.checkUpdateState(
        '{"battery_low":true,"tamper":false}',
        hap.Service.CarbonMonoxideSensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]),
        false
      );
      harness.clearMocks();
      harness.checkUpdateState(
        '{"battery_low":false,"tamper":true}',
        gasLeakSensorId,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]),
        false
      );
      harness.checkUpdateState(
        '{"battery_low":false,"tamper":true}',
        hap.Service.CarbonMonoxideSensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]),
        false
      );
      harness.clearMocks();
      harness.checkUpdateState(
        '{"battery_low":true,"tamper":true}',
        gasLeakSensorId,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]),
        false
      );
      harness.checkUpdateState(
        '{"battery_low":true,"tamper":true}',
        hap.Service.CarbonMonoxideSensor,
        new Map<WithUUID<{ new (): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]),
        false
      );
    });
    test('Update gas', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"gas":false}',
        gasLeakSensorId,
        hap.Characteristic.LeakDetected,
        hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED
      );
      harness.clearMocks();
      harness.checkSingleUpdateState(
        '{"gas":true}',
        gasLeakSensorId,
        hap.Characteristic.LeakDetected,
        hap.Characteristic.LeakDetected.LEAK_DETECTED
      );
    });

    test('Update carbon monoxide', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"carbon_monoxide":false}',
        hap.Service.CarbonMonoxideSensor,
        hap.Characteristic.CarbonMonoxideDetected,
        hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL
      );
      harness.clearMocks();
      harness.checkSingleUpdateState(
        '{"carbon_monoxide":true}',
        hap.Service.CarbonMonoxideSensor,
        hap.Characteristic.CarbonMonoxideDetected,
        hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL
      );
    });
  });

  describe('HEIMAN HS1VS-N', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;
    let vibrationSensorId: string;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('heiman/hs1vs-n.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        vibrationSensorId = 'vibration_' + hap.Service.MotionSensor.UUID;
        newHarness
          .getOrAddHandler(hap.Service.MotionSensor, 'vibration', vibrationSensorId)
          .addExpectedCharacteristic('vibration', hap.Characteristic.MotionDetected)
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery)
          .addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
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

    test('Update vibration', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"vibration":false}', vibrationSensorId, hap.Characteristic.MotionDetected, false);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"vibration":true}', vibrationSensorId, hap.Characteristic.MotionDetected, true);
    });
  });

  describe('SmartThings STSS-PRES-001', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;
    let presenceSensorId: string;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('smartthings/stss-pres-001.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        presenceSensorId = 'presence_' + hap.Service.OccupancySensor.UUID;
        newHarness
          .getOrAddHandler(hap.Service.OccupancySensor, 'presence', presenceSensorId)
          .addExpectedCharacteristic('presence', hap.Characteristic.OccupancyDetected);
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

    test('Update presence', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState(
        '{"presence":false}',
        presenceSensorId,
        hap.Characteristic.OccupancyDetected,
        hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
      );
      harness.clearMocks();
      harness.checkSingleUpdateState(
        '{"presence":true}',
        presenceSensorId,
        hap.Characteristic.OccupancyDetected,
        hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
      );
    });
  });
});
