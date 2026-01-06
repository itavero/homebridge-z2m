# Implementation Plan: Expose Power Readings to HomeKit (Issue #505)

## Overview

Add support for exposing electrical measurements (power, voltage, current, energy) from Zigbee2MQTT devices to HomeKit using Eve-compatible custom characteristics. This enables devices like the TuYa TS011F_plug_1 to show power consumption in the Eve app.

## Background

### Current State
- The plugin maps Zigbee2MQTT device "exposes" to HomeKit services/characteristics
- Custom characteristics are already used (e.g., Air Pressure sensor uses Eve UUIDs)
- No power/electrical measurement support currently exists

### Zigbee2MQTT Exposes for Power Devices

#### Core Properties (Single-Phase Devices)
| Property | Description | Unit |
|----------|-------------|------|
| `power` | Instantaneous measured power | W |
| `voltage` | Measured electrical potential | V |
| `current` | Instantaneous measured electrical current | A |
| `energy` | Sum of consumed energy | kWh |

#### Multi-Phase Properties (3-Phase Meters)
Multi-phase devices use suffixes for per-phase measurements. Three naming conventions exist:
- `_l1`, `_l2`, `_l3` (e.g., `power_l1`, `voltage_l1`)
- `_phase_a`, `_phase_b`, `_phase_c` (e.g., `power_phase_a`, `voltage_phase_a`)
- `_a`, `_b`, `_c` (e.g., `voltage_a`, `current_a`)

#### Extended Properties (Lower Priority - Future Work)
| Property | Description | Unit |
|----------|-------------|------|
| `produced_energy` | Energy fed back to grid (solar) | kWh |
| `power_reactive` / `reactive_power` | Reactive power | VAR |
| `reactive_energy` | Reactive energy | kVArh |
| `power_factor` | Power factor | % |
| `power_apparent` | Apparent power | VA |
| `energy_t1`, `energy_t2`, etc. | Tariff-based energy | kWh |

#### Properties to Exclude (Not Electrical Measurements)
These properties contain "power", "current", "voltage", or "energy" but are NOT electrical measurements:
- `power_outage_memory`, `power_on_behavior`, `power_outage_count` - Device settings
- `current_heating_setpoint`, `current_level_startup` - Thermostat/light settings
- `current_status`, `current_switch`, `current_value`, `current_position` - Status values
- `over_voltage_setting`, `under_voltage_threshold` - Protection settings
- `energy_saving_mode_*` - Device settings

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
1. Filter exposes using an **exact match allowlist** approach:
   - Match ONLY these exact property names: `power`, `voltage`, `current`, `energy`
   - Verify `type === 'numeric'` and `access` includes PUBLISHED (0x1)
   - This avoids false matches like `power_outage_memory` or `current_heating_setpoint`
2. Group them by endpoint (for multi-endpoint devices)
3. Create one ElectricalSensor service per endpoint
4. Add only the characteristics that the device actually exposes
5. Configure appropriate min/max ranges from expose metadata
6. Use `PassthroughCharacteristicMonitor` for direct value pass-through (values are already in correct units)

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

### In Scope (Phase 1)
- **Core properties only**: `power`, `voltage`, `current`, `energy` (exact matches)
- Eve app compatibility through custom UUIDs
- Multi-endpoint device support (e.g., multi-gang switches with individual power monitoring)
- Proper characteristic ranges from device exposes

### Out of Scope (Future Enhancements)
- **3-phase support**: `power_l1`, `voltage_phase_a`, `current_a`, etc. (requires separate services per phase)
- **Extended metrics**: `produced_energy`, `reactive_power`, `power_factor`, `power_apparent`
- **Tariff-based energy**: `energy_t1`, `energy_t2`, etc.
- **FakeGato historical data** (mentioned in issue but requires separate dependency and significant work)
- **Cost calculation features**

### Device Coverage Analysis

Based on the exposes analysis, this implementation will support **677 unique devices**:

| Property | Device Count |
|----------|-------------|
| `power` | 399 devices |
| `voltage` | 540 devices |
| `current` | 267 devices |
| `energy` | 348 devices |

Common device types from **120+ vendors**:
- Smart plugs (TuYa, Xiaomi, Aqara, Innr, Ledvance, etc.)
- Smart switches with power monitoring (Aqara, Shelly, Sinope, etc.)
- Dedicated power meters (Develco, Frient, Bituo Technik, etc.)
- Smart outlets (Aurora, Heiman, Third Reality, etc.)
- DIN rail meters (Tongou, Schneider Electric, etc.)

See [AFFECTED-DEVICES.md](AFFECTED-DEVICES.md) for the complete device list.

### Devices with Extended Properties (Future Enhancement)

**54 devices** have extended properties (`produced_energy`, `power_factor`, `power_apparent`, etc.):
- Bituo Technik power meters (11 devices) - full bidirectional metering
- Tuya DIN rail meters (SDM/SPM series) - `produced_energy`, `power_factor`
- Shelly switches (4 devices) - `produced_energy` for solar monitoring
- Third Reality plugs (5 devices) - `power_factor`
- Legrand (4 devices) - `power_apparent`
- NodOn SEM-4-1-00 - `produced_energy`, `power_factor`

These could benefit from a Phase 2 enhancement to expose bidirectional energy monitoring.

## Key Implementation Detail: Property Matching

The critical implementation detail is using **exact string matching** for property names, not substring/regex matching:

```typescript
// CORRECT: Exact match only
const ELECTRICAL_PROPERTIES = ['power', 'voltage', 'current', 'energy'];
const isElectricalProperty = (expose) =>
  ELECTRICAL_PROPERTIES.includes(expose.name) &&
  expose.type === 'numeric' &&
  (expose.access & 0x1) !== 0; // PUBLISHED

// WRONG: Would match power_outage_memory, current_heating_setpoint, etc.
const isElectricalProperty = (expose) =>
  expose.name.includes('power') || expose.name.includes('current');
```

This ensures we don't create spurious electrical sensors for:
- `power_outage_memory` (enum, not a measurement)
- `current_heating_setpoint` (thermostat setting)
- `power_on_behavior` (device configuration)

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
