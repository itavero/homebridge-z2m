# Air Quality Sensor
If the device contains any of the `exposes` mentioned in the following table, an [Air Quality Sensor](https://developers.homebridge.io/#/service/AirQualitySensor) service will be created.

Besides the characteristic mentioned in the table, the plugin will also add the required [Air Quality](https://developers.homebridge.io/#/characteristic/AirQuality) characteristic.
The table below contains the threshold values for the different properties.
If a single sensor supports multiple of the characteristics mentioned in the table, the worst air quality indication will be used for the _Air Quality_ characteristic.

| Name | Characteristic | Excellent | Good | Fair | Inferior | Poor |
|-|-|-|-|-|-|-|
| `voc` | [VOC Density](https://developers.homebridge.io/#/characteristic/VOCDensity) | <= 333 | <= 1000 | <= 3333 | <= 8332 | > 8332 |
| `pm10` | [PM10 Density](https://developers.homebridge.io/#/characteristic/PM10Density) | <= 25 | <= 50 | <= 100 | <= 300 | > 300 |
| `pm25` | [PM2.5](https://developers.homebridge.io/#/characteristic/PM2_5Density) | <= 15 | <= 35 | <= 55 | <= 75 | > 75 |

Note that these values have been selected based on several graphs found on different online resources.
There might be room from improvement, but then again, the _Air Quality_ is just an indication.