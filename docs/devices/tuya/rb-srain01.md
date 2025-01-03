---
title: "Tuya RB-SRAIN01 Homebridge/HomeKit integration"
description: "Add HomeKit support to your Tuya RB-SRAIN01, using Homebridge, Zigbee2MQTT and homebridge-z2m."
---
<!---
This file has been GENERATED using src/docgen/docgen.ts
DO NOT EDIT THIS FILE MANUALLY!
-->
# Tuya RB-SRAIN01
> Solar rain sensor


# Services and characteristics
The following HomeKit Services and Characteristics are exposed by
the Tuya RB-SRAIN01

* [Battery](../../battery.md)
  * Battery Level
  * Charging State
  * Status Low Battery



## Exposes

This is the information provided by Zigbee2MQTT for this device:

```json
[
  {
    "name": "illuminance",
    "label": "Illuminance",
    "access": 1,
    "type": "numeric",
    "property": "illuminance",
    "description": "Raw measured illuminance",
    "unit": "lx"
  },
  {
    "name": "illuminance_average_20min",
    "label": "Illuminance average 20min",
    "access": 1,
    "type": "numeric",
    "property": "illuminance_average_20min",
    "description": "Illuminance average for the last 20 minutes",
    "unit": "lx"
  },
  {
    "name": "illuminance_maximum_today",
    "label": "Illuminance maximum today",
    "access": 1,
    "type": "numeric",
    "property": "illuminance_maximum_today",
    "description": "Illuminance maximum for the last 24 hours",
    "unit": "lx"
  },
  {
    "name": "cleaning_reminder",
    "label": "Cleaning reminder",
    "access": 1,
    "type": "binary",
    "property": "cleaning_reminder",
    "description": "Cleaning reminder",
    "value_on": true,
    "value_off": false
  },
  {
    "name": "rain_intensity",
    "label": "Rain intensity",
    "access": 1,
    "type": "numeric",
    "property": "rain_intensity",
    "description": "Rainfall intensity",
    "unit": "mV"
  },
  {
    "name": "rain",
    "label": "Rain",
    "access": 1,
    "type": "binary",
    "property": "rain",
    "description": "Indicates whether the device detected rainfall",
    "value_on": true,
    "value_off": false
  },
  {
    "name": "battery",
    "label": "Battery",
    "access": 5,
    "type": "numeric",
    "property": "battery",
    "description": "Remaining battery in %",
    "category": "diagnostic",
    "unit": "%",
    "value_max": 100,
    "value_min": 0
  },
  {
    "name": "linkquality",
    "label": "Linkquality",
    "access": 1,
    "type": "numeric",
    "property": "linkquality",
    "description": "Link quality (signal strength)",
    "category": "diagnostic",
    "unit": "lqi",
    "value_max": 255,
    "value_min": 0
  }
]
```

# Related
* [Other devices from Tuya](../index.md#tuya)
* [Zigbee2MQTT documentation for this device](https://www.zigbee2mqtt.io/devices/RB-SRAIN01.html)