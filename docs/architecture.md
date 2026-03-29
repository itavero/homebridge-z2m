# Plugin Architecture

This document provides a comprehensive overview of the homebridge-z2m plugin architecture to help contributors understand how to add support for new features, services, and characteristics.

## Overview

The homebridge-z2m plugin bridges Zigbee2MQTT and HomeKit through Homebridge. It follows a **dynamic platform plugin** pattern where Zigbee devices are discovered via MQTT and automatically registered as HomeKit accessories.

```
┌─────────────────┐     MQTT      ┌─────────────────┐     HomeKit     ┌─────────────────┐
│  Zigbee2MQTT    │ ◄──────────► │  homebridge-z2m │ ◄─────────────► │   Home App      │
│                 │              │   (Homebridge)  │                 │   (Apple)       │
└─────────────────┘              └─────────────────┘                 └─────────────────┘
```

## High-Level Data Flow

1. **Discovery**: Plugin subscribes to `{base_topic}/bridge/devices` to receive device definitions
2. **Service Creation**: Device `exposes` data is processed by ServiceCreators to create HomeKit services
3. **State Updates (Z2M → HomeKit)**: MQTT messages on device topics update characteristic values
4. **Commands (HomeKit → Z2M)**: User actions in Home app publish MQTT messages to `{device}/set`

## Directory Structure

```
src/
├── index.ts                  # Plugin entry point, registers with Homebridge
├── platform.ts               # Main platform: MQTT connection, device discovery
├── platformAccessory.ts      # Per-device wrapper, orchestrates service creation
├── z2mModels.ts              # TypeScript types for Z2M exposes data
├── configModels.ts           # Configuration types
├── helpers.ts                # Utility functions
├── colorhelper.ts            # Color space conversions (XY ↔ Hue/Saturation)
├── hap.ts                    # Global HAP (HomeKit) instance
│
└── converters/               # Service handlers ("converters")
    ├── interfaces.ts         # Core interfaces (ServiceCreator, ServiceHandler)
    ├── creators.ts           # ServiceCreatorManager registry
    ├── monitor.ts            # CharacteristicMonitor implementations
    ├── light.ts              # Light handler (most complex)
    ├── switch.ts             # Switch/Outlet handler
    ├── cover.ts              # Window covering handler
    ├── lock.ts               # Lock mechanism handler
    ├── action.ts             # Stateless programmable switch (buttons)
    ├── climate.ts            # Thermostat handler
    ├── battery.ts            # Battery service handler
    ├── air_quality.ts        # Air quality sensor handler
    └── basic_sensors/        # Individual sensor handlers
        ├── temperature.ts
        ├── humidity.ts
        ├── contact.ts
        ├── occupancy.ts
        └── ... (more sensors)

test/
├── testHelpers.ts            # Test utilities and mock harness
├── *.spec.ts                 # Unit tests for each converter
└── exposes/                  # Test fixture JSON files
    ├── _manual/              # Manually maintained overrides
    └── {vendor}/{model}.json # Auto-generated exposes data
```

## Key Components

### 1. Platform (`platform.ts`)

The `Zigbee2mqttPlatform` class is the main entry point that:
- Implements Homebridge's `DynamicPlatformPlugin` interface
- Manages MQTT connection to Zigbee2MQTT broker
- Handles device discovery via `bridge/devices` topic
- Creates/updates `Zigbee2mqttAccessory` instances for each device
- Routes MQTT messages to appropriate accessories

**Key Methods:**
- `handleReceivedDevices()`: Processes device list updates
- `createOrUpdateAccessory()`: Creates or updates HomeKit accessories
- `onMessage()`: Handles incoming MQTT messages

### 2. Accessory (`platformAccessory.ts`)

The `Zigbee2mqttAccessory` class wraps each device and:
- Implements the `BasicAccessory` interface
- Coordinates service creation via `ServiceCreatorManager`
- Manages state updates from MQTT to HomeKit
- Queues commands from HomeKit for MQTT publishing

**Key Methods:**
- `updateDeviceInformation()`: Triggers service creation from exposes
- `updateStates()`: Propagates MQTT state to all service handlers
- `queueDataForSetAction()`: Batches HomeKit commands for MQTT publish

### 3. Service Creators (`converters/*.ts`)

