# Thermostat
If the device definition from Zigbee2MQTT contains one or more `exposes` entries of type `climate` that at least have the features listed as required below, a [Thermostat](https://developers.homebridge.io/#/service/Thermostat) service will be created.
The table below shows how the different features within this `exposes` entry are mapped to characteristics.

| Name | Required access | Characteristic | Remarks |
|-|-|-|-|
| `local_temperature` | published | [Current Temperature](https://developers.homebridge.io/#/characteristic/CurrentTemperature) | **Required** |
| `current_heating_setpoint` or `occupied_heating_setpoint`  | published, set | [Target Temperature](https://developers.homebridge.io/#/characteristic/TargetTemperature) | **Required**. Only one of the listed properties may be present |
| `system_mode` | published, set | [Target Heating Cooling State](https://developers.homebridge.io/#/characteristic/TargetHeatingCoolingState) | Only used if `running_state` is also present|
| `running_state` | published | [Current Heating Cooling State](https://developers.homebridge.io/#/characteristic/CurrentHeatingCoolingState) | Only used if `system_mode` is also present |


## Remarks
* If `system_mode` and/or `running_state` properties are not found, it is assumed that the device is a "heating" only device. The listed characteristics will still be added, but will only allow for the Heating state.
* Devices that have a `occupied_cooling_setpoint` are currently ignored. When writing the implementation, all these devices had two properties to set a setpoint (one for heating, one for cooling), but HomeKit only exposes a single attribute for this. Additional logic might be able to handle this situation, but this is currently not implemented.