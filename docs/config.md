# Plugin configuration ⚙️
The plugin can also be configured via the web interface provided by [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x#readme).

A (rather minimal) configuration looks like this:
```json
{
   "platform": "zigbee2mqtt",
   "mqtt": {
      "base_topic": "zigbee2mqtt",
      "server": "mqtt://localhost:1883"
   },
   "defaults": {
      "excluded_keys": [
         "lqi"
      ]
   },
   "exclude_grouped_devices": false,
   "experimental": [
      "FEATURE_FLAG",
   ],
   "devices": [
      {
         "id": "0x1234567890abcdef",
         "exclude": true,
      },
      {
         "id": "0xabcdef1234567890",
         "excluded_keys": [
            "battery"
         ],
         "experimental": [
            "OTHER_FEATURE_FLAG",
         ]
      },
      {
         "id": "0xabcd1234abcd1234",
         "values": [
            {
                  "property": "action",
                  "exclude": [
                     "*_triple"
                  ]
            }
         ]
      },
      {
         "id": "0x1234abcd1234abcd",
         "values": [
            {
                  "property": "action",
                  "include": [
                     "toggle",
                     "recall_scene_*"
                  ]
            }
         ]
      }
   ]
}
```

## MQTT
Within the `mqtt` object, you can add pretty much all the configuration options that Zigbee2MQTT also has, with the same keys as in the Zigbee2MQTT configuration YAML file. Please refer to the [Zigbee2MQTT documentation](https://www.zigbee2mqtt.io/guide/configuration/mqtt.html) for more information on the MQTT options. The keys that can be used are:
* `base_topic`
* `server`
* `ca`
* `key`
* `cert`
* `user`
* `password`
* `client_id`
* `reject_unauthorized`
* `keepalive`
* `version`

### Disable QoS for published MQTT messages
Some MQTT brokers do not have support for QoS. If the QoS Levels sent by this plugin are leading to problems, you can force the plugin to disable this for all messages (i.e. set the QoS level to 0) by setting the `disable_qos` to `true`.
By default, this option is set to `false`. Note: this option does **not** exist in Zigbee2MQTT itself.

## Devices {#devices}
Within the `devices` array, you can set options for specific devices, based on their IEEE addresses (`0x1234567890abcdef`) or the `friendly_name`.
This identifier should be put in the `id` property.

Currently the following options are available:
* `exclude`: if set to `true` this device will not be fully ignored.
* `excluded_keys`: an array of properties/keys (known as the `property` in the exposes information) that should be ignored/excluded for this device.
* `included_keys`: an array of properties/keys (known as the `property` in the exposes information) that should be included for this device, even if they are excluded in the global default device configuration (see below).
* `values`: Per property, you can specify an include and/or exclude list to ignore certain values. The values may start or end with an asterisk (`*`) as a wildcard. This is currently only applied in the [Stateless Programmable Switch](action.md).
* `exposes`: An array of exposes information, using the [structures defined by Zigbee2MQTT](https://www.zigbee2mqtt.io/guide/usage/exposes.html).

### Defaults
Within the `defaults` property, you can also configure the device specific options mentioned above (except for the `id` and `included_keys`).
If a device does not specify a value for any of the options (properties) mentioned above, the value from the `defaults` property will be used (if any).

The following defaults are set within the plugin itself:
```json
{
   "exclude": false
}
```

For example, to exclude all devices, except a few you want to specifically include, you could do something like:
```json
{
   "platform": "zigbee2mqtt",
   "mqtt": {
      "base_topic": "zigbee2mqtt",
      "server": "mqtt://localhost:1883"
   },
   "defaults": {
      "exclude": true
   },
   "devices": [
      {
         "id": "0x1234567890abcdef",
         "exclude": false
      },
      {
         "id": "0xabcdef1234567890",
         "exclude": false
      }
   ]
}
```

## Experimental features/changes {#experimental}
These features/changes can be enabled from the configuration, either globally or (in some cases) for specific devices.
Experimental features must be explicitly enabled from the configuration before they can be used.

> ⚠️ Experimental features are **EXPERIMENTAL**. Things might break or not behave the way you are used to.

In the latest (or next) release the following features can be enabled:

| Flag | Global | Device | Description |
| ---- | ------ | ------ | ----------- |
| `COLOR_MODE` | ✅ | ✅ | Possible workaround/fix for issue described in issue [#208](https://github.com/itavero/homebridge-z2m/issues/208) |
| `GROUPS` | ✅ | ❌ | Support for controlling Zigbee2MQTT groups (see [#277](https://github.com/itavero/homebridge-z2m/issues/277)) |

### Support for groups
When support for groups (`GROUPS`) is enabled, you can also use the `exclude_grouped_devices` config option shown above to automatically
exclude devices that are part of a group. That way they will only be exposed as a grouped device, and not as a singular device and a group.
You can override `exclude_grouped_devices` by setting `exclude` to `false` for the devices that you still want to show up in HomeKit as a
"singular" device.

Using the friendly name of a group or its ID, you can set also set the [Device options](config.md#devices) shown above
for a particular group.
