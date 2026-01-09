# Electrical Measurements

Devices that expose electrical measurement properties (`power`, `voltage`, `current`, `energy`, or `produced_energy`) will have these values exposed to HomeKit using custom Eve-compatible characteristics.

These characteristics are visible in apps that support custom HomeKit characteristics, such as the [Eve app](https://apps.apple.com/app/eve-for-homekit/id917695792).

## Supported Properties

The following table shows the supported exposes entries and the corresponding characteristics:

| Expose Name | Alternative Names | Characteristic Name | Characteristic UUID | Unit |
|-------------|-------------------|---------------------|---------------------|------|
| `power` | `active_power`, `load` | Consumption | `E863F10D-079E-48FF-8F27-9C2605A29F52` | W |
| `voltage` | `mains_voltage`, `rms_voltage` | Voltage | `E863F10A-079E-48FF-8F27-9C2605A29F52` | V |
| `current` | - | Current | `E863F126-079E-48FF-8F27-9C2605A29F52` | A |
| `energy` | `consumed_energy`, `energy_consumed`, `energy_wh` | Total Consumption | `E863F10C-079E-48FF-8F27-9C2605A29F52` | kWh |
| `produced_energy` | `energy_produced` | Total Production | `E863F10C-079E-48FF-8F27-9C2605A29F52` | kWh |

## Service UUID

All electrical characteristics are added to a custom service with UUID `00000001-0000-1777-8000-775D67EC4377`.

## Produced Energy

For devices that support bidirectional energy measurement (such as solar inverters), the `produced_energy` property is exposed as a separate service to distinguish it from consumed energy.

## Multi-Endpoint Devices

For devices with multiple endpoints (e.g., multi-gang power monitoring switches), a separate electrical sensor service will be created for each endpoint.
