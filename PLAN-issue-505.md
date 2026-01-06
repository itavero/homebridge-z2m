# Implementation Plan: Expose Power Readings to HomeKit (Issue #505)

## Overview

Add support for exposing electrical measurements (power, voltage, current, energy) from Zigbee2MQTT devices to HomeKit using Eve-compatible custom characteristics. This enables devices like the TuYa TS011F_plug_1 to show power consumption in the Eve app.

## Background

### Current State
- The plugin maps Zigbee2MQTT device "exposes" to HomeKit services/characteristics
- Custom characteristics are already used (e.g., Air Pressure sensor uses Eve UUIDs)
- No power/electrical measurement support currently exists

### Zigbee2MQTT Exposes for Power Devices
Power monitoring devices expose these numeric properties:
- `power` - Active power in Watts (W)
- `voltage` - Voltage in Volts (V)
- `current` - Current in Amperes (A)
- `energy` - Total energy consumed in kWh

### Eve HomeKit Characteristics (for Eve app compatibility)
| UUID | Name | Format | Z2M Property |
|------|------|--------|--------------|
| E863F10D-079E-48FF-8F27-9C2605A29F52 | Watt (Consumption) | FLOAT | power |
| E863F10A-079E-48FF-8F27-9C2605A29F52 | Volt | FLOAT | voltage |
| E863F126-079E-48FF-8F27-9C2605A29F52 | Ampere | FLOAT | current |
| E863F10C-079E-48FF-8F27-9C2605A29F52 | Kilowatt-hour (Total Consumption) | FLOAT | energy |

## Implementation Approach

### Design Decision: Standalone Electrical Sensor Service

Create a new dedicated "Electrical Sensor" service using a custom Eve-compatible service UUID, similar to how Air Pressure is implemented. This approach:

1. **Works for any device** - Not just switches/outlets, but any device that reports power metrics
2. **Follows existing patterns** - Similar to `AirPressureSensorHandler`
3. **Eve app compatible** - Uses Eve's custom UUIDs for proper display
4. **Grouped characteristics** - All electrical metrics on one service for cleaner organization

### Alternative Considered (Not Recommended)
Adding power characteristics directly to Switch/Outlet services was considered but rejected because:
- Not all power-monitoring devices are switches (some are just meters)
- Complicates the switch converter significantly
- Harder to maintain and test

## Files to Create/Modify

### New Files

1. **`src/converters/electrical.ts`** - Main creator and handlers
   - `ElectricalSensorCreator` - ServiceCreator implementation
   - `ElectricalSensorHandler` - ServiceHandler implementation
   - Custom Eve-compatible service and characteristics

2. **`test/electrical.spec.ts`** - Unit tests
   - Service creation tests
   - State update tests for all electrical properties

3. **`test/exposes/tuya/ts011f_plug_1.json`** - Test fixture
   - Example device exposes for TuYa smart plug

### Modified Files

4. **`src/converters/creators.ts`**
   - Add `ElectricalSensorCreator` to the constructors array

## Detailed Implementation

### Step 1: Create Electrical Sensor Handler (`src/converters/electrical.ts`)

```typescript
// Key components:

// Custom Eve UUIDs
const ELECTRICAL_SERVICE_UUID = 'E863F00A-079E-48FF-8F27-9C2605A29F52'; // Same as Air Pressure (Eve Sensor)
const CHARACTERISTIC_WATT_UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
const CHARACTERISTIC_VOLT_UUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52';
const CHARACTERISTIC_AMPERE_UUID = 'E863F126-079E-48FF-8F27-9C2605A29F52';
const CHARACTERISTIC_KWH_UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';

// ServiceCreator that filters for power/voltage/current/energy exposes
// ServiceHandler that:
//   - Creates a custom Eve-compatible service
//   - Adds characteristics for each available electrical property
//   - Uses PassthroughCharacteristicMonitor for value updates
```

### Step 2: Handler Implementation Details

The handler should:
1. Filter exposes for properties named `power`, `voltage`, `current`, or `energy`
2. Group them by endpoint (for multi-endpoint devices)
3. Create one ElectricalSensor service per endpoint
4. Add only the characteristics that the device actually exposes
5. Configure appropriate min/max ranges from expose metadata

### Step 3: Register Creator (`src/converters/creators.ts`)

Add `ElectricalSensorCreator` to the `constructors` array after `BasicSensorCreator`.

### Step 4: Unit Tests (`test/electrical.spec.ts`)

Test cases:
1. Service creation with all four properties
2. Service creation with only power property
3. Service creation with power + energy (common case)
4. State updates for each property type
5. Multi-endpoint device handling
6. Range handling from expose metadata

## Implementation Order

1. Create the electrical sensor handler and creator
2. Register the creator in `creators.ts`
3. Create test fixtures (device exposes JSON)
4. Write unit tests
5. Test with actual device (if available)

## Scope Boundaries

### In Scope
- Power (W), Voltage (V), Current (A), Energy (kWh) characteristics
- Eve app compatibility through custom UUIDs
- Multi-endpoint device support
- Proper characteristic ranges from device exposes

### Out of Scope (Future Enhancements)
- FakeGato historical data support (mentioned in issue but requires significant additional work)
- Power factor, reactive power, apparent power (less common)
- Cost calculation features

## Testing Strategy

1. **Unit Tests**: Verify service creation and state updates using existing test harness
2. **Manual Testing**: If contributor has the TuYa TS011F_plug_1 or similar device
3. **Eve App Verification**: Confirm readings display correctly in Eve app

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Eve app may not recognize custom service | Use proven Eve UUIDs from other plugins |
| Device may report unexpected values | Use range auto-adjustment from monitor.ts |
| Performance impact from additional handlers | Minimal - only creates service if device exposes power properties |

## References

- [Eve Services & Characteristics](https://gist.github.com/simont77/3f4d4330fa55b83f8ca96388d9004e7d)
- [FakeGato Wiki](https://github.com/simont77/fakegato-history/wiki/Services-and-characteristics-for-Elgato-Eve-devices)
- Similar implementation: `src/converters/basic_sensors/air_pressure.ts`
