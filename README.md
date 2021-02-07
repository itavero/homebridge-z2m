<p align="center">
  <img alt="Homebridge x Zigbee2MQTT" src="https://raw.githubusercontent.com/itavero/homebridge-z2m/master/docs/branding/Homebridge_x_Zigbee2MQTT.svg?sanitize=true" width="500px">
</p>

# homebridge-z2m

[![NPM Latest version](https://flat.badgen.net/npm/v/homebridge-z2m/latest?icon=npm&label=%40latest&color=blue)](https://www.npmjs.com/package/homebridge-z2m/v/latest)
[![NPM Next/future version](https://flat.badgen.net/npm/v/homebridge-z2m/next?icon=npm&label=%40next&color=orange)](https://www.npmjs.com/package/homebridge-z2m/v/next)
[![NPM Downloads](https://flat.badgen.net/npm/dt/homebridge-z2m/?icon=npm&color=blue)](https://www.npmjs.com/package/homebridge-z2m)
[![GitHub Checks status](https://flat.badgen.net/github/checks/itavero/homebridge-z2m?icon=github)](https://github.com/itavero/homebridge-z2m)
[![CodeFactor](https://www.codefactor.io/repository/github/itavero/homebridge-z2m/badge?style=flat-square)](https://www.codefactor.io/repository/github/itavero/homebridge-z2m)
[![SonarCloud Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=itavero_homebridge-z2m&metric=alert_status)](https://sonarcloud.io/dashboard?id=itavero_homebridge-z2m)

Expose your Zigbee devices to HomeKit with ease, by integrating 🐝 [Zigbee2MQTT](https://www.zigbee2mqtt.io/) with 🏠 [Homebridge](https://homebridge.io/) (via an MQTT message broker).

This Homebridge plugin can be installed using `npm install homebridge-z2m` or via the [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x) plugin.

The bare minimum configuration for this plugin only has to contain the MQTT server information:
```json
{
   "platform": "zigbee2mqtt",
   "mqtt": {
      "base_topic": "zigbee2mqtt",
      "server": "mqtt://localhost:1883"
   }
}
```

After adding this to your configuration and restarting Homebridge, it should automatically retrieve all the required information about the devices from Zigbee2MQTT (via the configured MQTT server).

For more information on installing, configuring and using the plugin, please check the [documentation on the plugin website](https://z2m.dev).

## Contribute
This project is open to contributions. Please read the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.