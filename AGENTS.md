# AGENTS.md

This file provides guidance for LLM agents (such as Claude Code, GitHub Copilot, Cursor, etc.) working on the homebridge-z2m codebase.

## Project Overview

**homebridge-z2m** is a Homebridge plugin that exposes Zigbee2MQTT devices to Apple HomeKit. It acts as a bridge between:
- **Zigbee2MQTT**: Communicates with Zigbee devices via MQTT
- **Homebridge**: Exposes devices to Apple HomeKit

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run build` | Build TypeScript to JavaScript |
| `npm test` | Run tests with coverage + linting |
| `npm run watch:test` | Run tests in watch mode |
| `npm run lint` | Check for linting errors |
| `npm run lint-fix` | Auto-fix linting issues |
| `npm run smoke-test` | Run integration test with mock broker |
| `./generate-docs.sh` | Generate docs and test exposes files |

## Architecture Overview

The plugin follows a **dynamic platform pattern** with these key components:

```
src/
├── platform.ts           # Main platform (MQTT, device discovery)
├── platformAccessory.ts  # Per-device accessory wrapper
├── z2mModels.ts          # Z2M exposes type definitions
└── converters/           # Service handlers
    ├── interfaces.ts     # Core interfaces
    ├── creators.ts       # ServiceCreatorManager
    ├── monitor.ts        # Characteristic value monitors
    └── *.ts              # Individual handlers (light, switch, etc.)
```

### Data Flow

1. **Discovery**: `platform.ts` receives device info from `bridge/devices` MQTT topic
2. **Service Creation**: `ServiceCreatorManager` processes `exposes` array to create HomeKit services
3. **State Updates**: MQTT messages update HomeKit characteristics via monitors
4. **Commands**: HomeKit actions queue MQTT publishes to `{device}/set`

### Key Interfaces

```typescript
// Service creator (factory pattern)
interface ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void;
}

// Service handler (manages one HomeKit service)
interface ServiceHandler {
  identifier: string;
  mainCharacteristics: Characteristic[];
  getableKeys: string[];
  updateState(state: Record<string, unknown>): void;
}
```

## Working with Tests

### Test Framework

Tests use **Vitest** (not Jest). Key imports:

```typescript
import { vi } from 'vitest';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from '@homebridge/hap-nodejs';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';
```

### Test Structure Pattern

```typescript
describe('ServiceName', () => {
  beforeAll(() => {
    setHap(hapNodeJs);  // Required: initialize HAP
  });

  describe('Device Model', () => {
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from test fixtures
        deviceExposes = loadExposesFromFile('vendor/model.json');
        const newHarness = new ServiceHandlersTestHarness();

        // Define expected service and characteristics
        newHarness.getOrAddHandler(hap.Service.Switch)
          .addExpectedCharacteristic('state', hap.Characteristic.On, true);
        newHarness.prepareCreationMocks();

        // Trigger creation
        newHarness.callCreators(deviceExposes);
        newHarness.checkCreationExpectations();
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    // Test MQTT → HomeKit
    test('State update: On', () => {
      harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Switch, hap.Characteristic.On, true);
    });

    // Test HomeKit → MQTT
    test('HomeKit: Turn On', () => {
      harness.checkHomeKitUpdateWithSingleValue(hap.Service.Switch, 'state', true, 'ON');
    });
  });
});
```

### Getting Test Fixtures

Test fixtures are JSON files in `test/exposes/` containing device exposes data.

To generate fixtures for new devices:
```bash
./generate-docs.sh
```

This extracts exposes from `zigbee-herdsman-converters` and creates files in:
- `exposes/` (for documentation)
- `test/exposes/` (for tests)

Manual fixtures go in `test/exposes/_manual/`.

## Adding New Service Handlers

### 1. Create Handler File

Create `src/converters/{service}.ts`:

```typescript
import { BasicAccessory, ConverterConfigurationRegistry, ServiceCreator, ServiceHandler } from './interfaces';
import { ExposesEntry, ExposesEntryWithFeatures, exposesHasFeatures } from '../z2mModels';
import { hap } from '../hap';
import { Characteristic } from 'homebridge';

