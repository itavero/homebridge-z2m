# Switch
If the device definition from Zigbee2MQTT contains one or more `exposes` entries of type `switch` that at least have a feature named `state` (i.e. on/off), a [Switch](https://developers.homebridge.io/#/service/Switch) service will be created.
The table below shows how the different features within this `exposes` entry are mapped to characteristics.

| Name | Required access | Characteristic | Remarks |
|-|-|-|-|
| `state` | published, set | [On](https://developers.homebridge.io/#/characteristic/On) | Required |
