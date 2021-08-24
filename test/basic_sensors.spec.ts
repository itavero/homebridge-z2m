import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlersTestHarness, testJsonDeviceListEntry, testJsonExposes } from './testHelpers';
import { Characteristic, CharacteristicValue, WithUUID } from 'homebridge';

describe('Basic Sensors', () => {
  beforeEach(() => {
    setHap(hapNodeJs);
  });

  describe('Aqara RH, T and pressure sensor', () => {
    const deviceModelJson = `{
      "date_code": "20161129",
      "definition": {
         "description": "Aqara temperature, humidity and pressure sensor",
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
               "description": "The measured atmospheric pressure",
               "name": "pressure",
               "property": "pressure",
               "type": "numeric",
               "unit": "hPa"
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
         "model": "WSDCGQ11LM",
         "vendor": "Xiaomi"
      },
      "endpoints": {
         "1": {
            "bindings": [],
            "clusters": {
               "input": [
                  "genBasic",
                  "genIdentify",
                  "msTemperatureMeasurement",
                  "msPressureMeasurement",
                  "msRelativeHumidity"
               ],
               "output": [
                  "genBasic",
                  "genGroups"
               ]
            }
         }
      },
      "friendly_name": "rht_server",
      "ieee_address": "0x00158d000414385c",
      "interview_completed": true,
      "interviewing": false,
      "network_address": 30075,
      "power_source": "Battery",
      "software_build_id": "3000-0001",
      "supported": true,
      "type": "EndDevice"
   }`;

    // Shared "state"
    const airPressureServiceId = 'E863F00A-079E-48FF-8F27-9C2605A29F52';
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
        newHarness.getOrAddHandler(hap.Service.TemperatureSensor)
          .addExpectedCharacteristic('temperature', hap.Characteristic.CurrentTemperature);
        newHarness.getOrAddHandler(hap.Service.HumiditySensor)
          .addExpectedCharacteristic('humidity', hap.Characteristic.CurrentRelativeHumidity);
        newHarness.getOrAddHandler(airPressureServiceId);

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
    const deviceModelJson = `{
      "date_code": "20170314",
      "definition": {
        "description": "MiJia Honeywell smoke detector",
        "exposes": [
          {
            "access": 1,
            "description": "Indicates whether the device detected smoke",
            "name": "smoke",
            "property": "smoke",
            "type": "binary",
            "value_off": false,
            "value_on": true
          },
          {
            "access": 1,
            "description": "Indicates if the battery of this device is almost empty",
            "name": "battery_low",
            "property": "battery_low",
            "type": "binary",
            "value_off": false,
            "value_on": true
          },
          {
            "access": 1,
            "description": "Indicates whether the device is tampered",
            "name": "tamper",
            "property": "tamper",
            "type": "binary",
            "value_off": false,
            "value_on": true
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
            "access": 7,
            "name": "sensitivity",
            "property": "sensitivity",
            "type": "enum",
            "values": [
              "low",
              "medium",
              "high"
            ]
          },
          {
            "access": 1,
            "name": "smoke_density",
            "property": "smoke_density",
            "type": "numeric"
          },
          {
            "access": 2,
            "name": "selftest",
            "property": "selftest",
            "type": "enum",
            "values": [
              ""
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
        "model": "JTYJ-GD-01LM/BW",
        "vendor": "Xiaomi"
      },
      "endpoints": {
        "1": {
          "bindings": [],
          "clusters": {
            "input": [
              "genBasic",
              "genIdentify",
              "genMultistateInput",
              "ssIasZone",
              "genAnalogInput",
              "genPowerCfg"
            ],
            "output": [
              "genOta"
            ]
          }
        }
      },
      "friendly_name": "fire_kitchen",
      "ieee_address": "0x00158d00033ea836",
      "interview_completed": true,
      "interviewing": false,
      "network_address": 55792,
      "power_source": "Battery",
      "software_build_id": "3000-0001",
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
        newHarness.getOrAddHandler(hap.Service.SmokeSensor)
          .addExpectedCharacteristic('smoke', hap.Characteristic.SmokeDetected)
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery)
          .addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);

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

    test('Status updates', (): void => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"battery_low":false,"smoke":false,"tamper":false}',
        hap.Service.SmokeSensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":true,"smoke":false,"tamper":false}',
        hap.Service.SmokeSensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"smoke":true,"tamper":false}',
        hap.Service.SmokeSensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"smoke":false,"tamper":true}',
        hap.Service.SmokeSensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]));
    });
  });

  describe('Aqara PIR sensor', () => {
    const deviceModelJson = `{
      "date_code": "20170627",
      "definition": {
         "description": "Aqara human body movement and illuminance sensor",
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
               "description": "Indicates whether the device detected occupancy",
               "name": "occupancy",
               "property": "occupancy",
               "type": "binary",
               "value_off": false,
               "value_on": true
            },
            {
               "access": 1,
               "description": "Measured illuminance in lux",
               "name": "illuminance_lux",
               "property": "illuminance",
               "type": "numeric",
               "unit": "lx"
            },
            {
               "access": 1,
               "description": "Measured illuminance in lux",
               "name": "illuminance",
               "property": "illuminance",
               "type": "numeric",
               "unit": "lx"
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
         "model": "RTCGQ11LM",
         "vendor": "Xiaomi"
      },
      "endpoints": {
         "1": {
            "bindings": [],
            "clusters": {
               "input": [
                  "genBasic",
                  "msOccupancySensing",
                  "msIlluminanceMeasurement",
                  "ssIasZone",
                  "genPowerCfg",
                  "genIdentify"
               ],
               "output": [
                  "genBasic",
                  "genOta"
               ]
            },
            "configured_reportings": []
         }
      },
      "friendly_name": "pir_garage",
      "ieee_address": "0x00158d000414197f",
      "interview_completed": true,
      "interviewing": false,
      "model_id": "lumi.sensor_motion.aq2",
      "network_address": 48199,
      "power_source": "Battery",
      "software_build_id": "3000-0001",
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
        newHarness.getOrAddHandler(hap.Service.OccupancySensor)
          .addExpectedCharacteristic('occupancy', hap.Characteristic.OccupancyDetected);
        newHarness.getOrAddHandler(hap.Service.LightSensor)
          .addExpectedCharacteristic('illuminance', hap.Characteristic.CurrentAmbientLightLevel);

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

    test('Update occupancy', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"occupancy":false}',
        hap.Service.OccupancySensor,
        hap.Characteristic.OccupancyDetected, hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"occupancy":true}',
        hap.Service.OccupancySensor,
        hap.Characteristic.OccupancyDetected, hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED);
    });

    test('Update illuminance', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"illuminance":1}', hap.Service.LightSensor,
        hap.Characteristic.CurrentAmbientLightLevel, 1);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"illuminance":2248}', hap.Service.LightSensor,
        hap.Characteristic.CurrentAmbientLightLevel, 2248);
    });
  });

  describe('Aqara contact sensor', () => {
    const deviceModelJson = `{
      "date_code": "20161128",
      "definition": {
        "description": "Aqara door & window contact sensor",
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
            "description": "Indicates if the contact is closed (= true) or open (= false)",
            "name": "contact",
            "property": "contact",
            "type": "binary",
            "value_off": true,
            "value_on": false
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
        "model": "MCCGQ11LM",
        "vendor": "Xiaomi"
      },
      "endpoints": {
        "1": {
          "bindings": [],
          "clusters": {
            "input": [
              "genBasic",
              "genIdentify",
              "genOnOff"
            ],
            "output": [
              "genBasic",
              "genGroups"
            ]
          }
        }
      },
      "friendly_name": "door_shed",
      "ieee_address": "0x00158d0003e7430e",
      "interview_completed": true,
      "interviewing": false,
      "network_address": 55705,
      "power_source": "Battery",
      "software_build_id": "3000-0001",
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
        newHarness.getOrAddHandler(hap.Service.ContactSensor)
          .addExpectedCharacteristic('contact', hap.Characteristic.ContactSensorState);
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

    test('Update contact', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"contact":false}', hap.Service.ContactSensor,
        hap.Characteristic.ContactSensorState, hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"contact":true}', hap.Service.ContactSensor,
        hap.Characteristic.ContactSensorState, hap.Characteristic.ContactSensorState.CONTACT_DETECTED);
    });
  });

  describe('Aqara water leak sensor', () => {
    const deviceModelJson = `{
      "definition": {
        "description": "Aqara water leak sensor",
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
            "description": "Indicates whether the device detected a water leak",
            "name": "water_leak",
            "property": "water_leak",
            "type": "binary",
            "value_off": false,
            "value_on": true
          },
          {
            "access": 1,
            "description": "Indicates if the battery of this device is almost empty",
            "name": "battery_low",
            "property": "battery_low",
            "type": "binary",
            "value_off": false,
            "value_on": true
          },
          {
            "access": 1,
            "description": "Indicates whether the device is tampered",
            "name": "tamper",
            "property": "tamper",
            "type": "binary",
            "value_off": false,
            "value_on": true
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
        "model": "SJCGQ11LM",
        "vendor": "Xiaomi"
      },
      "endpoints": {
        "1": {
          "bindings": [],
          "clusters": {
            "input": [],
            "output": []
          }
        }
      },
      "friendly_name": "waterleak_cellar",
      "ieee_address": "0x00158d00044bebfa",
      "interview_completed": false,
      "interviewing": false,
      "network_address": 32600,
      "supported": true,
      "type": "EndDevice"
    }`;

    // Shared "state"
    let waterLeakSensorId = '';
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
        waterLeakSensorId = 'water_' + hap.Service.LeakSensor.UUID;
        newHarness.getOrAddHandler(hap.Service.LeakSensor, 'water', waterLeakSensorId)
          .addExpectedCharacteristic('water_leak', hap.Characteristic.LeakDetected)
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery)
          .addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
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

    test('Update state', (): void => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"battery_low":false,"water_leak":false,"tamper":false}', waterLeakSensorId,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":true,"water_leak":false,"tamper":false}', waterLeakSensorId,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"water_leak":true,"tamper":false}', waterLeakSensorId,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"water_leak":false,"tamper":true}', waterLeakSensorId,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]));
    });
  });

  describe('Oujiabao Gas and carbon monoxide alarm', () => {
    const deviceModelJson = `{
      "date_code": "20160825        ",
      "definition": {
        "description": "Gas and carbon monoxide alarm",
        "exposes": [
          {
            "access": 1,
            "description": "Indicates whether the device detected gas",
            "name": "gas",
            "property": "gas",
            "type": "binary",
            "value_off": false,
            "value_on": true
          },
          {
            "access": 1,
            "description": "Indicates if CO2 (carbon monoxide) is detected",
            "name": "carbon_monoxide",
            "property": "carbon_monoxide",
            "type": "binary",
            "value_off": false,
            "value_on": true
          },
          {
            "access": 1,
            "description": "Indicates whether the device is tampered",
            "name": "tamper",
            "property": "tamper",
            "type": "binary",
            "value_off": false,
            "value_on": true
          },
          {
            "access": 1,
            "description": "Indicates if the battery of this device is almost empty",
            "name": "battery_low",
            "property": "battery_low",
            "type": "binary",
            "value_off": false,
            "value_on": true
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
        "model": "CR701-YZ",
        "vendor": "Oujiabao"
      },
      "endpoints": {
        "19": {
          "bindings": [],
          "clusters": {
            "input": [
              "genBasic",
              "genIdentify",
              "ssIasZone"
            ],
            "output": [
              "genIdentify",
              "genAlarms"
            ]
          }
        }
      },
      "friendly_name": "gas_metering",
      "ieee_address": "0x00124b0013df5d59",
      "interview_completed": false,
      "interviewing": false,
      "network_address": 1743,
      "power_source": "Mains (single phase)",
      "supported": true,
      "type": "EndDevice"
    }`;

    // Shared "state"
    let gasLeakSensorId = '';
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
        gasLeakSensorId = 'gas_' + hap.Service.LeakSensor.UUID;
        newHarness.getOrAddHandler(hap.Service.LeakSensor, 'gas', gasLeakSensorId)
          .addExpectedCharacteristic('gas', hap.Characteristic.LeakDetected)
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery)
          .addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
        newHarness.getOrAddHandler(hap.Service.CarbonMonoxideSensor)
          .addExpectedCharacteristic('carbon_monoxide', hap.Characteristic.CarbonMonoxideDetected)
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery)
          .addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
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
    test('Update battery and tamper', (): void => {
      expect(harness).toBeDefined();
      harness.checkUpdateState('{"battery_low":true,"tamper":false}', gasLeakSensorId,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]), false);
      harness.checkUpdateState('{"battery_low":true,"tamper":false}', hap.Service.CarbonMonoxideSensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]), false);
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"tamper":true}', gasLeakSensorId,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]), false);
      harness.checkUpdateState('{"battery_low":false,"tamper":true}', hap.Service.CarbonMonoxideSensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]), false);
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":true,"tamper":true}', gasLeakSensorId,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]), false);
      harness.checkUpdateState('{"battery_low":true,"tamper":true}', hap.Service.CarbonMonoxideSensor,
        new Map<WithUUID<{ new(): Characteristic }> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]), false);
    });
    test('Update gas', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"gas":false}', gasLeakSensorId,
        hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"gas":true}', gasLeakSensorId,
        hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_DETECTED);
    });

    test('Update carbon monoxide', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"carbon_monoxide":false}', hap.Service.CarbonMonoxideSensor,
        hap.Characteristic.CarbonMonoxideDetected, hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"carbon_monoxide":true}', hap.Service.CarbonMonoxideSensor,
        hap.Characteristic.CarbonMonoxideDetected, hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL);
    });
  });

  describe('HEIMAN HS1VS-N', () => {
    const deviceExposesJson = `[
      {
        "type": "binary",
        "name": "vibration",
        "property": "vibration",
        "access": 1,
        "value_on": true,
        "value_off": false,
        "description": "Indicates whether the device detected vibration"
      },
      {
        "type": "binary",
        "name": "battery_low",
        "property": "battery_low",
        "access": 1,
        "value_on": true,
        "value_off": false,
        "description": "Indicates if the battery of this device is almost empty"
      },
      {
        "type": "binary",
        "name": "tamper",
        "property": "tamper",
        "access": 1,
        "value_on": true,
        "value_off": false,
        "description": "Indicates whether the device is tampered"
      },
      {
        "type": "numeric",
        "name": "battery",
        "property": "battery",
        "access": 1,
        "unit": "%",
        "description": "Remaining battery in %",
        "value_min": 0,
        "value_max": 100
      },
      {
        "type": "numeric",
        "name": "linkquality",
        "property": "linkquality",
        "access": 1,
        "unit": "lqi",
        "description": "Link quality (signal strength)",
        "value_min": 0,
        "value_max": 255
      }
    ]`;

    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;
    let vibrationSensorId: string;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Test JSON Device List entry
        deviceExposes = testJsonExposes(deviceExposesJson) ?? [];
        expect(deviceExposes?.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        vibrationSensorId = 'vibration_' + hap.Service.MotionSensor.UUID;
        newHarness.getOrAddHandler(hap.Service.MotionSensor, 'vibration', vibrationSensorId)
          .addExpectedCharacteristic('vibration', hap.Characteristic.MotionDetected)
          .addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery)
          .addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
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

    test('Update vibration', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"vibration":false}', vibrationSensorId,
        hap.Characteristic.MotionDetected, false);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"vibration":true}', vibrationSensorId,
        hap.Characteristic.MotionDetected, true);
    });
  });

  describe('SmartThings STSS-PRES-001', () => {
    const deviceExposesJson = `[
      {
        "type": "numeric",
        "name": "battery",
        "property": "battery",
        "access": 1,
        "unit": "%",
        "description": "Remaining battery in %",
        "value_min": 0,
        "value_max": 100
      },
      {
        "type": "binary",
        "name": "presence",
        "property": "presence",
        "access": 1,
        "value_on": true,
        "value_off": false,
        "description": "Indicates whether the device detected presence"
      },
      {
        "type": "numeric",
        "name": "linkquality",
        "property": "linkquality",
        "access": 1,
        "unit": "lqi",
        "description": "Link quality (signal strength)",
        "value_min": 0,
        "value_max": 255
      }
    ]`;

    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;
    let presenceSensorId: string;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Test JSON Device List entry
        deviceExposes = testJsonExposes(deviceExposesJson) ?? [];
        expect(deviceExposes?.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        presenceSensorId = 'presence_' + hap.Service.OccupancySensor.UUID;
        newHarness.getOrAddHandler(hap.Service.OccupancySensor, 'presence', presenceSensorId)
          .addExpectedCharacteristic('presence', hap.Characteristic.OccupancyDetected);
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

    test('Update presence', (): void => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"presence":false}', presenceSensorId,
        hap.Characteristic.OccupancyDetected, hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"presence":true}', presenceSensorId,
        hap.Characteristic.OccupancyDetected, hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED);
    });
  });
});