Service creators follow a **factory pattern** to create HomeKit services from Z2M exposes data.

**Interface:**
```typescript
interface ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void;
}
```

**Registered Creators:**
| Creator | HomeKit Service | Z2M Exposes Type |
|---------|-----------------|------------------|
| `LightCreator` | Lightbulb | `light` |
| `SwitchCreator` | Switch/Outlet | `switch` |
| `CoverCreator` | WindowCovering | `cover` |
| `LockCreator` | LockMechanism | `lock` |
| `BasicSensorCreator` | Various sensors | `binary`, `numeric` |
| `AirQualitySensorCreator` | AirQualitySensor | Various |
| `StatelessProgrammableSwitchCreator` | StatelessProgrammableSwitch | `enum` (action) |
| `ThermostatCreator` | Thermostat | `climate` |
| `BatteryCreator` | BatteryService | `numeric` (battery) |

### 4. Service Handlers

Each service handler manages a single HomeKit service and implements:

```typescript
interface ServiceHandler {
  identifier: string;                           // Unique ID for this handler
  mainCharacteristics: (Characteristic | undefined)[];  // Primary characteristics
  getableKeys: string[];                        // MQTT properties that can be fetched
  updateState(state: Record<string, unknown>): void;    // Handle MQTT state updates
}
```

### 5. Characteristic Monitors (`converters/monitor.ts`)

Monitors transform MQTT values to HomeKit values and update characteristics:

| Monitor | Purpose |
|---------|---------|
| `MappingCharacteristicMonitor` | Maps discrete values (e.g., `"ON"` → `true`) |
| `NumericCharacteristicMonitor` | Scales numeric ranges (e.g., 0-254 → 0-100) |
| `BinaryConditionCharacteristicMonitor` | Boolean condition check |
| `PassthroughCharacteristicMonitor` | Uses value directly |
| `NestedCharacteristicMonitor` | Handles nested JSON structures |

## Understanding Exposes

The `exposes` array from Zigbee2MQTT describes device capabilities. Each entry has:

```typescript
interface ExposesEntry {
  type: string;           // 'light', 'switch', 'numeric', 'binary', 'enum', etc.
  name?: string;          // Display name
  property?: string;      // MQTT JSON key (e.g., "brightness")
  endpoint?: string;      // For multi-endpoint devices
  access?: number;        // Bitmask: PUBLISHED=1, SET=2, GET=4
  features?: ExposesEntry[];  // Nested features (for composite types)

  // Type-specific fields:
  value_on?: any;         // Binary: value when ON
  value_off?: any;        // Binary: value when OFF
  value_min?: number;     // Numeric: minimum value
  value_max?: number;     // Numeric: maximum value
  values?: string[];      // Enum: possible values
}
```

**Example: Light with brightness and color temperature**
```json
{
  "type": "light",
  "features": [
    { "type": "binary", "property": "state", "name": "state", "access": 7, "value_on": "ON", "value_off": "OFF" },
    { "type": "numeric", "property": "brightness", "name": "brightness", "access": 7, "value_min": 0, "value_max": 254 },
    { "type": "numeric", "property": "color_temp", "name": "color_temp", "access": 7, "value_min": 150, "value_max": 500 }
  ]
}
```

## Adding a New Service Handler

Follow these steps to add support for a new device type:

### Step 1: Create the Handler File

Create a new file in `src/converters/` (e.g., `fan.ts`):

```typescript
import { BasicAccessory, ConverterConfigurationRegistry, ServiceCreator, ServiceHandler } from './interfaces';
import { ExposesEntry, ExposesEntryWithFeatures, exposesHasFeatures, ExposesKnownTypes } from '../z2mModels';
import { hap } from '../hap';
import { getOrAddCharacteristic } from '../helpers';
import { Characteristic, CharacteristicSetCallback, CharacteristicValue } from 'homebridge';
import { CharacteristicMonitor, MappingCharacteristicMonitor } from './monitor';

// Optional: Configuration interface
interface FanConfig {
  // Configuration options
}

// Configuration validator
export const isFanConfig = (x: any): x is FanConfig => {
  return x !== undefined;
};

export class FanCreator implements ServiceCreator {
  public static readonly CONFIG_TAG = 'fan';

  constructor(converterConfigRegistry: ConverterConfigurationRegistry) {
    converterConfigRegistry.registerConverterConfiguration(
      FanCreator.CONFIG_TAG,
      FanCreator.isValidConverterConfiguration
    );
  }

  private static isValidConverterConfiguration(config: unknown): boolean {
    return isFanConfig(config);
  }

  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes
      .filter((e) =>
        e.type === ExposesKnownTypes.FAN &&  // or appropriate type
        exposesHasFeatures(e) &&
        !accessory.isServiceHandlerIdKnown(FanHandler.generateIdentifier(e.endpoint))
      )
      .forEach((e) => this.createService(e as ExposesEntryWithFeatures, accessory));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory): void {
    try {
      const handler = new FanHandler(expose, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup fan for ${accessory.displayName}: ${error}`);
    }
  }
}