export class MyServiceCreator implements ServiceCreator {
  public static readonly CONFIG_TAG = 'myservice';

  constructor(converterConfigRegistry: ConverterConfigurationRegistry) {
    converterConfigRegistry.registerConverterConfiguration(
      MyServiceCreator.CONFIG_TAG,
      () => true  // Config validator
    );
  }

  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    // Filter matching exposes and create handlers
  }
}

class MyServiceHandler implements ServiceHandler {
  identifier: string;
  mainCharacteristics: Characteristic[];
  // Implementation
}
```

### 2. Register in creators.ts

```typescript
import { MyServiceCreator } from './myservice';

private static readonly constructors: ServiceCreatorConstructor[] = [
  // ... existing
  MyServiceCreator,
];
```

### 3. Add Tests

Create `test/myservice.spec.ts` following the pattern above.

### 4. Update Documentation

- Create `docs/myservice.md`
- Add entry to `docs/converters.md`
- Update `CHANGELOG.md`

## Common Patterns

### Multi-Endpoint Devices

Devices with multiple endpoints (e.g., multi-gang switches):

```typescript
// Use endpoint as service subtype
const service = accessory.getOrAddService(
  new hap.Service.Switch(serviceName, endpoint)
);

// Include endpoint in identifier
static generateIdentifier(endpoint: string | undefined): string {
  let id = hap.Service.Switch.UUID;
  if (endpoint) id += '_' + endpoint.trim();
  return id;
}
```

### Value Mapping (MQTT ↔ HomeKit)

```typescript
// String to boolean mapping
const mapping = new Map([['ON', true], ['OFF', false]]);
const monitor = new MappingCharacteristicMonitor(property, service, char, mapping);

// Numeric scaling (0-254 → 0-100)
const monitor = new NumericCharacteristicMonitor(property, service, char, 0, 254, 0, 100);
```

### Configuration Options

```typescript
// Register config tag in constructor
converterConfigRegistry.registerConverterConfiguration('mytag', isValidConfig);

// Read config in createServicesFromExposes
const config = accessory.getConverterConfiguration('mytag');
```

## Pull Request Checklist

When making changes, ensure:

- [ ] All tests pass: `npm test`
- [ ] No lint errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Unit tests added for new functionality
- [ ] Documentation updated (if user-facing)
- [ ] `CHANGELOG.md` updated under `[Unreleased]`

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/platform.ts` | Main platform, MQTT handling, device discovery |
| `src/platformAccessory.ts` | Per-device wrapper, service creation orchestration |
| `src/z2mModels.ts` | TypeScript types for Z2M exposes data |
| `src/converters/interfaces.ts` | Core interfaces (ServiceCreator, ServiceHandler) |
| `src/converters/creators.ts` | ServiceCreatorManager singleton |
| `src/converters/monitor.ts` | Characteristic value transformation |
| `test/testHelpers.ts` | Test utilities and ServiceHandlersTestHarness |
| `config.schema.json` | Homebridge UI configuration schema |
| `generate-docs.sh` | Documentation and test fixture generation |

## Exposes Access Levels

The `access` field in exposes is a bitmask:

```typescript
const PUBLISHED = 0x1;  // Device publishes this value
const SET = 0x2;        // Can be written via MQTT
const GET = 0x4;        // Can be read via MQTT GET

// Common combinations:
// access: 7 (0x7) = PUBLISHED | SET | GET (full read/write)
// access: 5 (0x5) = PUBLISHED | GET (read-only)
// access: 1 (0x1) = PUBLISHED only (status only)
```

## External References

- [Architecture Documentation](docs/architecture.md) - Detailed internal architecture
- [Homebridge Developer Docs](https://developers.homebridge.io/)
- [Zigbee2MQTT Documentation](https://www.zigbee2mqtt.io/)
- [HAP-NodeJS](https://github.com/homebridge/HAP-NodeJS) - HomeKit implementation
