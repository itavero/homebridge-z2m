import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { ServiceHandlerTestHarness, testJsonDeviceListEntry } from './testHelpers';
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
    let deviceExposes : ExposesEntry[] = [];

    beforeEach(() => {
      // Only check JSON model conversion once
      if (deviceExposes.length === 0) {
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('TemperatureSensor', (): void => {
      const harness = new ServiceHandlerTestHarness(hap.Service.TemperatureSensor);

      // Prepare mocks and such
      harness.addExpectedCharacteristic('temperature', hap.Characteristic.CurrentTemperature);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkSingleUpdateState('{"temperature":22.5}', hap.Characteristic.CurrentTemperature, 22.5);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"temperature":-3.25}', hap.Characteristic.CurrentTemperature, -3.25);
    });

    test('HumiditySensor', (): void => {
      const harness = new ServiceHandlerTestHarness(hap.Service.HumiditySensor);

      // Prepare mocks and such
      harness.addExpectedCharacteristic('humidity', hap.Characteristic.CurrentRelativeHumidity);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkSingleUpdateState('{"humidity":51.92}', hap.Characteristic.CurrentRelativeHumidity, 51.92);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"humidity":64.62}', hap.Characteristic.CurrentRelativeHumidity, 64.62);
    });

    test('AirPressureSensor', (): void => {
      const harness = new ServiceHandlerTestHarness(undefined, 'E863F00A-079E-48FF-8F27-9C2605A29F52');

      // Prepare mocks and such
      // harness.addExpectedCharacteristic('pressure', hap.Characteristic.CurrentRelativeHumidity);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkSingleUpdateState('{"pressure":975.8}', 'Air Pressure', 975.8);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"pressure":789}', 'Air Pressure', 789);
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
    let deviceExposes : ExposesEntry[] = [];

    beforeEach(() => {
      // Only check JSON model conversion once
      if (deviceExposes.length === 0) {
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('SmokeSensor', (): void => {
      const harness = new ServiceHandlerTestHarness(hap.Service.SmokeSensor);

      // Prepare mocks and such
      harness.addExpectedCharacteristic('smoke', hap.Characteristic.SmokeDetected);
      harness.addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery);
      harness.addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkUpdateState('{"battery_low":false,"smoke":false,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":true,"smoke":false,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"smoke":true,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.SmokeDetected, hap.Characteristic.SmokeDetected.SMOKE_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"smoke":false,"tamper":true}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
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
            "description": "Raw measured illuminance",
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
          }
        }
      },
      "friendly_name": "pir_garage",
      "ieee_address": "0x00158d000414197f",
      "interview_completed": true,
      "interviewing": false,
      "network_address": 48199,
      "power_source": "Battery",
      "software_build_id": "3000-0001",
      "supported": true,
      "type": "EndDevice"
    }`;

    // Shared "state"
    let deviceExposes : ExposesEntry[] = [];

    beforeEach(() => {
      // Only check JSON model conversion once
      if (deviceExposes.length === 0) {
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('OccupancySensor', (): void => {
      const harness = new ServiceHandlerTestHarness(hap.Service.OccupancySensor);

      // Prepare mocks and such
      harness.addExpectedCharacteristic('occupancy', hap.Characteristic.OccupancyDetected);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkSingleUpdateState('{"occupancy":false}',
        hap.Characteristic.OccupancyDetected, hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"occupancy":true}',
        hap.Characteristic.OccupancyDetected, hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED);
    });

    test.skip('LightSensor', (): void => {
      // TODO:  Test currently skipped due to incorrect exposes information.
      //        See: https://github.com/Koenkk/zigbee-herdsman-converters/issues/1992
      const harness = new ServiceHandlerTestHarness(hap.Service.LightSensor);

      // Prepare mocks and such
      harness.addExpectedCharacteristic('illuminance_lux', hap.Characteristic.CurrentAmbientLightLevel);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkSingleUpdateState('{"illuminance_lux":1}', hap.Characteristic.CurrentAmbientLightLevel, 1);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"illuminance_lux":2248}', hap.Characteristic.CurrentAmbientLightLevel, 2248);
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
    let deviceExposes : ExposesEntry[] = [];

    beforeEach(() => {
      // Only check JSON model conversion once
      if (deviceExposes.length === 0) {
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('ContactSensor', (): void => {
      const harness = new ServiceHandlerTestHarness(hap.Service.ContactSensor);

      // Prepare mocks and such
      harness.addExpectedCharacteristic('contact', hap.Characteristic.ContactSensorState);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkSingleUpdateState('{"contact":false}',
        hap.Characteristic.ContactSensorState, hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
      harness.clearMocks();
      harness.checkSingleUpdateState('{"contact":true}',
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
    let deviceExposes : ExposesEntry[] = [];

    beforeEach(() => {
      // Only check JSON model conversion once
      if (deviceExposes.length === 0) {
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('LeakSensor', (): void => {
      const harness = new ServiceHandlerTestHarness(hap.Service.LeakSensor, 'water_' + hap.Service.LeakSensor.UUID);

      // Prepare mocks and such
      harness.addExpectedCharacteristic('water_leak', hap.Characteristic.LeakDetected);
      harness.addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery);
      harness.addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkUpdateState('{"battery_low":false,"water_leak":false,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":true,"water_leak":false,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"water_leak":true,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"water_leak":false,"tamper":true}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
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
    let deviceExposes : ExposesEntry[] = [];

    beforeEach(() => {
      // Only check JSON model conversion once
      if (deviceExposes.length === 0) {
        const device = testJsonDeviceListEntry(deviceModelJson);
        deviceExposes = device?.definition?.exposes ?? [];
      }
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('LeakSensor', (): void => {
      const harness = new ServiceHandlerTestHarness(hap.Service.LeakSensor, 'gas_' + hap.Service.LeakSensor.UUID);

      // Prepare mocks and such
      harness.addExpectedCharacteristic('gas', hap.Characteristic.LeakDetected);
      harness.addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery);
      harness.addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkUpdateState('{"battery_low":false,"gas":false,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":true,"gas":false,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"gas":true,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"gas":false,"tamper":true}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.LeakDetected, hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]));
    });

    test('CarbonMonoxideSensor', (): void => {
      const harness = new ServiceHandlerTestHarness(hap.Service.CarbonMonoxideSensor);

      // Prepare mocks and such
      harness.addExpectedCharacteristic('carbon_monoxide', hap.Characteristic.CarbonMonoxideDetected);
      harness.addExpectedCharacteristic('battery_low', hap.Characteristic.StatusLowBattery);
      harness.addExpectedCharacteristic('tamper', hap.Characteristic.StatusTampered);
      harness.prepareCreationMocks();
        
      // Call the creator
      harness.callCreators(deviceExposes);

      // Check mocks from creation process
      harness.checkCreationExpectations();

      // Check getable keys
      harness.checkExpectedGetableKeys([]);

      // Clear mocks after first stage
      resetAllWhenMocks();
      harness.clearMocks();

      // Check updates
      harness.checkUpdateState('{"battery_low":false,"carbon_monoxide":false,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.CarbonMonoxideDetected, hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":true,"carbon_monoxide":false,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW],
          [hap.Characteristic.CarbonMonoxideDetected, hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"carbon_monoxide":true,"tamper":false}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.CarbonMonoxideDetected, hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.NOT_TAMPERED],
        ]));
      harness.clearMocks();
      harness.checkUpdateState('{"battery_low":false,"carbon_monoxide":false,"tamper":true}',
        new Map<WithUUID<{new (): Characteristic}> | string, CharacteristicValue>([
          [hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL],
          [hap.Characteristic.CarbonMonoxideDetected, hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL],
          [hap.Characteristic.StatusTampered, hap.Characteristic.StatusTampered.TAMPERED],
        ]));
    });
  });
});