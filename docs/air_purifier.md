# Air Purifier
If the device definition from Zigbee2MQTT contains one or more `exposes` entries of type `fan` that include a `state` feature, an [Air Purifier](https://developers.homebridge.io/#/service/AirPurifier) service will be created.
The table below shows how the features within the `fan` composite expose and top-level exposes are mapped to characteristics.

| Name | Type | Required access | Characteristic | Remarks |
|-|-|-|-|-|
| `state` (inside `fan`) | binary | published | [Active](https://developers.homebridge.io/#/characteristic/Active) + [Current Air Purifier State](https://developers.homebridge.io/#/characteristic/CurrentAirPurifierState) | **Required**. `ON` maps to Active/Purifying, `OFF` to Inactive |
| `mode` (inside `fan`) | enum | published | [Target Air Purifier State](https://developers.homebridge.io/#/characteristic/TargetAirPurifierState) | `auto` maps to Auto, other values map to Manual |
| `fan_speed` (top-level) | numeric | published | [Rotation Speed](https://developers.homebridge.io/#/characteristic/RotationSpeed) | Optional. Read-only values are scaled to 0–100%. Setting from HomeKit sends the corresponding numeric `fan_mode` value when available |
| `replace_filter` (top-level) | binary | published | [Filter Change Indication](https://developers.homebridge.io/#/characteristic/FilterChangeIndication) on [Filter Maintenance](https://developers.homebridge.io/#/service/FilterMaintenance) | `true` maps to _Change Filter_; `false` maps to _Filter OK_ |

## Setting fan speed from HomeKit

When numeric `fan_mode` values are available, [Rotation Speed](https://developers.homebridge.io/#/characteristic/RotationSpeed) can be controlled from HomeKit and is translated to the closest numeric mode.
Setting Rotation Speed to 0 sends the fan `state` OFF.

## Remarks

* Exposes not mapped to HomeKit: `air_quality`, `led_enable`, `child_lock`, `filter_age`, `identify`.
