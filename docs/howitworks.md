# How it works (in a nutshell)
The plugin listens to the [MQTT messages](https://www.zigbee2mqtt.io/information/mqtt_topics_and_message_structure.html) published by Zigbee2MQTT.
It detects the devices using the `zigbee2mqtt/bridge/devices` topic.

The device definition provided by Zigbee2MQTT contains a list of exposed attributes, which this plugin uses to determine which HomeKit services and characteristics to expose.

This plugin should work with most lights, switches and sensors.
For more information on which attributes are supported and how they are mapped, please refer to the documentation in the `docs` folder.

## Groups

> ⚠️ **Experimental feature**: This feature has to be enabled in the [Configuration](config.md#experimental).

Within Zigbee2MQTT, you can [group devices](https://www.zigbee2mqtt.io/guide/usage/groups.html#configuration) so they can be controlled with a single Zigbee command.
If groups are configured, homebridge-z2m will try to determine the features (a.k.a. `exposes` entries) that devices in the group have in common and create an additional HomeKit accessory based on that information.

These accessories can be configured just like other devices, meaning that you can add additional configuration in the JSON config via the `friendly_name` or `id` of the group.

The `exposes` information that is used for these devices is logged to the _Debug_ log of Homebridge. This can also be tweaked/fine-tuned and provided manually via the device configuration.
