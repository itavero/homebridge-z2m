# How it works (in a nutshell)
The plugin listens to the [MQTT messages](https://www.zigbee2mqtt.io/information/mqtt_topics_and_message_structure.html) published by Zigbee2MQTT.
It detects the devices using the `zigbee2mqtt/bridge/devices` topic.

The device definition provided by Zigbee2MQTT contains a list of exposed attributes, which this plugin uses to determine which HomeKit services and characteristics to expose.

This plugin should work with most lights, switches and sensors.
For more information on which attributes are supported and how they are mapped, please refer to the documentation in the `docs` folder.