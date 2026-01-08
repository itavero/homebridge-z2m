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

#### Produced Energy (In Scope)
| Property | Description | Unit |
|----------|-------------|------|
| `produced_energy` | Energy fed back to grid (solar) | kWh |
| `energy_produced` | Alternative naming (same meaning) | kWh |

#### Extended Properties (Lower Priority - Future Work)
| Property | Description | Unit |
|----------|-------------|------|
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
| UUID | Name | Format | Z2M Properties |
|------|------|--------|----------------|
| E863F10D-079E-48FF-8F27-9C2605A29F52 | Watt (Consumption) | FLOAT | power, active_power, load |
| E863F10A-079E-48FF-8F27-9C2605A29F52 | Volt | FLOAT | voltage, mains_voltage, rms_voltage |
| E863F126-079E-48FF-8F27-9C2605A29F52 | Ampere | FLOAT | current |
| E863F10C-079E-48FF-8F27-9C2605A29F52 | Kilowatt-hour (Consumed) | FLOAT | energy, consumed_energy, energy_consumed, energy_wh |
| E863F10C-079E-48FF-8F27-9C2605A29F52 | Kilowatt-hour (Produced) | FLOAT | produced_energy, energy_produced |

Note: Consumed and Produced energy use the same UUID but different service subtypes ("consumed" vs "produced") to distinguish them in HomeKit.

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

// Custom service UUID (from homebridge-3em-energy-meter, proven in Eve app)
const ELECTRICAL_SERVICE_UUID = '00000001-0000-1777-8000-775D67EC4377';

// Eve Characteristic UUIDs (well-established)
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

**Note on Service UUID choice:**
- HomeKit has no native "power meter" service type
- **homebridge-p1** (by ebaauw, well-regarded implementation) uses standard **Outlet service** (`00000047-0000-1000-8000-0026BB765291`)
- **Eve Energy** also uses the standard Outlet service with custom Eve characteristics
- `homebridge-3em-energy-meter` uses a custom UUID (`00000001-0000-1777-8000-775D67EC4377`)
- The Air Pressure sensor uses `E863F00A` (Eve Weather service) but this is semantically for weather sensors

**Recommendation:** Either approach works:
- **Option A (Outlet service):** Following homebridge-p1 and Eve Energy. Most compatible, but semantically implies "outlet".
- **Option B (Custom UUID):** Following homebridge-3em-energy-meter. Cleaner for pure meters, proven to work in Eve app.

For this implementation, we'll use **Option B** (custom UUID `00000001-0000-1777-8000-775D67EC4377`) since many Z2M devices are pure meters without on/off control.