class FanHandler implements ServiceHandler {
  identifier: string;
  mainCharacteristics: Characteristic[];
  private monitors: CharacteristicMonitor[] = [];

  constructor(expose: ExposesEntryWithFeatures, private readonly accessory: BasicAccessory) {
    const endpoint = expose.endpoint;
    this.identifier = FanHandler.generateIdentifier(endpoint);

    // Create HomeKit service
    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);
    const service = accessory.getOrAddService(new hap.Service.Fan(serviceName, endpoint));

    // Set up characteristics and monitors
    // ...
  }

  get getableKeys(): string[] {
    // Return properties that can be fetched via MQTT GET
    return [];
  }

  updateState(state: Record<string, unknown>): void {
    // Update characteristics based on MQTT state
    this.monitors.forEach((m) => m.callback(state, this.accessory.log));
  }

  static generateIdentifier(endpoint: string | undefined): string {
    let identifier = hap.Service.Fan.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}
```

### Step 2: Register the Creator

Add your creator to `src/converters/creators.ts`:

```typescript
import { FanCreator } from './fan';

export class BasicServiceCreatorManager {
  private static readonly constructors: ServiceCreatorConstructor[] = [
    LightCreator,
    SwitchCreator,
    // ... existing creators
    FanCreator,  // Add your new creator
  ];
  // ...
}
```

### Step 3: Add Unit Tests

Create a test file `test/fan.spec.ts`:

```typescript
import { vi } from 'vitest';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from '@homebridge/hap-nodejs';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';

describe('Fan', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Basic Fan Device', () => {
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from a known device
        deviceExposes = loadExposesFromFile('vendor/fan_device.json');
        expect(deviceExposes.length).toBeGreaterThan(0);

        const newHarness = new ServiceHandlersTestHarness();

        // Define expected service and characteristics
        newHarness.getOrAddHandler(hap.Service.Fan)
          .addExpectedCharacteristic('state', hap.Characteristic.On, true);
        newHarness.prepareCreationMocks();

        // Create services
        newHarness.callCreators(deviceExposes);

        // Verify creation
        newHarness.checkCreationExpectations();
        newHarness.checkHasMainCharacteristics();
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    describe('State updates from MQTT', () => {
      test('On', () => {
        harness.checkSingleUpdateState(
          '{"state":"ON"}',
          hap.Service.Fan,
          hap.Characteristic.On,
          true
        );
      });

      test('Off', () => {
        harness.checkSingleUpdateState(
          '{"state":"OFF"}',
          hap.Service.Fan,
          hap.Characteristic.On,
          false
        );
      });
    });

    describe('Commands from HomeKit', () => {
      test('Turn On', () => {
        harness.checkHomeKitUpdateWithSingleValue(
          hap.Service.Fan,
          'state',
          true,
          'ON'
        );
      });

      test('Turn Off', () => {
        harness.checkHomeKitUpdateWithSingleValue(
          hap.Service.Fan,
          'state',
          false,
          'OFF'
        );
      });
    });
  });
});
```

### Step 4: Update Documentation

1. Create `docs/fan.md` describing the new service
2. Update `docs/converters.md` to list the new handler
3. Update `CHANGELOG.md` with the new feature

## Test Patterns

### Using Test Fixtures

Test fixtures are JSON files containing `exposes` data from real devices, stored in `test/exposes/`. These files are auto-generated by the documentation script from zigbee-herdsman-converters.

```typescript
// Load exposes for a specific device model
const exposes = loadExposesFromFile('ikea/e1766.json');
```

To get exposes JSON for new devices:
1. Run `./generate-docs.sh` locally
2. The script extracts exposes from zigbee-herdsman-converters
3. JSON files are created in both `exposes/` and `test/exposes/`
4. Copy needed files to `test/exposes/_manual/` if customization is required

### ServiceHandlersTestHarness

The test harness simplifies testing service creation and state handling:

```typescript
const harness = new ServiceHandlersTestHarness();

