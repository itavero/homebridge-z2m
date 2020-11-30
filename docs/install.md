# Plugin installation

## Requirements
* [zigbee2mqtt](https://www.zigbee2mqtt.io), version v1.16.0 or newer (because of the new API that provides [Exposes](https://github.com/Koenkk/zigbee2mqtt.io/blob/develop/docs/information/exposes.md) information).
* [Homebridge](https://homebridge.io), version v1.1.0 or newer should work.
* Some MQTT broker to exchange messages between this plugin and zigbee2mqtt.
* Not required, but useful: [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x) plugin for Homebridge.

## Installation steps
First make sure all the listed requirements have been setup and are working as expected.

The easiest way to install this plugin and configure this plugin, is by using [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x). On the _Plugins_ tab, look for `z2m` or `zigbee2mqtt` and hit the _Install_ button. After that you can configure the plugin settings via the same page.

An alternative way is to manually call `npm i -g homebridge-z2m@latest` and add the configuration to the `platforms` array of your Homebridge `config.json`. For more information about the configuration options, check the [Configuration](config.md) documentation.

Currently the `latest` version appears to be: [![NPM Latest version](https://flat.badgen.net/npm/v/homebridge-z2m/latest?icon=npm&label=%40latest&color=blue)](https://www.npmjs.com/package/homebridge-z2m/v/latest)

### Feeling adventurous? 
Instead of using the `@latest` version from NPM, you can also run future releases using `@next`. You can consider the versions available under the `next` tag to be beta versions, pre-releases or release candidates. What I try to do is publish updates here first so certain people can give requested features a try first, before rolling it out to everyone via the `latest` tag.

Currently the `next` version appears to be: [![NPM Next version](https://flat.badgen.net/npm/v/homebridge-z2m/next?icon=npm&label=%40next&color=orange&cache=3600)](https://www.npmjs.com/package/homebridge-z2m/v/next)