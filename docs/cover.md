# Window Cover
If the device definition from Zigbee2MQTT contains one or more `exposes` entries of type `cover` that at least have a feature named `position`, a [Window Covering](https://developers.homebridge.io/#/service/WindowCovering) service will be created.
The table below shows how the different features within this `exposes` entry are mapped to characteristics.

| Name | Required access | Characteristic | Remarks |
|-|-|-|-|
| `position` | published, set | [Current Position](https://developers.homebridge.io/#/characteristic/CurrentPosition) (for the value from MQTT),<br>[Target Position](https://developers.homebridge.io/#/characteristic/TargetPosition) (for the value set from HomeKit) | Required (unless `tilt` is present) |
| `tilt` | published, set | [Current Horizontal Tilt Angle](https://developers.homebridge.io/#/characteristic/CurrentHorizontalTiltAngle) (for the value from MQTT),<br>[Target Horizontal Tilt Angle](https://developers.homebridge.io/#/characteristic/TargetHorizontalTiltAngle) (for the value set from HomeKit)| Optional. Will be used as _Current Position_ if `position` is not available. |

If the device definition also provides a `motor_state`, it will be used to update the required [Position State](https://developers.homebridge.io/#/characteristic/PositionState) characteristic.

If `motor_state` is not provided, the [Position State](https://developers.homebridge.io/#/characteristic/PositionState) characteristic is set when the _Target Position_ is changed or when an `position` is received from MQTT (and the movement is assumed to be stopped).
Additionally, if the `position` can be _get_, the plugin will try to get frequent updates, after changing the _Target Position_. If the same position is reported twice, movement is assumed to be stopped.
