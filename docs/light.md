# Light
If the device definition from Zigbee2MQTT contains one or more `exposes` entries of type `light` that at least have a feature named `state` (i.e. on/off), a [Lightbulb](https://developers.homebridge.io/#/service/Lightbulb) service will be created.
The table below shows how the different features within this `exposes` entry are mapped to characteristics.

| Name | Required access | Characteristic | Remarks |
|-|-|-|-|
| `state` | published, set | [On](https://developers.homebridge.io/#/characteristic/On) | Required |
| `brightness` | published, set | [Brightness](https://developers.homebridge.io/#/characteristic/Brightness) | |
| `color_temp` | published, set | [Color Temperature](https://developers.homebridge.io/#/characteristic/ColorTemperature) | |
| `color_hs` | published, set | [Hue](https://developers.homebridge.io/#/characteristic/Hue) and [Saturation](https://developers.homebridge.io/#/characteristic/Saturation) | Requires nested features `hue` and `saturation`. Preferred over `color_xy`. |
| `color_xy` | published, set | [Hue](https://developers.homebridge.io/#/characteristic/Hue) and [Saturation](https://developers.homebridge.io/#/characteristic/Saturation) | Requires nested features `x` and `y`. Values translated by plugin. |

## Converter specific configuration (`light`)

- `adaptive_lighting`: Set to `true` to enable [Adaptive Lighting](https://support.apple.com/guide/iphone/control-accessories-iph0a717a8fd/ios#iph79e72e212). Apple requires a home hub for Adaptive Lighting to work. This feature is only available for lights that expose a *Color Temperature* characteristic.

```json
{
  "converters": {
    "light": {
      "adaptive_lighting": true
    }
  }
}
```
