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

- `adaptive_lighting`: [Adaptive Lighting](https://support.apple.com/guide/iphone/control-accessories-iph0a717a8fd/ios#iph79e72e212) is **enabled by default** for lights that expose a *Color Temperature* characteristic. Apple requires a home hub for Adaptive Lighting to work.
  Set to `false` to disable Adaptive Lighting.
  Additionally you can configure the following options for Adaptive Lighting:
  - `enabled`: Set to `false` to disable Adaptive Lighting. Defaults to `true`.
  - `only_when_on`: Only update the color temperature when the light is on. Defaults to `true`.
  - `transition`: Transition time (in seconds) to send along with the color temperature change when the light is on. If not defined, `transition` will not be sent.
  - `min_delta`: Minimum difference in color temperature (in mired) before sending an update to the light. Useful for reducing MQTT traffic. Defaults to `1`.

  When disabling Adaptive Lighting, the cached controller is automatically removed on the next Homebridge restart. You no longer need to manually clear the accessory cache.
- `request_brightness`: Set to `true` to allow the brightness to be requested (if possible). Defaults to `false`, as this can cause issues when the light is off.

```json
{
  "converters": {
    "light": {
      "adaptive_lighting": {
        "enabled": true,
        "only_when_on": true,
        "transition": 1,
        "min_delta": 10
      },
      "request_brightness": false
    }
  }
}
```

To disable Adaptive Lighting:
```json
{
  "converters": {
    "light": {
      "adaptive_lighting": false
    }
  }
}
```
