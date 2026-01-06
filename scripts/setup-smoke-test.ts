#!/usr/bin/env ts-node
/* eslint-disable no-console, sonarjs/no-os-command-from-path */
/**
 * Setup script for smoke test environment.
 * Creates an isolated Homebridge installation in .smoketest/ directory.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const SMOKETEST_DIR = join(__dirname, '..', '.smoketest');
const HOMEBRIDGE_VERSION = '1.8.5'; // Pinned stable version

function log(message: string): void {
  console.log(`[Setup] ${message}`);
}

function setupSmokeTestEnvironment(): void {
  log(`Setting up smoke test environment in ${SMOKETEST_DIR}`);

  // Create directory if it doesn't exist
  if (!existsSync(SMOKETEST_DIR)) {
    log('Creating .smoketest directory...');
    mkdirSync(SMOKETEST_DIR, { recursive: true });
  }

  // Check if package.json exists and has correct version
  const packageJsonPath = join(SMOKETEST_DIR, 'package.json');
  let needsInstall = true;

  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (pkg.dependencies?.homebridge === HOMEBRIDGE_VERSION) {
        log(`Homebridge ${HOMEBRIDGE_VERSION} already configured`);

        // Check if node_modules exists
        const homebridgePath = join(SMOKETEST_DIR, 'node_modules', 'homebridge');
        if (existsSync(homebridgePath)) {
          log('Homebridge already installed, skipping npm install');
          needsInstall = false;
        }
      }
    } catch {
      // Invalid package.json, will recreate
    }
  }

  if (needsInstall) {
    // Create package.json
    const packageJson = {
      name: 'homebridge-z2m-smoketest',
      version: '1.0.0',
      private: true,
      description: 'Isolated Homebridge installation for smoke testing',
      dependencies: {
        homebridge: HOMEBRIDGE_VERSION,
      },
    };

    log(`Creating package.json with homebridge@${HOMEBRIDGE_VERSION}...`);
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Run npm install
    log('Installing Homebridge (this may take a moment)...');
    try {
      execSync('npm install --silent', {
        cwd: SMOKETEST_DIR,
        stdio: 'inherit',
      });
      log('Homebridge installed successfully');
    } catch (error) {
      console.error('Failed to install Homebridge:', error);
      process.exit(1);
    }
  }

  // Verify installation
  const homebridgeBin = join(SMOKETEST_DIR, 'node_modules', '.bin', 'homebridge');
  if (!existsSync(homebridgeBin)) {
    console.error(`ERROR: Homebridge CLI not found at ${homebridgeBin}`);
    process.exit(1);
  }

  log('Smoke test environment ready!');
  log(`Homebridge CLI: ${homebridgeBin}`);
}

// Run setup
setupSmokeTestEnvironment();
