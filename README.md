# homebridge-z2m

<a href="https://www.npmjs.com/package/homebridge-z2m"><img title="npm version" src="https://badgen.net/npm/v/homebridge-z2m" ></a>
<a href="https://www.npmjs.com/package/homebridge-z2m"><img title="npm downloads" src="https://badgen.net/npm/dt/homebridge-z2m" ></a>

Expose your Zigbee devices to HomeKit with ease, by integrating 🐝 [zigbee2mqtt](https://www.zigbee2mqtt.io/) with 🏠 [Homebridge](https://homebridge.io/) (via an MQTT message broker).

## Work in progress 👷‍♂️
Please note that this is just an idea I had, that I'm still working on. Also keep in mind that I don't have a lot of TypeScript experience (my day time job as a software engineer mostly revolves around C and C#). 😅

## Contribute
I'm open to [contributions](https://opensource.guide/how-to-contribute/), but please be nice and follow the [etiquette](https://github.com/kossnocorp/etiquette/blob/master/README.md).

If you have any suggestions, feedback, noticed a bug or improvement, let me know via the [issues section](http://github.com/itavero/homebridge-z2m/issues).

Please do a search in [open issues and PRs](https://github.com/itavero/homebridge-z2m/issues?q=is%3Aopen) to see if the issue or feature request has already been filed.

If you find your issue already exists, make relevant comments and add your [reaction](https://github.com/blog/2119-add-reactions-to-pull-requests-issues-and-comments). Use a reaction, instead of a "+1" / comment, like this:

👍 - upvote

👎 - downvote

If you cannot find an existing issue that describes your bug or feature, feel free to submit an new issue.
Please try to provide enough (background) information.

### Testing the latest changes
After a bug fix or new feature is pushed to GitHub, you can already try it even before it is released.
There's two ways to install the latest stuff from GitHub on your machine:

1. Use the install command: `npm i -g itavero/homebridge-z2m#master` (in which `master` is the name of the branch)
2. Checkout the repository locally, and run the following commands:
   ```
   cd path/to/git/repository
   npm i
   npm run build
   npm link
   ```

## Installation
> ⚠️ This plugin is still under active development. Things might break between release.

First of all, make sure you have [zigbee2mqtt](https://www.zigbee2mqtt.io) setup correctly. Without a working zigbee2mqtt installation, this plugin won't be able to do much for you.

The easiest way to install this plugin and configure this plugin, is by using [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x). On the _Plugins_ tab, look for `z2m` or `zigbee2mqtt` and hit the _Install_ button. After that you can configure the plugin settings via the same page.

An alternative way is to manually call `npm i -g homebridge-z2m` and add the configuration to the `platforms` array of your Homebridge `config.json`.

### Configuration ⚙️
A (rather minimal) configuration looks like this:
```json
{
   "platform": "zigbee2mqtt",
   "mqtt": {
      "base_topic": "zigbee2mqtt",
      "server": "mqtt://localhost:1883"
   },
   "devices": {
      "exclude": [
         "0x1234567890abcdef",
         "0xabcdef1234567890"
      ]
   }
}
```
Within the `mqtt` object, you can add pretty much all the configuration options that zigbee2mqtt also has, with the same keys as in the zigbee2mqtt configuration YAML file:
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

Please refer to the [zigbee2mqtt documentation](https://www.zigbee2mqtt.io/information/configuration.html) for more information on the MQTT options.

Within `devices.exclude` you can put an array with the IEEE addresses, or the `friendly_name`, of the Zigbee devices you wish to exclude from this integration.

## How it (should 😉) work
The plugin listens to the [MQTT messages](https://www.zigbee2mqtt.io/information/mqtt_topics_and_message_structure.html) published by zigbee2mqtt.
It detects the devices using the `zigbee2mqtt/bridge/config/devices` topic.

Whenever it receives a message for a device (on `zigbee2mqtt/[FRIENDLY_NAME]` topics), it tries to deduct the available HomeKit services from the elements in that message and publishes/updates these. The following elements are currently handled:
| JSON key | HomeKit Service |
|-|-|
| `state` / `state_left` / `state_right` | [Switch](https://developers.homebridge.io/#/service/Switch) _(or [Lightbulb](https://developers.homebridge.io/#/service/Lightbulb); see next row)_ |
| `brightness`, `color_temp`, `color` | [Lightbulb](https://developers.homebridge.io/#/service/Lightbulb) _(requires `state` to be present too)_ |
| `temperature` | [TemperatureSensor](https://developers.homebridge.io/#/service/TemperatureSensor) |
| `humidity` | [HumiditySensor](https://developers.homebridge.io/#/service/HumiditySensor) |
| `contact` | [ContactSensor](https://developers.homebridge.io/#/service/ContactSensor) |
| `illuminance_lux` | [LightSensor](https://developers.homebridge.io/#/service/LightSensor) |
| `occupancy` | [OccupancySensor](https://developers.homebridge.io/#/service/OccupancySensor) |
| `smoke` | [SmokeSensor](https://developers.homebridge.io/#/service/SmokeSensor) |
| `water_leak` | [LeakSensor](https://developers.homebridge.io/#/service/LeakSensor) |
| `position` | [WindowCovering](https://developers.homebridge.io/#/service/WindowCovering) |
| `battery` | [BatteryService](https://developers.homebridge.io/#/service/BatteryService) _(currently [StatusLowBattery](https://developers.homebridge.io/#/characteristic/StatusLowBattery) is set to **Low** when the reported battery level is less than 30%)_ |
| `pressure` | Air Pressure Sensor _(using same service and characteristic as Elgato Eve Weather)_ |

This way this homebridge plugin does not have to know the different devices. In other words, if a new device gets added to zigbee2mqtt, you probably only have to update zigbee2mqtt and not this plugin.

Unfortunately, a downside is that the device must have published its data before the plugin knows how HomeKit could use it. All devices except the Coordinator will be exposed to HomeKit, even before any services are discovered. So, you could already put your new device in the right room in the _Home_ app, even though you might not be able to use it already.

_(TBD: How to handle when a lights state contains both `color_temp` and `color`? Which one to follow? Maybe monitor for changes or monitor `zigbee2mqtt/[FRIENDLY_NAME]/set`?)_

## Roadmap 🛣
Below is a list of ideas I still have for this plugin. Of course, right now my priority is to be able to monitor and control my Zigbee devices first.

* "virtual" switch to enable/disable `permit_join` (and also have it automatically turn off when a timer elapses or a device is paired).
* When `update_available` is set to `true`, provide a switch service to start the FW update via HomeKit (and maybe see if it is possible to provide feedback on the progress somehow). I might add this to each device individually, or maybe generate one virtual device that acts as a binary sensor (so that you can also get some kind of notification when an update is available) and add multiple switches to that.
* Support for push buttons (including double click and hold, if possible).
* If available, use the information for the Home Assistant MQTT discovery, to figure out available services even before the data is published.