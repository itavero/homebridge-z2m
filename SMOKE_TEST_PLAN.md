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

**Minimal approach**: Start with 1-2 devices to validate basic functionality. Expand later as needed.

```
test/smoke/fixtures/
  bridge-info.json          # Z2M version info (version, config)
  bridge-devices.json       # Minimal device list (1-2 devices)
```

**`bridge-info.json`**:
```json
{
  "version": "1.40.0",
  "commit": "unknown",
  "coordinator": { "type": "zStack3x0", "meta": {} },
  "config": {}
}
```

**`bridge-devices.json`** (1 light, 1 sensor - from existing test exposes):
```json
[
  {
    "ieee_address": "0x00178d0009876543",
    "friendly_name": "test_light",
    "supported": true,
    "definition": {
      "vendor": "Philips",
      "model": "8718696449691",
      "exposes": [/* from test/exposes/philips/8718696449691.json */]
    }
  },
  {
    "ieee_address": "0x00158d0001234567",
    "friendly_name": "test_sensor",
    "supported": true,
    "definition": {
      "vendor": "Aqara",
      "model": "WSDCGQ11LM",
      "exposes": [/* from test/exposes/aqara/wsdcgq12lm.json */]
    }
  }
]
```

Groups are sent as an empty array `[]` by the mock server.

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

Main orchestration script with random port allocation:

```typescript
#!/usr/bin/env npx ts-node
import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'net';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { AddressInfo } from 'net';
import { Z2mMockBroker } from '../test/smoke/z2m-mock';

interface TestResult {
  success: boolean;
  errors: string[];
  accessoriesCreated: string[];
  mqttConnected: boolean;
}

// Get a random available port
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

// Generate temporary config directory with dynamic ports
async function generateTestConfig(mqttPort: number, hapPort: number): Promise<string> {
  const config = {
    bridge: {
      name: "Homebridge Z2M Smoke Test",
      username: "CC:22:3D:E3:CE:30",
      port: hapPort,
      pin: "031-45-154"
    },
    platforms: [{
      platform: "zigbee2mqtt",
      mqtt: {
        base_topic: "zigbee2mqtt",
        server: `mqtt://localhost:${mqttPort}`
      }
    }]
  };

  const tempDir = await mkdtemp(join(tmpdir(), 'hb-z2m-smoke-'));
  await writeFile(join(tempDir, 'config.json'), JSON.stringify(config, null, 2));
  return tempDir;
}

