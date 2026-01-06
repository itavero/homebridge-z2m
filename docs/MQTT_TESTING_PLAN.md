# MQTT Smoke Test Infrastructure Plan

## Executive Summary

This plan outlines a **system-level smoke test** that actually runs Homebridge with the plugin, connected to a mock MQTT broker simulating Zigbee2MQTT. This validates that the plugin starts correctly and creates the expected accessories - a true integration/smoke test, not Jest-based unit tests.

---

## Goals

1. **Validate Plugin Startup**: Confirm the plugin initializes when Homebridge starts
2. **Validate MQTT Connection**: Plugin connects to broker and subscribes to topics
3. **Validate Accessory Creation**: Correct HomeKit accessories are created from mock devices
4. **CI Integration**: Run as a GitHub Actions verification step on every PR/push
5. **Local Development**: Easy for developers (including AI coding agents) to run

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Smoke Test Runner Script                      │
│                    (scripts/smoke-test.ts)                       │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Aedes MQTT     │  │   Homebridge    │  │   Validation    │
│  Broker         │◄─┤   Process       │  │   Logic         │
│  (in-process)   │  │   (child proc)  │  │   (log parser)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│  Z2M Message    │  │  Test Config    │
│  Simulator      │  │  (config.json)  │
└─────────────────┘  └─────────────────┘
```

---

## Components

### 1. Test Configuration (`test/smoke/config.json`)

Minimal Homebridge config that loads only this plugin:

```json
{
  "bridge": {
    "name": "Homebridge Z2M Smoke Test",
    "username": "CC:22:3D:E3:CE:30",
    "port": 51827,
    "pin": "031-45-154"
  },
  "platforms": [
    {
      "platform": "zigbee2mqtt",
      "mqtt": {
        "base_topic": "zigbee2mqtt",
        "server": "mqtt://localhost:1883"
      }
    }
  ]
}
```

### 2. Mock Device Fixtures (`test/smoke/fixtures/`)

Pre-built Zigbee2MQTT message payloads:

```
test/smoke/fixtures/
  bridge-info.json          # Z2M version info
  bridge-devices.json       # Device list with exposes
  bridge-groups.json        # Empty groups array
  device-states/
    motion-sensor.json      # Aqara motion sensor state
    light-bulb.json         # Philips Hue bulb state
    temperature-sensor.json # Temperature/humidity sensor
```

**Example `bridge-devices.json`** (derived from existing test exposes):
```json
[
  {
    "ieee_address": "0x00158d0001234567",
    "friendly_name": "living_room_motion",
    "supported": true,
    "definition": {
      "vendor": "Aqara",
      "model": "RTCGQ11LM",
      "exposes": [/* from test/exposes/aqara/rtcgq11lm.json */]
    }
  },
  {
    "ieee_address": "0x00178d0009876543",
    "friendly_name": "bedroom_light",
    "supported": true,
    "definition": {
      "vendor": "Philips",
      "model": "8718696449691",
      "exposes": [/* from test/exposes/philips/8718696449691.json */]
    }
  }
]
```

### 3. MQTT Broker + Z2M Simulator (`test/smoke/z2m-mock.ts`)

Single script that:
- Starts Aedes MQTT broker on port 1883
- Waits for plugin to connect and subscribe
- Publishes Z2M messages in correct sequence

```typescript
import Aedes from 'aedes';
import { createServer, Server } from 'net';
import { readFileSync } from 'fs';

export class Z2mMockBroker {
  private aedes: Aedes;
  private server: Server;
  private baseTopic = 'zigbee2mqtt';

