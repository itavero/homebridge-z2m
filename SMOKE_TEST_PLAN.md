# Smoke Test Infrastructure

System-level smoke test that runs Homebridge with the plugin against a mock MQTT broker simulating Zigbee2MQTT.

## Quick Start

```bash
# Run the smoke test (includes build)
npm run smoke-test

# Setup only (install isolated Homebridge)
npm run smoke-test:setup
```

## How It Works

1. **Mock MQTT Broker** - Aedes broker starts on a random port
2. **Homebridge Process** - Spawned with the plugin loaded
3. **Z2M Simulation** - Publishes bridge/state, bridge/info, bridge/devices
4. **Validation** - Parses logs for MQTT connection and accessory creation

## Files

```
scripts/
  smoke-test.ts          # Main test runner
  setup-smoke-test.ts    # Creates .smoketest/ with Homebridge 1.8.5
test/smoke/
  z2m-mock.ts            # Aedes broker + Z2M message simulator
  fixtures/
    bridge-info.json     # Z2M version info
    bridge-devices.json  # Test devices (1 light, 1 sensor)
.smoketest/              # Isolated Homebridge installation (gitignored)
```

## Success Criteria

The test **passes** if:
- Plugin connects to MQTT and subscribes to `zigbee2mqtt/#`
- At least one accessory is created from the mock devices
- No errors in stdout/stderr

## CI Integration

The smoke test runs on every PR via `.github/workflows/smoke-test.yml` with Node 22.x (Homebridge 1.8.5 requirement).