async function runSmokeTest(): Promise<TestResult> {
  const result: TestResult = {
    success: false,
    errors: [],
    accessoriesCreated: [],
    mqttConnected: false,
  };

  // Allocate random ports
  const mqttPort = await getAvailablePort();
  const hapPort = await getAvailablePort();
  console.log(`Using ports - MQTT: ${mqttPort}, HAP: ${hapPort}`);

  // Generate temp config
  const configDir = await generateTestConfig(mqttPort, hapPort);
  console.log(`Config directory: ${configDir}`);

  const broker = new Z2mMockBroker();
  let homebridge: ChildProcess | null = null;

  try {
    // Step 1: Start mock MQTT broker
    console.log('Starting mock MQTT broker...');
    await broker.start(mqttPort);

    // Step 2: Start Homebridge
    console.log('Starting Homebridge...');
    homebridge = spawn('npx', [
      'homebridge',
      '-I',  // Insecure mode (no pairing required)
      '-D',  // Debug logging
      '-U', configDir,  // Temp config directory
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    // Step 3: Wait for plugin to subscribe
    const subscriptionPromise = broker.waitForSubscription(15000);

    // Collect and parse Homebridge output
    homebridge.stdout?.on('data', (data) => {
      const line = data.toString();
      process.stdout.write(line);

      // Detect MQTT connection
      if (/\[zigbee2mqtt\].*Connected/i.test(line)) {
        result.mqttConnected = true;
      }

      // Detect accessory registration (friendly names in brackets)
      const accessoryMatch = line.match(/\[([^\]]+)\].*(?:Configuring|registered)/i);
      if (accessoryMatch && accessoryMatch[1] !== 'zigbee2mqtt') {
        result.accessoriesCreated.push(accessoryMatch[1]);
      }

      // Detect errors (but ignore "error" in device names)
      if (/\[zigbee2mqtt\].*(?:error|Error|ERROR)/.test(line)) {
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
    console.log('Plugin subscribed to MQTT topics');

    // Step 4: Simulate Z2M startup
    console.log('Simulating Zigbee2MQTT startup...');
    await broker.simulateZ2mStartup();

    // Step 5: Wait for plugin to process devices
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 6: Validate results
    result.success =
      result.mqttConnected &&
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
    await rm(configDir, { recursive: true, force: true });
  }

  return result;
}

// Main execution
runSmokeTest().then((result) => {
  console.log('\n=== SMOKE TEST RESULTS ===');
  console.log(`MQTT Connected: ${result.mqttConnected}`);
  console.log(`Accessories created: ${result.accessoriesCreated.length}`);
  result.accessoriesCreated.forEach(a => console.log(`  - ${a}`));

  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach(e => console.log(`  - ${e}`));
  }

  console.log(`\nResult: ${result.success ? 'PASS ✓' : 'FAIL ✗'}`);
  process.exit(result.success ? 0 : 1);
});
```

---

## GitHub Actions Integration

Separate workflow file for the smoke test, using current LTS Node version:

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
          node-version: 22.x  # Current LTS

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
├── .smoketest/                 # Isolated Homebridge installation (gitignored)
│   ├── package.json
│   └── node_modules/
│       └── homebridge/
├── scripts/
│   ├── smoke-test.ts           # Main test runner
│   └── setup-smoke-test.ts     # Sets up .smoketest/ directory
├── test/
│   └── smoke/
│       ├── z2m-mock.ts         # Aedes broker + Z2M simulator
│       └── fixtures/
│           ├── bridge-info.json
│           └── bridge-devices.json  # Minimal: 1-2 devices
└── .github/
    └── workflows/
        └── smoke-test.yml      # Separate workflow for smoke test
```

**Notes**:
- `.smoketest/` is gitignored and created by setup script
- Homebridge config is generated at runtime in temp directory with random ports
- Fixtures start minimal (1-2 devices), can expand later

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

### Separate Homebridge Installation

The smoke test uses a **dedicated Homebridge installation** in `.smoketest/`, completely isolated from the development devDependencies. This ensures:

- **Reproducibility**: Same Homebridge version across all test runs
- **Isolation**: Development can use any Homebridge version (including 2.x beta)
- **No conflicts**: Test installation doesn't affect `node_modules/`

**Setup approach** (run once or as pre-test step):

```bash
# Create isolated test environment
mkdir -p .smoketest
cd .smoketest
npm init -y
npm install homebridge@1.8.5  # Latest stable
cd ..
```

**Add to `.gitignore`**:
```
.smoketest/
```

The test runner uses the isolated installation:

```typescript
homebridge = spawn('node', [
  '.smoketest/node_modules/homebridge/lib/cli.js',
  '-I',
  '-D',
  '-U', configDir,
  '-P', process.cwd(),  // Plugin path (current project)
], { /* ... */ });
```

A setup script (`scripts/setup-smoke-test.ts`) will handle creating/updating the `.smoketest/` directory if needed.

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

## Design Decisions

### 1. Homebridge Version: Separate Test Installation

**Decision**: Install a specific stable Homebridge version to `.smoketest/` directory, isolated from devDependencies.

```
.smoketest/
├── package.json
└── node_modules/
    └── homebridge@1.8.5
```

This approach:
- Keeps development devDependencies unchanged (can use 2.x beta for types)
- Provides reproducible test results with pinned stable version
- Isolates test environment completely from development

Version matrix testing can be added later if needed.

### 2. Log Parsing: Use Homebridge's Bracket Prefix Format

**Decision**: Parse logs using Homebridge's standard `[name]` prefix format.

Homebridge prefixes log entries with the plugin or accessory name in brackets:
```
[zigbee2mqtt] Connecting to MQTT server at mqtt://localhost:1883
[zigbee2mqtt] Connected to MQTT broker
[living_room_motion] Initializing accessory...
[bedroom_light] Initializing accessory...
```

**Detection patterns**:
```typescript
// Plugin connected
/\[zigbee2mqtt\].*Connected/i

// Accessory registered (look for device friendly names)
/\[([^\]]+)\].*(?:Initializing|registered|added)/i

// Errors
/\[zigbee2mqtt\].*(?:error|Error|ERROR)/
```

### 3. Random Ports: Generate Temporary Configuration

**Decision**: Use random available ports and generate config at runtime.

Benefits:
- Avoids conflicts with running Homebridge instances
- Allows parallel test execution
- Validates port availability before starting

```typescript
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

async function generateTestConfig(mqttPort: number, hapPort: number): Promise<string> {
  const config = {
    bridge: {
      name: "Homebridge Z2M Smoke Test",
      username: "CC:22:3D:E3:CE:30",
      port: hapPort,
      pin: "031-45-154"
    },
    platforms: [{
      platform: "zigbee2mqtt",
      mqtt: {
        base_topic: "zigbee2mqtt",
        server: `mqtt://localhost:${mqttPort}`
      }
    }]
  };

  const tempDir = await mkdtemp(join(tmpdir(), 'hb-z2m-smoke-'));
  const configPath = join(tempDir, 'config.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
  return tempDir;
}
```

The temp directory is cleaned up after the test completes.

---

## Sources

- [Aedes MQTT Broker](https://github.com/moscajs/aedes)
- [Homebridge Verified Plugin Requirements](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
- [homebridge-mqttthing test config](https://github.com/arachnetech/homebridge-mqttthing/blob/master/test/config.json)
- [Smoke Testing in CI/CD](https://circleci.com/blog/smoke-tests-in-cicd-pipelines/)