// 1. Configure expected services and characteristics
harness.getOrAddHandler(hap.Service.Switch)
  .addExpectedCharacteristic('state', hap.Characteristic.On, true);

// 2. Optionally add configuration
harness.addConverterConfiguration('switch', { type: 'outlet' });

// 3. Prepare mocks
harness.prepareCreationMocks();

// 4. Trigger service creation
harness.callCreators(exposes);

// 5. Verify expectations
harness.checkCreationExpectations();
harness.checkExpectedGetableKeys(['state']);

// 6. Test state updates
harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Switch, hap.Characteristic.On, true);

// 7. Test HomeKit commands
harness.checkHomeKitUpdateWithSingleValue(hap.Service.Switch, 'state', true, 'ON');
```

### Key Test Methods

| Method | Purpose |
|--------|---------|
| `getOrAddHandler(service, subType?)` | Register expected service |
| `addExpectedCharacteristic(id, char, expectSet?)` | Register expected characteristic |
| `addConverterConfiguration(tag, config)` | Set converter config |
| `prepareCreationMocks()` | Set up HAP mocks |
| `callCreators(exposes)` | Trigger service creation |
| `checkCreationExpectations()` | Verify services created |
| `checkSingleUpdateState(json, service, char, value)` | Test MQTT → HomeKit |
| `checkHomeKitUpdateWithSingleValue(service, id, setValue, mqttValue)` | Test HomeKit → MQTT |
| `checkUpdateStateIsIgnored(json)` | Verify state is ignored |
| `clearMocks()` | Reset mocks between tests |

## Common Patterns

### Multi-Endpoint Devices

Devices with multiple endpoints (e.g., multi-gang switches) use the `endpoint` field:

```typescript
// Each endpoint gets a separate service with subtype
const service = accessory.getOrAddService(
  new hap.Service.Switch(serviceName, endpoint)  // endpoint becomes subtype
);

// Generate unique identifier per endpoint
static generateIdentifier(endpoint: string | undefined): string {
  let identifier = hap.Service.Switch.UUID;
  if (endpoint !== undefined) {
    identifier += '_' + endpoint.trim();
  }
  return identifier;
}
```

### Configuration Options

Allow per-device configuration by registering a config tag:

```typescript
// In creator constructor
constructor(converterConfigRegistry: ConverterConfigurationRegistry) {
  converterConfigRegistry.registerConverterConfiguration(
    'myconfig',
    this.isValidConfiguration
  );
}

// In createServicesFromExposes
const config = accessory.getConverterConfiguration('myconfig');
if (isMyConfig(config)) {
  // Apply configuration
}
```

### Value Mapping

Use monitors for value transformation:

```typescript
// Map ON/OFF strings to boolean
const mapping = new Map<CharacteristicValue, CharacteristicValue>();
mapping.set('ON', true);
mapping.set('OFF', false);
const monitor = new MappingCharacteristicMonitor(property, service, characteristic, mapping);

// Scale numeric values
const monitor = new NumericCharacteristicMonitor(
  property,
  service,
  characteristic,
  0, 254,   // MQTT range
  0, 100    // HomeKit range
);
```

### Handling SET Callbacks

```typescript
const characteristic = getOrAddCharacteristic(service, hap.Characteristic.On)
  .on('set', this.handleSetOn.bind(this));

private handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
  const data = { state: value ? 'ON' : 'OFF' };
  this.accessory.queueDataForSetAction(data);
  callback(null);  // Always call callback
}
```

## Reference Documentation

- [Homebridge Developer Documentation](https://developers.homebridge.io/)
- [HomeKit Accessory Protocol (HAP) Specification](https://developer.apple.com/homekit/)
- [Zigbee2MQTT Documentation](https://www.zigbee2mqtt.io/)
- [zigbee-herdsman-converters](https://github.com/Koenkk/zigbee-herdsman-converters)