See: [homebridge-p1](https://github.com/ebaauw/homebridge-p1), [homebridge-3em-energy-meter](https://github.com/produdegr/homebridge-3em-energy-meter), [Eve characteristics gist](https://gist.github.com/gomfunkel/b1a046d729757120907c)

### Step 2: Handler Implementation Details

The handler should:
1. Filter exposes using **allowlist matching** on `expose.name`:
   - **Power**: `power`, `active_power`, `load`
   - **Voltage**: `voltage`, `mains_voltage`, `rms_voltage`
   - **Current**: `current`
   - **Energy (consumed)**: `energy`, `consumed_energy`, `energy_consumed`, `energy_wh`
   - **Energy (produced)**: `produced_energy`, `energy_produced` (creates separate service)
   - Verify `type === 'numeric'` and `access` includes PUBLISHED (0x1)
   - This avoids false matches like `power_outage_memory` or `current_heating_setpoint`
2. Group them by endpoint (for multi-endpoint devices)
3. Create one ElectricalSensor service per endpoint (plus separate service for produced energy if present)
4. Add only the characteristics that the device actually exposes
5. Configure appropriate min/max ranges from expose metadata
6. Use `PassthroughCharacteristicMonitor` for direct value pass-through (values are already in correct units)

### Step 3: Register Creator (`src/converters/creators.ts`)

Add `ElectricalSensorCreator` to the `constructors` array after `BasicSensorCreator`.

### Step 4: Unit Tests (`test/electrical.spec.ts`)

Test cases:
1. Service creation with all four properties (power, voltage, current, energy)
2. Service creation with only power property
3. Service creation with power + energy (common case)
4. State updates for each property type
5. Multi-endpoint device handling
6. Range handling from expose metadata
7. Fallback property names (e.g., `active_power` → Power characteristic)
8. Produced energy creates separate service from consumed energy
9. Device with both `energy` and `produced_energy` creates two energy services

## Implementation Order

1. Create the electrical sensor handler and creator
2. Register the creator in `creators.ts`
3. Create test fixtures (device exposes JSON)
4. Write unit tests
5. Test with actual device (if available)

## Scope Boundaries

### In Scope (Phase 1)
- **Core properties**: `power`, `voltage`, `current`, `energy` (exact matches plus fallback names)
- **Produced energy**: `produced_energy`, `energy_produced` (as separate characteristic from consumed)
- Eve app compatibility through custom UUIDs
- Multi-endpoint device support (e.g., multi-gang switches with individual power monitoring)
- Proper characteristic ranges from device exposes

### Out of Scope (Future Enhancements)
- **3-phase support**: `power_l1`, `voltage_phase_a`, `current_a`, etc. (requires separate services per phase)
- **Extended metrics**: `reactive_power`, `power_factor`, `power_apparent`
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

### Devices with Produced Energy (In Scope)

**39 devices** expose produced energy for bidirectional monitoring (e.g., solar feed-in):
- Bituo Technik power meters (11 devices) - full bidirectional metering
- TuYa DIN rail meters (14 devices) - SPM/SDM series, bidirectional meters
- Shelly switches (4 devices) - multi-channel with solar monitoring
- ShinaSystem (2 devices) - PMM-300Z2/Z3
- Others: Frient EMIZB-151, NodOn SEM-4-1-00, Bosch BSP-FD, Datek HSE2905E, Nous D5Z, Ourtop ATMS10013Z3

These devices will get **both** a "Consumed Energy" and "Produced Energy" service in HomeKit.

### Devices with Extended Properties (Future Enhancement)

Additional devices have extended properties (`power_factor`, `power_apparent`, etc.) not included in Phase 1:
- Third Reality plugs (5 devices) - `power_factor`
- Legrand (4 devices) - `power_apparent`
- Some of the above bidirectional meters also expose `power_factor`

## Key Implementation Details

### Expose Structure: `name` vs `property` vs `endpoint`

In Zigbee2MQTT exposes, there's an important distinction between fields:

```typescript
// Multi-endpoint device (e.g., Aeotec ZGA003 - 2-channel switch)
{
  "name": "power",           // Generic type - use for MATCHING
  "endpoint": "1",           // Channel identifier - use for GROUPING
  "property": "power_1",     // Actual MQTT state key - use for READING VALUES
  "type": "numeric",
  "unit": "W"
}

// Single-endpoint device (e.g., TuYa TS011F_plug_1)
{
  "name": "power",           // Generic type
  "property": "power",       // No endpoint suffix
  "type": "numeric",
  "unit": "W"
}

// Aggregate measurement device (e.g., Aqara LLKZMK11LM - 2 relays, 1 meter)
{
  "name": "power",           // Single power measurement for both relays
  "property": "power",       // No endpoint - measures total
  "type": "numeric",
  "unit": "W"
}
```

**Implementation implications:**
1. **Match on `name`** - Check if `expose.name` is exactly `"power"`, `"voltage"`, `"current"`, or `"energy"`
2. **Group by `endpoint`** - Use existing `groupByEndpoint()` helper to create separate services per endpoint
3. **Read from `property`** - Use `expose.property` (e.g., `"power_1"`, `"power_2"`) in `PassthroughCharacteristicMonitor`

This pattern already exists in `BasicSensorCreator` and ensures multi-channel devices get separate electrical sensors per channel.

### Property Names with Fallbacks

Some devices use alternative property names instead of the standard ones. **17 devices** need fallback support:

| Characteristic | Primary | Fallbacks (in order) | Devices Affected |
|----------------|---------|----------------------|------------------|
| Power | `power` | `active_power`, `load` | 4 devices |
| Voltage | `voltage` | `mains_voltage`, `rms_voltage` | 10 devices |
| Current | `current` | *(none needed)* | 0 devices |
| Energy (consumed) | `energy` | `consumed_energy`, `energy_consumed`, `energy_wh` | 3 devices |

**Devices requiring fallbacks:**
- `perenio/pehpl0x` - uses `active_power`, `rms_voltage`, `consumed_energy`
- `tuya/zb-sm` - uses `active_power`
- `efekta/*` (9 devices) - use `mains_voltage`
- `ctm_lyng/mtouch_one`, `elko/4523430` - use `load` (may have different semantics)
- `powernity/po-boco-elec` - uses `energy_consumed`
- `tuya/mg-gpo04zslp` - uses `energy_wh`

**Implementation approach:**
```typescript
// Define property names with fallbacks (first match wins)
const POWER_NAMES = ['power', 'active_power', 'load'];
const VOLTAGE_NAMES = ['voltage', 'mains_voltage', 'rms_voltage'];
const CURRENT_NAMES = ['current'];  // No fallbacks needed
const ENERGY_CONSUMED_NAMES = ['energy', 'consumed_energy', 'energy_consumed', 'energy_wh'];

// Find first matching expose for each characteristic
const findExpose = (exposes, names) =>
  exposes.find(e => names.includes(e.name) && e.type === 'numeric');
```

**Note:** Devices with BOTH primary and fallback names (e.g., Bituo Technik with `power` + `total_power`) will correctly use the primary name due to the precedence order.

### Produced Energy (Separate Characteristic)

Some bidirectional energy meters expose **both** consumed and produced energy. These are NOT alternatives for each other - they measure different things and should both be exposed when present:
- **Consumed energy** (`energy`, `consumed_energy`, etc.) - Energy drawn from grid
- **Produced energy** (`produced_energy`, `energy_produced`) - Energy fed back to grid (e.g., solar)

**39 devices** expose produced energy, including:
- Bituo Technik (11 devices) - SPM/SDM series power meters
- TuYa (14 devices) - DIN rail meters, bidirectional meters
- Shelly (4 devices) - Multi-channel switches with solar monitoring
- ShinaSystem PMM-300Z2/Z3 - Power meters
- Frient EMIZB-151 - Smart meter interface
- NodOn SEM-4-1-00 - Multi-channel energy meter
- Bosch BSP-FD - Smart plug
- Datek HSE2905E - Energy monitor
- Nous D5Z - Smart meter
- Ourtop ATMS10013Z3 - 3-phase meter

**Implementation approach (following water/gas leak pattern):**

Similar to how `WaterLeakSensorHandler` and `GasLeakSensorHandler` both extend `LeakSensorHandler` with different subtypes, we'll create:

```typescript
// Property names for produced energy
const ENERGY_PRODUCED_NAMES = ['produced_energy', 'energy_produced'];

// Separate handlers with different subtypes
class EnergyConsumedHandler extends ElectricalEnergyHandler {
  static readonly exposesNames = ['energy', 'consumed_energy', 'energy_consumed', 'energy_wh'];
  static readonly SUBTYPE = 'consumed';
}

class EnergyProducedHandler extends ElectricalEnergyHandler {
  static readonly exposesNames = ['produced_energy', 'energy_produced'];
  static readonly SUBTYPE = 'produced';
}
```

Both use the same Eve kWh characteristic UUID (E863F10C), but have different service subtypes so HomeKit shows them as separate services with distinguishable names (e.g., "Consumed Energy" and "Produced Energy").

When a device exposes both `energy` AND `produced_energy`, both handlers will create services, giving the user visibility into bidirectional energy flow.

### Property Matching (Exact Match Required)

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
