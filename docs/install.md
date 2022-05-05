# Getting Started

First of all, let's clarify a few names / terminology:

* **Zigbee** is a wireless communication protocol, often used for home automation devices.
* **MQTT** (_Message Queuing Telemetry Transport_) is a standard for transporting messages between devices/applications.
* **MQTT broker** is a server that distributes messages between connected devices/applications.
* **Zigbee2MQTT** is a software package that bridges events and commands from Zigbee to MQTT and vice versa.
* **Homebridge** allows you to integrate HomeKit with smart home devices that do not natively support HomeKit.
* **homebridge-z2m** is a plugin for _Homebridge_ that integrates devices paired to _Zigbee2MQTT_, by exchanging messages with it via an _MQTT broker_.

## Setup Zigbee2MQTT and MQTT broker

If you already have a working installation of [Zigbee2MQTT]](https://www.zigbee2mqtt.io) v1.17.0 or newer, you can skip this step and continue with the next one.

If you are new to Zigbee2MQTT, it is recommended to follow the [Getting Started](https://www.zigbee2mqtt.io/guide/getting-started/) steps on their website.

After you have finished setting up Zigbee2MQTT, I'd also suggest having a look at the integrated [Frontend](https://www.zigbee2mqtt.io/guide/configuration/frontend.html). This makes maintaining/pairing devices a bit easier than manually sending MQTT messages.

> When using **Homebridge v1.4.0** or newer, it is currently recommended to [turn off state caching](https://www.zigbee2mqtt.io/guide/configuration/mqtt.html#mqtt-behaviour) in Zigbee2MQTT (put `cache_state: false` in the configuration). See [issue #383](https://github.com/itavero/homebridge-z2m/issues/383) for more information.

## Setup Homebridge

If you haven't setup [Homebridge](https://homebridge.io) yet, please follow one of the [installation guides on their wiki](https://github.com/homebridge/homebridge/wiki).

It's also recommended to install [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x), as this makes maintaining your Homebridge installation and managing your plugins very easy by providing a web interface.

## Installing the plugin

Once you have taken care of all the prerequisites, you can install the _homebridge-z2m_ plugin.

The easiest way to install and configure this plugin, is by using [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x). On the _Plugins_ tab, look for `z2m` or `zigbee2mqtt` and hit the _Install_ button. After that you can configure the plugin settings via the same page.

An alternative way is to manually call `npm i -g homebridge-z2m@latest` and add the configuration to the `platforms` array of your Homebridge `config.json`. The bare minimum configuration is:

```json
{
   "platform": "zigbee2mqtt",
   "mqtt": {
      "base_topic": "zigbee2mqtt",
      "server": "mqtt://localhost:1883"
   }
}
```

The MQTT server you specify here should be the same as in your Zigbee2MQTT configuration. For more information about the available configuration options, check the [Configuration](config.md) documentation.

### Feeling adventurous? 
Instead of using the `@latest` version from NPM, you can also run future releases using `@next`. You can consider the versions available under the `next` tag to be beta versions, pre-releases or release candidates. What I try to do is publish updates here first so certain people can give requested features a try first, before rolling it out to everyone via the `latest` tag.