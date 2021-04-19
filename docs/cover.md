# Window Cover
If the device definition from Zigbee2MQTT contains one or more `exposes` entries of type `cover` that at least have a feature named `position`, a [Window Covering](https://developers.homebridge.io/#/service/WindowCovering) service will be created.
The table below shows how the different features within this `exposes` entry are mapped to characteristics.

| Name | Required access | Characteristic | Remarks |
|-|-|-|-|
| `position` | published, set | [Current Position](https://developers.homebridge.io/#/characteristic/CurrentPosition) (for the value from MQTT),<br>[Target Position](https://developers.homebridge.io/#/characteristic/TargetPosition) (for the value set from HomeKit) | Required |
| `tilt` | published, set | [Current Horizontal Tilt Angle](https://developers.homebridge.io/#/characteristic/CurrentHorizontalTiltAngle) (for the value from MQTT),<br>[Target Horizontal Tilt Angle](https://developers.homebridge.io/#/characteristic/TargetHorizontalTiltAngle) (for the value set from HomeKit)| Optional |

The required [Position State](https://developers.homebridge.io/#/characteristic/PositionState) characteristic is determined by comparing consecutive received positions.

After changing the _Target Position_, the plugin will try to request the updated `position` every few seconds, until it does not receive an update or it receives the same value twice in a row.