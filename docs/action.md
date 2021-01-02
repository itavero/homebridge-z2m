# Stateless Programmable Switch
If the device definition from zigbee2mqtt contains an `action` expose, the provided enum values will be split up across one or more
Stateless Programmable Switch services. The mapping of the values will be shown in the log of homebridge.

The following table show some of the prefixes/suffixes and how they are mapped. The suffixes/prefixes are assumed to be separated from the
rest of the value with an underscore (`_`) or a dash (`-`). The rest of the value is used to group the different actions of the same button
together (if possible/applicable).

| Suffix/Prefix | Event it will be mapped to | Remarks |
|-|-|-|
| `single` | Single Press | |
| `click` | Single Press | |
| `press` | Single Press | |
| `double` | Double Press | |
| `hold` | Long Press | |
| `long` | Long Press | |
| `triple` | Single Press | If present, put in the same service as `quadruple` |
| `tripple` | Single Press | If present, put in the same service as `quadruple` |
| `quadruple` | Double Press | If present, put in the same service as `triple` / `tripple` |
| `release` | ❌ | Values with this suffix/prefix will be ignored. |
| `hold-release` | ❌ | Values with this suffix/prefix will be ignored. |


## Wildcards in exposes information
Some devices don't have a definitive list of possible `action` values in their exposes information yet.
These devices might have a value with an asterix (`*`) in it.

Because of the way this plugin works, it needs to know all definitive values upfront.
This means that it will generate an error in the logs for devices that contain a value with a wildcard.

If you have such a device and wish for it to be supported, please contribute to [zigbee-herdsman-converters](https://github.com/Koenkk/zigbee-herdsman-converters/) by updating the exposes information in `devices.js` with a definitive list of supported values.
Also see [Koenkk/zigbee-herdsman-converters#2012](https://github.com/Koenkk/zigbee-herdsman-converters/issues/2012).


## Green Power devices
Due to the way Green Power devices work, zigbee2mqtt can't really differentiate between different types of Green Power switches (i.e. Hue Tap versus Friends of Hue).
Because of this the Exposes information provided by zigbee2mqtt currently contains all the possible `action` values, of all the Green Power devices that use this same communication interface.

Within HomeKit, this is rather annoying. For instance, with the Hue Tap, you'll end up with tens of switches, even though it only has four buttons.
To improve the experience and usability, it is possible to specify values to include/exclude in the [plugin configuration](config.md).

For the Hue Tap, you might add something like this to the plugin configuration:
```json
{
   "devices": [
      {
         "id": "my_hue_tap",
         "values": [
            {
               "property": "action",
               "include": [
                  "recall_scene_0",
                  "recall_scene_1",
                  "recall_scene_2",
                  "toggle"
               ]
            }
         ]
      }
   ]
}
```
