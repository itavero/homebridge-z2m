# Air Purifier
If the device contains any of the `exposes` mentioned in the following table, an [Air Purifier](https://developers.homebridge.io/#/service/AirPurifier) service will be created.

The required [Current Air Purifier State](https://developers.homebridge.io/#/characteristic/CurrentAirPurifierState) characteristic is always added.
The `fan_state` expose controls both the [Active](https://developers.homebridge.io/#/characteristic/Active) characteristic (power on/off) and the _Current Air Purifier State_.

| Name | Required access | Characteristic | Remarks |
|-|-|-|-|
| `fan_state` | published | [Active](https://developers.homebridge.io/#/characteristic/Active), [Current Air Purifier State](https://developers.homebridge.io/#/characteristic/CurrentAirPurifierState) | Maps `ON` to _Active_ / _Purifying Air_, `OFF` to _Inactive_ / _Idle_. Setting Active from HomeKit sends `ON`/`OFF`. |
| `fan_mode` | published, set | [Target Air Purifier State](https://developers.homebridge.io/#/characteristic/TargetAirPurifierState) | Maps `auto` to _Auto_, other values to _Manual_. |
| `fan_speed` | published, set | [Rotation Speed](https://developers.homebridge.io/#/characteristic/RotationSpeed) | Optional. Numeric value passed through directly. |
| `child_lock` | published, set | [Lock Physical Controls](https://developers.homebridge.io/#/characteristic/LockPhysicalControls) | Optional. Maps `UNLOCK` to _Disabled_, other values to _Enabled_. |