  async start(port = 1883): Promise<void> {
    this.aedes = new Aedes();
    this.server = createServer(this.aedes.handle);

    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`[Z2M Mock] MQTT broker started on port ${port}`);
        resolve();
      });
    });
  }

  // Wait for the plugin to subscribe to our topics
  waitForSubscription(timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Subscription timeout')), timeout);

      this.aedes.on('subscribe', (subscriptions, client) => {
        const hasZ2mSubscription = subscriptions.some(
          s => s.topic === `${this.baseTopic}/#`
        );
        if (hasZ2mSubscription) {
          clearTimeout(timer);
          console.log(`[Z2M Mock] Plugin subscribed to ${this.baseTopic}/#`);
          resolve();
        }
      });
    });
  }

  // Simulate Z2M startup sequence
  async simulateZ2mStartup(): Promise<void> {
    // 1. Bridge comes online
    this.publish('bridge/state', 'online');
    await this.delay(100);

    // 2. Send bridge info
    const info = JSON.parse(readFileSync('test/smoke/fixtures/bridge-info.json', 'utf8'));
    this.publish('bridge/info', info);
    await this.delay(100);

    // 3. Send device list
    const devices = JSON.parse(readFileSync('test/smoke/fixtures/bridge-devices.json', 'utf8'));
    this.publish('bridge/devices', devices);
    await this.delay(100);

    // 4. Send groups (empty)
    this.publish('bridge/groups', []);
    await this.delay(100);

    // 5. Send initial device states
    this.publish('living_room_motion', { occupancy: false, battery: 95 });
    this.publish('bedroom_light', { state: 'OFF', brightness: 254 });

    console.log('[Z2M Mock] Startup sequence complete');
  }

  private publish(topic: string, payload: unknown): void {
    const fullTopic = `${this.baseTopic}/${topic}`;
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.aedes.publish({
      topic: fullTopic,
      payload: Buffer.from(message),
      qos: 0,
      retain: false,
      cmd: 'publish',
      dup: false,
    }, () => {});
    console.log(`[Z2M Mock] Published: ${fullTopic}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.aedes.close(() => resolve());
      });
    });
  }
}
```

### 4. Smoke Test Runner (`scripts/smoke-test.ts`)

Main orchestration script:

```typescript
#!/usr/bin/env npx ts-node
import { spawn, ChildProcess } from 'child_process';
import { Z2mMockBroker } from '../test/smoke/z2m-mock';

interface TestResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  accessoriesCreated: string[];
}

async function runSmokeTest(): Promise<TestResult> {
  const result: TestResult = {
    success: false,
    errors: [],
    warnings: [],
    accessoriesCreated: [],
  };

  const broker = new Z2mMockBroker();
  let homebridge: ChildProcess | null = null;

  try {
    // Step 1: Start mock MQTT broker
    console.log('Starting mock MQTT broker...');
    await broker.start(1883);

    // Step 2: Start Homebridge
    console.log('Starting Homebridge...');
    homebridge = spawn('npx', [
      'homebridge',
      '-I',  // Insecure mode (no pairing required)
      '-D',  // Debug logging
      '-U', './test/smoke',  // Config directory
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    // Step 3: Wait for plugin to subscribe
    const subscriptionPromise = broker.waitForSubscription(15000);

    // Collect and parse Homebridge output
    let output = '';
    homebridge.stdout?.on('data', (data) => {
      const line = data.toString();
      output += line;
      process.stdout.write(line);

      // Parse for success indicators
      if (line.includes('accessory') && line.includes('added')) {
        const match = line.match(/\[([^\]]+)\]/);
        if (match) result.accessoriesCreated.push(match[1]);
      }
      if (line.includes('error') || line.includes('Error')) {
        result.errors.push(line.trim());
      }
    });

    homebridge.stderr?.on('data', (data) => {
      const line = data.toString();
      process.stderr.write(line);
      result.errors.push(line.trim());
    });

    // Wait for subscription
    await subscriptionPromise;

    // Step 4: Simulate Z2M startup
    console.log('Simulating Zigbee2MQTT startup...');
    await broker.simulateZ2mStartup();

    // Step 5: Wait for plugin to process devices
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 6: Validate results
    result.success =
      result.errors.length === 0 &&
      result.accessoriesCreated.length > 0;

  } catch (error) {
    result.errors.push(String(error));
  } finally {
    // Cleanup
    if (homebridge) {
      homebridge.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    await broker.stop();
  }

  return result;
}

// Main execution
runSmokeTest().then((result) => {
  console.log('\n=== SMOKE TEST RESULTS ===');
  console.log(`Success: ${result.success}`);
  console.log(`Accessories created: ${result.accessoriesCreated.length}`);
  result.accessoriesCreated.forEach(a => console.log(`  - ${a}`));

  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach(e => console.log(`  - ${e}`));
  }

  process.exit(result.success ? 0 : 1);
});
```

---

## GitHub Actions Integration

### Option A: Add to Existing Workflow

```yaml
# .github/workflows/verify.yml
jobs:
  build:
    # ... existing steps ...

  smoke-test:
    name: Smoke Test
    runs-on: ubuntu-latest
    needs: build  # Only run if build passes

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Use Node.js 22.x
        uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Smoke Test
        run: npm run smoke-test
        timeout-minutes: 2
```

### Option B: Separate Workflow (for cleaner organization)

```yaml
# .github/workflows/smoke-test.yml
name: Smoke Test

on:
  push:
    branches: [master, main]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  smoke-test:
    name: Integration Smoke Test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - run: npm ci
      - run: npm run build

      - name: Run Smoke Test
        run: npm run smoke-test
        timeout-minutes: 2
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "smoke-test": "npm run build && ts-node scripts/smoke-test.ts",
    "smoke-test:debug": "npm run build && DEBUG=* ts-node scripts/smoke-test.ts"
  }
}
```

---

## File Structure

```
homebridge-z2m/
├── scripts/
│   └── smoke-test.ts           # Main test runner
├── test/
│   └── smoke/
│       ├── config.json         # Homebridge test config
│       ├── z2m-mock.ts         # Aedes broker + Z2M simulator
│       ├── fixtures/
│       │   ├── bridge-info.json
│       │   ├── bridge-devices.json
│       │   ├── bridge-groups.json
│       │   └── device-states/
│       │       ├── motion-sensor.json
│       │       ├── light-bulb.json
│       │       └── temperature-sensor.json
│       └── persist/            # Homebridge cache dir (gitignored)
│           └── .gitkeep
└── .github/
    └── workflows/
        └── verify.yml          # Updated with smoke-test job
```

---

## Success Criteria

The smoke test **passes** if:

1. ✅ Mock MQTT broker starts successfully
2. ✅ Homebridge process starts without crashing
3. ✅ Plugin connects and subscribes to `zigbee2mqtt/#`
4. ✅ Plugin receives `bridge/devices` and creates accessories
5. ✅ At least 1 accessory is registered (parsed from logs)
6. ✅ No error messages in stdout/stderr
7. ✅ Clean shutdown within timeout

The smoke test **fails** if:

- ❌ Homebridge crashes or exits with non-zero code
- ❌ Plugin fails to connect to MQTT within 15 seconds
- ❌ No accessories created after receiving device list
- ❌ Error messages detected in output
- ❌ Timeout exceeded (2 minutes)

---

## Dependencies to Add

```json
{
  "devDependencies": {
    "aedes": "^0.51.0",
    "@types/aedes": "^0.48.0"
  }
}
```

---

## Constraints & Considerations

### For AI Coding Agents
- **No Docker required**: Aedes runs as pure Node.js
- **Single command**: `npm run smoke-test`
- **Clear output**: Pass/fail with accessory count
- **Fast**: Should complete in under 30 seconds

### For GitHub Actions
- **No service containers**: Aedes runs in-process
- **Timeout protection**: 2-minute limit prevents hanging
- **Exit codes**: 0 for success, 1 for failure
- **Node version matrix**: Can run on 20.x, 22.x, 24.x

### Port Conflicts
- Uses port 1883 for MQTT (standard)
- Uses port 51827 for Homebridge HAP
- Both are ephemeral in test context

---

## Future Enhancements

1. **Device Interaction Tests**: After startup, simulate HomeKit commands and verify MQTT messages are published to `device/set`

2. **Reconnection Testing**: Kill and restart the mock broker to test reconnection logic

3. **Multiple Device Types**: Expand fixtures to cover more device categories (covers, climate, locks)

4. **Performance Metrics**: Log time to first accessory creation

5. **Visual Report**: Generate HTML report with timeline

---

## Open Questions

1. **Homebridge Version**: Should we test against Homebridge 1.x and 2.x beta?
   - *Recommendation*: Start with latest stable, add matrix later

2. **Log Parsing Robustness**: How to reliably detect accessory creation from logs?
   - *Recommendation*: Look for specific plugin log patterns, document expected format

3. **Parallel Execution**: Can multiple smoke tests run in parallel (different ports)?
   - *Recommendation*: Use random ports if needed for parallel CI jobs

---

## Sources

- [Aedes MQTT Broker](https://github.com/moscajs/aedes)
- [Homebridge Verified Plugin Requirements](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
- [homebridge-mqttthing test config](https://github.com/arachnetech/homebridge-mqttthing/blob/master/test/config.json)
- [Smoke Testing in CI/CD](https://circleci.com/blog/smoke-tests-in-cicd-pipelines/)
