#!/usr/bin/env ts-node
/* eslint-disable no-console */
/**
 * Smoke test runner for homebridge-z2m.
 * Starts a mock MQTT broker simulating Zigbee2MQTT and runs Homebridge
 * to validate the plugin starts correctly and creates accessories.
 */

import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'net';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AddressInfo } from 'net';
import { Z2mMockBroker } from '../test/smoke/z2m-mock';

const SMOKETEST_DIR = join(__dirname, '..', '.smoketest');
const PROJECT_DIR = join(__dirname, '..');

// Timeout constants
/** Time to wait for plugin to subscribe to MQTT topics after Homebridge starts */
const SUBSCRIPTION_TIMEOUT_MS = 15000;
/** Time to wait for plugin to process devices and create accessories after Z2M startup */
const ACCESSORY_CREATION_WAIT_MS = 5000;
/** Time to wait for Homebridge to shut down gracefully after SIGTERM */
const SHUTDOWN_GRACE_PERIOD_MS = 1000;

interface TestResult {
  success: boolean;
  errors: string[];
  accessoriesCreated: string[];
  mqttConnected: boolean;
  z2mOnline: boolean;
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

async function generateTestConfig(mqttPort: number, hapPort: number): Promise<string> {
  const config = {
    bridge: {
      name: 'Homebridge Z2M Smoke Test',
      username: 'CC:22:3D:E3:CE:30',
      port: hapPort,
      pin: '031-45-154',
    },
    platforms: [
      {
        platform: 'zigbee2mqtt',
        mqtt: {
          base_topic: 'zigbee2mqtt',
          server: `mqtt://localhost:${mqttPort}`,
        },
      },
    ],
  };

  const tempDir = await mkdtemp(join(tmpdir(), 'hb-z2m-smoke-'));
  await writeFile(join(tempDir, 'config.json'), JSON.stringify(config, null, 2));
  return tempDir;
}

async function ensureSmokeTestSetup(): Promise<void> {
  const homebridgeBin = join(SMOKETEST_DIR, 'node_modules', '.bin', 'homebridge');

  if (!existsSync(homebridgeBin)) {
    console.log('Smoke test environment not set up. Running setup...');
    const { execSync } = await import('child_process');
    execSync('npm run smoke-test:setup', { cwd: PROJECT_DIR, stdio: 'inherit' });
  }
}

async function runSmokeTest(): Promise<TestResult> {
  const result: TestResult = {
    success: false,
    errors: [],
    accessoriesCreated: [],
    mqttConnected: false,
    z2mOnline: false,
  };

  // Ensure setup is complete
  await ensureSmokeTestSetup();

  const broker = new Z2mMockBroker();
  let homebridge: ChildProcess | null = null;
  let configDir = '';

  try {
    // Step 1: Start mock MQTT broker (port 0 = auto-assign to avoid TOCTOU race)
    console.log('[Smoke Test] Starting mock MQTT broker...');
    const mqttPort = await broker.start(0);

    // Step 2: Allocate HAP port and generate config
    const hapPort = await getAvailablePort();
    console.log(`\n[Smoke Test] Using ports - MQTT: ${mqttPort}, HAP: ${hapPort}`);

    configDir = await generateTestConfig(mqttPort, hapPort);
    console.log(`[Smoke Test] Config directory: ${configDir}`);

    // Step 3: Start Homebridge from isolated installation
    console.log('[Smoke Test] Starting Homebridge...');
    const homebridgeBin = join(SMOKETEST_DIR, 'node_modules', '.bin', 'homebridge');

    homebridge = spawn(
      homebridgeBin,
      [
        '-I', // Insecure mode (no pairing required)
        '-D', // Debug logging
        '-U',
        configDir, // Config directory
        '-P',
        PROJECT_DIR, // Plugin path (current project)
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
      }
    );

    // Step 4: Set up log parsing
    const subscriptionPromise = broker.waitForSubscription(SUBSCRIPTION_TIMEOUT_MS);

    homebridge.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        process.stdout.write(`  ${line}\n`);

        // Detect MQTT connection
        if (/\[zigbee2mqtt\].*Connected to MQTT/i.test(line)) {
          result.mqttConnected = true;
        }

        // Detect Z2M online
        if (/\[zigbee2mqtt\].*Zigbee2MQTT.*online/i.test(line)) {
          result.z2mOnline = true;
        }

        // Detect accessory creation - look for "New accessory:" pattern
        const newAccessoryMatch = line.match(/\[zigbee2mqtt\].*New accessory:\s*(\S+)/i);
        if (newAccessoryMatch && !result.accessoriesCreated.includes(newAccessoryMatch[1])) {
          result.accessoriesCreated.push(newAccessoryMatch[1]);
        }

        // Detect errors from the plugin (but not general debug messages)
        if (/\[zigbee2mqtt\].*(?:ERROR|Error:)/i.test(line)) {
          result.errors.push(line.trim());
        }
      }
    });

    homebridge.stderr?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
        process.stderr.write(`  [stderr] ${line}\n`);
        // Ignore Homebridge 2.0 notice and empty lines
        if (!line.includes('Homebridge 2.0') && !line.includes('NOTICE TO USERS') && line.length > 10) {
          result.errors.push(line);
        }
      }
    });

    // Handle process exit
    homebridge.on('exit', (code) => {
      // Code 143 = SIGTERM (128 + 15), which is expected when we kill the process
      if (code !== null && code !== 0 && code !== 143) {
        result.errors.push(`Homebridge exited with code ${code}`);
      }
    });

    // Step 5: Wait for plugin to subscribe
    await subscriptionPromise;
    console.log('[Smoke Test] Plugin subscribed to MQTT topics');

    // Step 6: Simulate Z2M startup
    console.log('[Smoke Test] Simulating Zigbee2MQTT startup...');
    await broker.simulateZ2mStartup();

    // Step 7: Wait for plugin to process devices
    console.log('[Smoke Test] Waiting for accessory creation...');
    await new Promise((resolve) => setTimeout(resolve, ACCESSORY_CREATION_WAIT_MS));

    // Step 8: Validate results
    result.success = result.mqttConnected && result.z2mOnline && result.errors.length === 0 && result.accessoriesCreated.length > 0;
  } catch (error) {
    result.errors.push(String(error));
  } finally {
    // Cleanup
    if (homebridge) {
      console.log('[Smoke Test] Stopping Homebridge...');
      homebridge.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_PERIOD_MS));
    }
    await broker.stop();
    if (configDir) {
      await rm(configDir, { recursive: true, force: true });
    }
  }

  return result;
}

// Main execution
console.log('='.repeat(60));
console.log('  HOMEBRIDGE-Z2M SMOKE TEST');
console.log('='.repeat(60));

runSmokeTest().then((result) => {
  console.log('\n' + '='.repeat(60));
  console.log('  SMOKE TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`  MQTT Connected:      ${result.mqttConnected ? 'YES' : 'NO'}`);
  console.log(`  Z2M Online:          ${result.z2mOnline ? 'YES' : 'NO'}`);
  console.log(`  Accessories Created: ${result.accessoriesCreated.length}`);

  if (result.accessoriesCreated.length > 0) {
    result.accessoriesCreated.forEach((a) => console.log(`    - ${a}`));
  }

  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.length}`);
    result.errors.forEach((e) => console.log(`    - ${e}`));
  }

  console.log('='.repeat(60));
  console.log(`  Result: ${result.success ? 'PASS' : 'FAIL'}`);
  console.log('='.repeat(60));

  process.exit(result.success ? 0 : 1);
});
