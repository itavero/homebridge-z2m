# Matter outlets with energy measurement ⚡️

HomeKit (HAP) has no standard characteristics for power or energy, so the [electrical measurements](electrical.md) exposed over HAP are only visible in apps like Eve.
Apple Home does show power on the tile (iOS 27 or later) and power and energy per device in its **Energy** view (iOS 27.3 or later), but only for **Matter** accessories that implement the `ElectricalPowerMeasurement` and `ElectricalEnergyMeasurement` clusters.

When Matter is enabled on the bridge that runs this plugin, homebridge-z2m can publish smart plugs (and other switchable devices with metering) as Matter **On/Off Outlets** with these clusters.

## Requirements

* Homebridge **2.5.0 or newer**. Older versions log a warning and keep exposing the devices via HAP only.
* Matter enabled on the bridge running this plugin. It is recommended to run the plugin in a [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges) and enable Matter for that child bridge in the Homebridge UI (or by adding a `matter` object to `_bridge` in the platform configuration). HAP stays active on that bridge, so all other devices keep working as before.
* The device must expose a settable on/off `state` and `power` and/or `energy` on its main endpoint (no `endpoint`). Multi-gang devices (`state_l1`, `state_l2`, …) are not supported yet.

## Configuration

Matter is opt-in. Either enable it for all eligible devices on the platform level:

```json
{
   "platform": "zigbee2mqtt",
   "mqtt": { "base_topic": "zigbee2mqtt", "server": "mqtt://localhost:1883" },
   "matter": {
      "outlets": "auto",
      "keep_hap": false
   },
   "devices": [
      { "id": "water_heater", "matter": { "outlet": false } }
   ]
}
```

Or only for specific devices:

```json
{
   "platform": "zigbee2mqtt",
   "mqtt": { "base_topic": "zigbee2mqtt", "server": "mqtt://localhost:1883" },
   "devices": [
      { "id": "washing_machine", "matter": { "outlet": true } },
      { "id": "0xa4c138d2b1e5f6a7", "matter": { "outlet": true, "keep_hap": true } }
   ]
}
```

### Platform options (`matter`)

* `outlets`:
  * `configured` (default): only publish devices that have `matter` enabled in their device configuration.
  * `auto`: publish every device that exposes an on/off `state` and `power` or `energy`.
* `keep_hap`: if `true`, devices published via Matter are also still exposed via HAP. They will then appear twice in the Home app. (default: `false`)

### Device options (`devices[].matter`)

* `outlet`: publish (`true`) or do not publish (`false`) this device as a Matter outlet. When omitted, the platform option `outlets` decides.
* `keep_hap`: overrides the platform option `keep_hap` for this device.

A device that is `exclude`d is never published via Matter. The `matter` option can not be set in `defaults`; use the platform options above instead.

If Homebridge fails to register a device via Matter, a warning is logged and the device is exposed via HAP instead, until the next restart.

> ⚠️ By default, a device published via Matter is **removed from HAP**, so it does not show up twice in the Home app.
> Scenes and automations that use the HAP version of the device have to be recreated with the Matter version.

## Mapping

| Zigbee2MQTT property | Alternative names | Matter cluster | Attribute | Unit conversion |
|---|---|---|---|---|
| `state` | - | `OnOff` | `onOff` | `value_on` → `true` |
| `power` | `active_power`, `load` | `ElectricalPowerMeasurement` | `activePower` | W → mW |
| `voltage` | `mains_voltage`, `rms_voltage` | `ElectricalPowerMeasurement` | `voltage` | V → mV |
| `current` | - | `ElectricalPowerMeasurement` | `activeCurrent` | A → mA |
| `energy` | `consumed_energy`, `energy_consumed` | `ElectricalEnergyMeasurement` | `cumulativeEnergyImported` | kWh (or Wh) → mWh |

* Only the attributes the device actually exposes are declared. `voltage` and `current` are only published when `power` is available as well.
* Energy is converted based on the `unit` of the expose (`kWh`, the default, or `Wh`). Energy in any other unit is ignored.
* Power, voltage and current are updated whenever Zigbee2MQTT publishes a new value. Each update of the cumulative energy makes Matter.js emit an event to all controllers, so energy updates are limited to **one per minute** (the latest value is sent).
* Homebridge adds the `ElectricalSensor` device type and the mandatory accuracy information itself.
* Turning the outlet on or off in the Home app publishes `{"state": "ON"}` / `{"state": "OFF"}` to `zigbee2mqtt/<friendly_name>/set`.
* The name (sanitized friendly name), serial number (IEEE address), manufacturer and model are limited to the 32 characters Matter allows.

## Pairing

The Matter bridge has its own pairing code, shown in the Homebridge UI (on the child bridge) and in the logs when it starts.
In the Home app, choose *Add Accessory* and scan the Matter QR code (or enter the code). The Home app will warn that the accessory is not certified; this is expected.

Apple Home only shows the wattage on the tile for accessories of the outlet type. Before iOS 27.3, bridged devices were not listed individually in the Energy view.
