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
   "devices": [
      {
         "id": "0x1234567890abcdef",
         "exclude": true
      },
      {
         "id": "0xabcdef1234567890",
         "excluded_keys": [
            "battery"
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
Within the `mqtt` object, you can add pretty much all the configuration options that zigbee2mqtt also has, with the same keys as in the zigbee2mqtt configuration YAML file. Please refer to the [zigbee2mqtt documentation](https://www.zigbee2mqtt.io/information/configuration.html) for more information on the MQTT options. The keys that can be used are:
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

## Devices
Within the `devices` array, you can set options for specific devices, based on their IEEE addresses (`0x1234567890abcdef`) or the `friendly_name`.
Currently the following options are available:
* `exclude`: if set to `true` this device will not be fully ignored.
* `excluded_keys`: an array of properties/keys (known as the `property` in the exposes information) that should be ignored/excluded for this device.
* `values`: Per property, you can specify an include and/or exclude list to ignore certain values. The values may start or end with an asterix (`*`) as a wildcard. This is currently only applied in the [Stateless Programmable Switch](action.md).