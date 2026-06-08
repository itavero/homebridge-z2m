# Air Purifier
If the device definition from Zigbee2MQTT contains one or more `exposes` entries of type `fan` that include a `state` feature, an [Air Purifier](https://developers.homebridge.io/#/service/AirPurifier) service will be created.
The table below shows how the features within the `fan` composite expose and top-level exposes are mapped to characteristics.

| Name | Type | Required access | Characteristic | Remarks |
|-|-|-|-|-|
| `state` (inside `fan`) | binary | published | [Active](https://developers.homebridge.io/#/characteristic/Active) + [Current Air Purifier State](https://developers.homebridge.io/#/characteristic/CurrentAirPurifierState) | **Required**. `ON` maps to Active/Purifying, `OFF` to Inactive |
| `mode` (inside `fan`) | enum | published, set | [Target Air Purifier State](https://developers.homebridge.io/#/characteristic/TargetAirPurifierState) | `auto` maps to Auto, numeric values (`1`-`9`) map to Manual |
| `fan_speed` (top-level) | numeric | published | [Rotation Speed](https://developers.homebridge.io/#/characteristic/RotationSpeed) | Read-only. Values 0–9 are scaled to 0–100%. Setting rotation speed via HomeKit sends a `fan_mode` command |
| `replace_filter` (top-level) | binary | published | [Contact Sensor State](https://developers.homebridge.io/#/characteristic/ContactSensorState) (separate Contact Sensor service) | `true` (filter needs replacement) maps to Contact Not Detected; `false` maps to Contact Detected |

## Setting fan speed from HomeKit

Because `fan_speed` is a read-only reported value (the device reports the current speed), setting [Rotation Speed](https://developers.homebridge.io/#/characteristic/RotationSpeed) from HomeKit sends a `fan_mode` command with the corresponding numeric level (1–9). Setting Rotation Speed to 0 sends `fan_state: OFF`.

When switching Target Air Purifier State from Auto to Manual, the last known numeric mode is restored.

## Remarks

* Exposes not mapped to HomeKit: `air_quality`, `led_enable`, `child_lock`, `filter_age`, `identify`.
* The `replace_filter` binary expose is created as a separate [Contact Sensor](https://developers.homebridge.io/#/service/ContactSensor) service, making it visible as a sensor trigger in HomeKit automations.
