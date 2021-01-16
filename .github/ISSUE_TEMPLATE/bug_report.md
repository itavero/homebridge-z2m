---
name: Bug report
about: Create a report to help us improve
title: '[Bug] '
labels: ''
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**Related devices**
Are you experiencing this behavior with a particular device?
Please list which device(s) you experience this with.

**To Reproduce**
Steps to reproduce the behavior, for example:
1. Change '...' via the Home app.
2. Log shows MQTT message '...' being published to topic '...'
3. The device does the following: '...'

**Expected behavior**
A clear and concise description of what you expected to happen, compared to what actually happened.

**MQTT messages**
If possible (and applicable), please provide the following:
* The device entry from `zigbee2mqtt/bridge/devices` (note: this is different from `zigbee2mqtt/bridge/config/devices`)
* Status update from `zigbee2mqtt/[FRIENDLY_NAME]`
* Messages published by this plugin that might be related to your issue (can also be seen in the homebridge logs)

**Versions used**
Please provide the version of the following pieces of software:
 - This plugin
 - Homebridge
 - Zigbee2MQTT (can be found in MQTT topic `zigbee2mqtt/bridge/info`)
 - Homebridge Config UI X (if applicable)
