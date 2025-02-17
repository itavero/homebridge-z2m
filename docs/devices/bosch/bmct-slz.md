---
title: "Bosch BMCT-SLZ Homebridge/HomeKit integration"
description: "Add HomeKit support to your Bosch BMCT-SLZ, using Homebridge, Zigbee2MQTT and homebridge-z2m."
---
<!---
This file has been GENERATED using src/docgen/docgen.ts
DO NOT EDIT THIS FILE MANUALLY!
-->
# Bosch BMCT-SLZ
> Light/shutter control unit II


# Unsupported

This device is currently *UNSUPPORTED*.
Want to have this device supported? Please check the [GitHub issue section](https://github.com/itavero/homebridge-z2m/issues?q=BMCT-SLZ) to see if a request already exists for this device.
If it doesn't exist yet, you can [open a new request](https://github.com/itavero/homebridge-z2m/issues/new?assignees=&labels=enhancement&template=device_support.yml&title=%5BDevice%5D+Bosch%20BMCT-SLZ&model=Bosch%20BMCT-SLZ&exposes=%5B%0A%20%20%7B%0A%20%20%20%20%22name%22%3A%20%22device_mode%22%2C%0A%20%20%20%20%22label%22%3A%20%22Device%20mode%22%2C%0A%20%20%20%20%22access%22%3A%207%2C%0A%20%20%20%20%22type%22%3A%20%22enum%22%2C%0A%20%20%20%20%22property%22%3A%20%22device_mode%22%2C%0A%20%20%20%20%22description%22%3A%20%22Device%20mode%22%2C%0A%20%20%20%20%22values%22%3A%20%5B%0A%20%20%20%20%20%20%22light%22%2C%0A%20%20%20%20%20%20%22shutter%22%2C%0A%20%20%20%20%20%20%22disabled%22%0A%20%20%20%20%5D%0A%20%20%7D%0A%5D) by filling in the _Device support_ issue template.

## Exposes

This is the information provided by Zigbee2MQTT for this device:

```json
[
  {
    "name": "device_mode",
    "label": "Device mode",
    "access": 7,
    "type": "enum",
    "property": "device_mode",
    "description": "Device mode",
    "values": [
      "light",
      "shutter",
      "disabled"
    ]
  }
]
```

# Related
* [Other devices from Bosch](../index.md#bosch)
* [Zigbee2MQTT documentation for this device](https://www.zigbee2mqtt.io/devices/BMCT-SLZ.html)