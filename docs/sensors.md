# Basic Sensors

HomeKit and Zigbee2MQTT support a lot of "basic" sensors, that expose one or more types of sensor measurements.
Because the handling of these sensors is vary similar and most of them have the same optional characteristics in HomeKit (being [Status Tampered](https://developers.homebridge.io/#/characteristic/StatusTampered) and [Status Low Battery](https://developers.homebridge.io/#/characteristic/StatusLowBattery)), a large part of the code handling these sensors is shared.

For all the sensors on this page, the following mapping applies for the aforementioned characteristics.

| Name          | Required access | Characteristic                                                                           | Remarks |
| ------------- | --------------- | ---------------------------------------------------------------------------------------- | ------- |
| `tamper`      | published       | [Status Tampered](https://developers.homebridge.io/#/characteristic/StatusTampered)      |         |
| `battery_low` | published       | [Status Low Battery](https://developers.homebridge.io/#/characteristic/StatusLowBattery) |         |

The following table shows the possible exposes entries and the services and characteristics created if they are present:

| Name              | Required access | Service                                                                                   | Characteristic                                                                                            | Remarks                                                                                      |
| ----------------- | --------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `humidity`        | published       | [Humidity Sensor](https://developers.homebridge.io/#/service/HumiditySensor)              | [Current Relative Humidity](https://developers.homebridge.io/#/characteristic/CurrentRelativeHumidity)    |                                                                                              |
| `temperature`     | published       | [Temperature Sensor](https://developers.homebridge.io/#/service/TemperatureSensor)        | [Current Temperature](https://developers.homebridge.io/#/characteristic/CurrentTemperature)               |                                                                                              |
| `illuminance_lux` | published       | [Light Sensor](https://developers.homebridge.io/#/service/LightSensor)                    | [Current Ambient Light Level](https://developers.homebridge.io/#/characteristic/CurrentAmbientLightLevel) |                                                                                              |
| `pressure`        | published       | Air Pressure Sensor (custom)<br>`E863F00A-079E-48FF-8F27-9C2605A29F52`                    | Air Pressure (custom)<br>`E863F10F-079E-48FF-8F27-9C2605A29F52`                                           | UUIDs are the same as the Elgato Eve Weather uses.                                           |
| `contact`         | published       | [Contact Sensor](https://developers.homebridge.io/#/service/ContactSensor)                | [Contact Sensor State](https://developers.homebridge.io/#/characteristic/ContactSensorState)              |                                                                                              |
| `occupancy`       | published       | [Occupancy Sensor](https://developers.homebridge.io/#/service/OccupancySensor)            | [Occupancy Detected](https://developers.homebridge.io/#/characteristic/OccupancyDetected)                 |                                                                                              |
| `vibration`       | published       | [Motion Sensor](https://developers.homebridge.io/#/service/MotionSensor)                  | [Motion Detected](https://developers.homebridge.io/#/characteristic/MotionDetected)                       |                                                                                              |
| `smoke`           | published       | [Smoke Sensor](https://developers.homebridge.io/#/service/SmokeSensor)                    | [Smoke Detected](https://developers.homebridge.io/#/characteristic/SmokeDetected)                         |                                                                                              |
| `carbon_monoxide` | published       | [Carbon Monoxide Sensor](https://developers.homebridge.io/#/service/CarbonMonoxideSensor) | [Carbon Monoxide Detected](https://developers.homebridge.io/#/characteristic/CarbonMonoxideDetected)      |                                                                                              |
| `water_leak`      | published       | [Leak Sensor](https://developers.homebridge.io/#/service/LeakSensor)                      | [Leak Detected](https://developers.homebridge.io/#/characteristic/LeakDetected)                           | Same service as `gas` (see below). `water` is added to the name to distinguish between them. |
| `gas`             | published       | [Leak Sensor](https://developers.homebridge.io/#/service/LeakSensor)                      | [Leak Detected](https://developers.homebridge.io/#/characteristic/LeakDetected)                           | Same service as `water` (see above). `gas` is added to the name to distinguish between them. |

## Converter specific configuration

### Occupancy (`occupancy`)

- `type`: Allows you to use a different HomeKit service:
  - `occupancy` (default): expose as a [Occupancy Sensor](https://developers.homebridge.io/#/service/OccupancySensor) with [Occupancy Detected](https://developers.homebridge.io/#/characteristic/OccupancyDetected) characteristic
  - `motion`: expose as a [Motion Sensor](https://developers.homebridge.io/#/service/MotionSensor) with [Motion Detected](https://developers.homebridge.io/#/characteristic/MotionDetected) characteristic

```json
{
  "converters": {
    "occupancy": {
      "type": "occupancy"
    }
  }
}
```
