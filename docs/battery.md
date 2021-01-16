# Battery Service
If the device definition from Zigbee2MQTT contains at least one of the `exposes` entries listed in the table below, a [Battery Service](https://developers.homebridge.io/#/service/BatteryService) service will be created.

| Name | Type | Required access | Characteristic | Remarks |
|-|-|-|-|-|
| `battery` | numeric | published | [Battery Level](https://developers.homebridge.io/#/characteristic/BatteryLevel) | If `battery_low` is not present, this property will also be used to indicate a low battery if the value gets below 30%. |
| `battery_low` | binary | published | [Status Low Battery](https://developers.homebridge.io/#/characteristic/StatusLowBattery) | If `battery` is not present, the binary value of this property will be used to fake a battery level. If it is true, it will report a level of 0%. If it is false, it will be 100%. |

Note that the required [Charging State](https://developers.homebridge.io/#/characteristic/ChargingState) characteristic will currently always report `NOT_CHARGEABLE`, as the Zigbee2MQTT does not (yet) provide an common property to detect if a device is charging or not (and therefor if it is chargeable).