# Plugin configuration ⚙️
The plugin can also be configured via the web interface provided by [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x#readme).

A possible configuration looks like this:
```json
{
   "platform": "zigbee2mqtt",
   "mqtt": {
      "base_topic": "zigbee2mqtt",
      "server": "mqtt://localhost:1883"
   },
   "log": {
      "mqtt_publish": "debug",
      "debug_as_info": false
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
         "excluded_endpoints": [
            "l2"
         ],
         "converters": {
            "switch": {
               "type": "outlet"
            }
         }
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

# Logging
Within the `log` object, you can configure the logging level for certain parts of the plugin.
The available log levels are `error`, `warn`, `info` and `debug`.

Currently, the following can be configured:
* `mqtt_publish`: The log level for MQTT messages that are published by the plugin. (default: `debug`)

Additionally, you can have all debugging messages be output to the `info` level instead, by setting `debug_as_info` to `true`. This can be useful if you only want to see debug messages from this plugin and not from all plugins on your Homebridge instance.

### Disable QoS for published MQTT messages
Some MQTT brokers do not have support for QoS. If the QoS Levels sent by this plugin are leading to problems, you can force the plugin to disable this for all messages (i.e. set the QoS level to 0) by setting the `disable_qos` to `true`.
By default, this option is set to `false`. Note: this option does **not** exist in Zigbee2MQTT itself.

## Devices {#devices}
Within the `devices` array, you can set options for specific devices, based on their IEEE addresses (`0x1234567890abcdef`) or the `friendly_name`.
This identifier should be put in the `id` property.

Currently the following options are available:
* `exclude`: if set to `true` this device will not be fully ignored.
* `ignore_availability`: If set to `true`, the availability information provided by Zigbee2MQTT for this device will be ignored by the plugin.
* `ignore_z2m_online`: If set to `true`, the online/offline information of Zigbee2MQTT will be ignored. This means the device might show up as available, even though Zigbee2MQTT is offline or the connection to the MQTT broker is lost.
* `excluded_keys`: an array of properties/keys (known as the `property` in the exposes information) that should be ignored/excluded for this device.
* `included_keys`: an array of properties/keys (known as the `property` in the exposes information) that should be included for this device, even if they are excluded in the global default device configuration (see below).
* `excluded_endpoints`: an array of endpoints that should be ignored/excluded for this device. To ignore properties without an endpoint, add `''` (empty string) to the array.
* `values`: Per property, you can specify an include and/or exclude list to ignore certain values. The values may start or end with an asterisk (`*`) as a wildcard.
* `exposes`: An array of exposes information, using the [structures defined by Zigbee2MQTT](https://www.zigbee2mqtt.io/guide/usage/exposes.html).
* `converters`: An object to optionally provide additional configuration for specific converters. More information can be found in the documentation of the [converters](converters.md), if applicable.

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

## Support for groups
Groups defined in Zigbee2MQTT will automatically be exposed as a single accessory, so they can be controlled as if they were a single device.
Using the friendly name of a group or its ID, you can set also set the [Device options](config.md#devices) shown above
for a particular group. Overriding the `exposes` information, might be of use if homebridge-z2m is not able to determine the correct information on its own.

You can use the `exclude_grouped_devices` config option shown above to automatically
exclude devices that are part of a group. That way they will only be exposed as a grouped device, and not as a singular device plus a group.
You can override `exclude_grouped_devices` by setting `exclude` to `false` for the devices that you still want to show up in HomeKit as a
"singular" device.

## Experimental features/changes {#experimental}
These features/changes can be enabled from the configuration, either globally or (in some cases) for specific devices.
Experimental features must be explicitly enabled from the configuration before they can be used.

> ⚠️ Experimental features are **EXPERIMENTAL**. Things might break or not behave the way you are used to.

In the latest (or next) release the following features can be enabled:

| Flag | Global | Device | Description |
| ---- | ------ | ------ | ----------- |
| `AVAILABILITY` | ✅ | ✅ | Enable Availability feature. Without this flag, the logic will still be executed, except for changing the status of characteristics. (see [#56](https://github.com/itavero/homebridge-z2m/issues/56) / [#593](https://github.com/itavero/homebridge-z2m/issues/593)) |
