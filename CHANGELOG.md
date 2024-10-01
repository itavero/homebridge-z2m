# Changelog

All notable changes to this project will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Since version 1.0.0, we try to follow the [Semantic Versioning](https://semver.org/spec/v2.0.0.html) standard.

## [Unreleased]

### Changed

- Lights: `color_mode` is now always used (no longer an experimental flag; also see [#208](https://github.com/itavero/homebridge-z2m/issues/208))

### Fixed

- Minor changes to be compatible with the upcoming Homebridge v2 release, amongst others:
  - In most services where the (numeric) range of a characteristic is limited, the value is now set correctly before doing so, to prevent warnings from HAP-NodeJS.
  - Sanitize accessory names so they only contain alphanumeric, space, and apostrophe characters, and start with an alphanumeric character.

## [1.11.0-beta.6] - 2024-06-30

### Changed

- Window Covering now uses `motor_state` (if provided) to improve the user experience in the Home.app (see [#852](https://github.com/itavero/homebridge-z2m/issues/852) / [#854](https://github.com/itavero/homebridge-z2m/issues/854))

## [1.11.0-beta.5] - 2024-05-21

### Fixed

- Overlooked an `supported` check in the previous version. This is now also removed, so devices not officially supported by Zigbee2MQTT can now be used.

## [1.11.0-beta.4] - 2024-05-21

### Changed

- Process devices not yet supported by Zigbee2MQTT if they provide exposes information. This should allow automatically detected features to already be exposed.

### Fixed

- Non-zero brightness levels below 1% are now rounded up to 1%. (see [#673](https://github.com/itavero/homebridge-z2m/issues/673))

## [1.11.0-beta.3] - 2024-01-04

### Changed

- Drop support for unsupported Node.js version. Now only testing against v18 and v20 (current LTS releases).
- Updated several dependencies, including [mqtt](https://www.npmjs.com/package/mqtt).

### Fixed

- Compatibility with Zigbee2MQTT v1.35.0 fixed (see fixes in `v1.9.3-rc.0`)

## [1.11.0-beta.2] - 2023-01-16

### Added

- Support for Carbon Dioxide (`co2`) sensors added. (see [#609](https://github.com/itavero/homebridge-z2m/issues/609))

### Changed

- Moved the Availability feature behind an experimental feature flag (`AVAILABILITY`), as it is not working reliably yet. (see [#593](https://github.com/itavero/homebridge-z2m/issues/593])
- Added additional options for Adaptive Lighting, to have it only update the color temperature when the light is on and to have it send a `transition` when updating the color temperature. These options are **not** yet available via the config user interface. (see [#590](https://github.com/itavero/homebridge-z2m/discussions/590))

## [1.11.0-beta.1] - 2023-01-09

### Changed

- Updated `config.schema.json` to have `exclude` set to `false` if it is unchecked in the Config UI. This should allow users to override a global `exclude: true` setting for specific devices, via the web interface. (see [#610](https://github.com/itavero/homebridge-z2m/issues/610))
- Debug messages can now be output as `info`, by setting `debug_as_info` to `true` in the plugin configuration. (see docs for more information)
- Added option `ignore_z2m_online` to device configuration, to not mark devices as offline when Zigbee2MQTT reports itself as offline or when the connection to the MQTT broker is lost.

## [1.11.0-beta.0] - 2022-12-12

### Added

- **Adaptive Lighting**: Added support for Adaptive Lighting. Currently this needs to be enabled *manually* in the plugin configuration, using [converter specific configuration for `light`](https://z2m.dev/light.html#converter-specific-configuration-light). In a future release this might get enabled by default. (see [#30](https://github.com/itavero/homebridge-z2m/issues/30) / [#488](https://github.com/itavero/homebridge-z2m/pull/488))

## [1.10.0] - 2022-12-09

Based on v1.9.2, as v1.9.3 was made later as a hotfix.

### Added

- Properties/exposes information can now be excluded based on the `endpoint`, using the `excluded_endpoints` configuration option. (relates to [#517](https://github.com/itavero/homebridge-z2m/issues/517))
- Window Covering can now be requested to stop moving (see [#483](https://github.com/itavero/homebridge-z2m/issues/483))
- Availability information from Zigbee2MQTT, if available, is now used to determine if a device is reachable or not. (see [#36](https://github.com/itavero/homebridge-z2m/issues/36))

### Changed

- Exposes information is now filtered before passing it to the service handlers. This should make the behavior more consistent and reduce complexity of the service handlers for improved maintainability.
- MQTT messages being published by this plugin are now logged to the `debug` log level by default. This can be changed by setting `log.mqtt_publish` to the desired log level (e.g. `info`) in the plugin configuration. (see [#518](https://github.com/itavero/homebridge-z2m/issues/518))

### Fixed

- When combining exposes information of grouped devices, the `value_min` and `value_max` were not being combined correctly. This has been fixed, so that the resulting range is supported by all devices in the group.

## [1.9.3] - 2024-01-03

### Fixed

- Compatibility with Zigbee2MQTT v1.35.0 fixed (see fixes in `v1.9.3-rc.0`)

## [1.9.3-rc.0] - 2024-01-02

### Fixed

- Type checks on Z2M models now explicitly check that the input is not null or undefined, to prevent crashes when we get unexpected data. (see [#794](https://github.com/itavero/homebridge-z2m/issues/794))
- When creating or updating an accessory, previously it was only checked if the device definition was not undefined. Now we check if it seems to be a valid device definition. (see [#794](https://github.com/itavero/homebridge-z2m/issues/794))

## [1.9.2] - 2022-10-01

### Fixed

- Fixed a bug introduced in [1.9.1] that caused several types of devices to stop working, due to a coding error. (see [#535](https://github.com/itavero/homebridge-z2m/issues/535) for more details)

## [1.9.1] - 2022-10-01

### Fixed

- Added additional checks to prevent certain errors from occuring during creation of a service handler. (see [#443](https://github.com/itavero/homebridge-z2m/issues/443))
- Removed some default values from `config.schema.json` to prevent certain illegal configurations from being created by accident.

## [1.9.0] - 2022-06-29

### Added

- Some converters now have some additional configuration options which allows you to select an alternative implementation. (see
 [#458](https://github.com/itavero/homebridge-z2m/pull/458) and related issues)
  - `switch` can be configured as a `switch` (default) or `outlet`
  - `occupancy` can be configured as `occupancy` (default) or `motion`
- `device_temperature` is now exposed as a temperature sensor. Due to a [change in Zigbee2MQTT](https://github.com/Koenkk/zigbee-herdsman-converters/pull/4267), you might need to update your Homebridge configuration to exclude `device_temperature` if you previously excluded `temperature` for some devices. (see [#456](https://github.com/itavero/homebridge-z2m/issues/456))

### Changed

- Refactored `basic_sensor.ts` as the file was getting way too huge. This should not change any behavior.

## [1.8.0] - 2022-05-09

### Added

- It is now possible to include globally excluded properties for specific devices by using `included_keys` in the device configuration. (see [#406](https://github.com/itavero/homebridge-z2m/issues/406))

### Changed

- Support for Zigbee2MQTT Groups is now enabled by default. The experimental option `GROUPS` is therefore removed. (see [#277](https://github.com/itavero/homebridge-z2m/issues/277))

### Notes

- When using **Homebridge v1.4.0** or newer, it is currently recommended to [turn off state caching](https://www.zigbee2mqtt.io/guide/configuration/mqtt.html#mqtt-behaviour) in Zigbee2MQTT (put `cache_state: false` in the configuration). See [issue #383](https://github.com/itavero/homebridge-z2m/issues/383) for more information.

## [1.7.0] - 2022-02-20

### Changed

- Ignore `exclude: false` if it is part of the `defaults` in the plugin configuration, as it may conflict with
  `exclude_grouped_devices` (also see [#277](https://github.com/itavero/homebridge-z2m/issues/277#issuecomment-1042590683))

### Fixed

- Remove stale accessories when an updated group list is received.
- When determining the `exposes` information for a group, the `endpoint` specific information is removed. This should allow devices
  with multiple endpoints to be grouped as well.

## [1.7.0-rc.1] - 2021-12-20

### Added

- Exposes information for an accessory (device or group) can be overridden via the JSON configuration, using the `exposes` key in the device configuration. This is **not** part of the configuration UI and uses the same [`exposes` structure as Zigbee2MQTT](https://www.zigbee2mqtt.io/guide/usage/exposes.html).
- ⚠️ **Experimental features**: Starting from this release, features/changes can be introduced as _experimental_.
  This means that you have to enable these features/changes explicitly in your configuration and you must be aware
  that things might break. The main reason for adding this, is so that users can try out changes/features that
  are still being worked on and provide feedback based on their experiences. Please refer to the
  [documentation on plugin configuration](https://z2m.dev/config.html#experimental) for more information.
- Experimental `GROUPS`:
  - Adds accessories for all the groups for which it can determine valid exposes information.
  - Configuration option to exclude all devices that are part of a group (`exclude_grouped_devices`, default: `false`).

### Changed

- Experimental `COLOR_MODE`:
  - `light`: filter properties in state update based on `color_mode`, if provided. (see [#208](https://github.com/itavero/homebridge-z2m/issues/208))
  - `light`: set Hue/Saturation based on Color Temperature (if `color_mode` is also received), to slightly improve the UX. Unfortunately the translation is far from perfect at the moment. (see [#208](https://github.com/itavero/homebridge-z2m/issues/208))

### Fixed

- Bug in `exposesAreEqual` causing differences in entries with `features` not to be recognized.

## [1.6.2] - 2021-12-05

### Fixed

- Only log Zigbee2MQTT version when it is changed (or its the first discovery). (fixes [#322](https://github.com/itavero/homebridge-z2m/issues/322))
- Air Quality sensor with a PM2.5 sensor were incorrectly exposed as a PM10 sensor in HomeKit.

## [1.6.1] - 2021-11-21

### Fixed

- Removed unnecessary code from climate service.
- Polling mechanism for `cover` improved. In past releases the plugin could stop requesting updates too early. (see [#292](https://github.com/itavero/homebridge-z2m/pull/292))

### Removed

- This plugin is no longer tested against Node.js v10, as this version is no longer supported by the community.

## [1.6.0] - 2021-08-24

### Added

- Vibration sensors are now supported and exposed as Motion sensors.
- Presence sensors are now supported and exposed as Occupancy sensors.

## [1.5.0] - 2021-08-23

### Added

- Support for Air Quality Sensors (`voc`, `pm10`, `pm25`). (see [#241](https://github.com/itavero/homebridge-z2m/issues/241))

## [1.4.0] - 2021-08-16
### Added

- The plugin will now log an error if the output format of Zigbee2MQTT (`experimental.output`) appears to have been configured incorrectly.
- Support for `cover` devices that only expose `tilt` and no `position`. (see [#254](https://github.com/itavero/homebridge-z2m/issues/254))

### Changed

- Take over numeric range for "passthrough" characteristics, if provided by Zigbee2MQTT.
  Set minimum value for _Ambient Light Level_ to 0, if range is not provided. (see [#235](https://github.com/itavero/homebridge-z2m/issues/235))
- Remove (top level) items with an undefined/null value from state updates.
  This should prevent the warnings mentioned in [#234](https://github.com/itavero/homebridge-z2m/issues/234).

## [1.3.0] - 2021-06-20
### Added

- Support for horizontal tilt of a `cover` (see [#147](https://github.com/itavero/homebridge-z2m/pull/147))

### Changed

For `cover` devices the following changes/fixes are in this release:
- Update target position, when the state is assumed to be _"stopped"_, to improve Home.app UX. (see [#189](https://github.com/itavero/homebridge-z2m/issues/189))
- Only request `position` when it is actually "gettable" and we did not receive an update recently (which should normally happen if the device supports reporting).
- Changed how the `PositionState` is updated based on the received positions. No longer try to interpret the direction (HomeKit does this automatically so it seems).

## [1.2.0] - 2021-05-14
### Added

- Default device options can now be set using the `defaults` key in the plugin configuration.
- Add plugin option `mqtt.disable_qos` to force the QoS Level to `0` (best effort) for published messages. This might be needed
  when using certain (cloud) MQTT brokers. (see [#150](https://github.com/itavero/homebridge-z2m/pull/150))

## [1.1.3] - 2021-03-08
### Fixed

- Names of services are correctly updated when the `friendly_name` from Zigbee2MQTT has been updated. For the updated names to show up in the
  Home app, it might be necessary to restart Homebridge. (see [#76](https://github.com/itavero/homebridge-z2m/issues/76))
- When a new list of devices is published to `zigbee2mqtt/bridge/devices`, only the changed accessories will be updated, instead of all of them.
  (Wrong default value for `force_update` argument of `updateDeviceInformation` has been corrected.))

## [1.1.2] - 2021-03-03
### Fixed

- Set range for Color Temperature characteristic of Lightbulb to improve control experience. (see [#88](https://github.com/itavero/homebridge-z2m/issues/88))

### Changed

- Improved logging when handling a (potential) device update fails. (PR [#78](https://github.com/itavero/homebridge-z2m/pull/78))
- Ignore empty device updates. (PR [#78](https://github.com/itavero/homebridge-z2m/pull/78))

## [1.1.1] - 2021-02-09
### Fixed

- Color change of lights using `color_hs` was not sent correctly. (fix for [#57](https://github.com/itavero/homebridge-z2m/issues/57))

## [1.1.0] - 2021-02-07
### Changed

- Improved `config.schema.json` to improve the plugin configuration screen a bit.

### Most important changes since v0.0.10

- Requires Zigbee2MQTT v1.17.0 or newer
- Uses device information provided by new API in Zigbee2MQTT, so all supported devices should work immediately.
- Added support for remote controls (`action`) and thermostats / radiator valves (`climate`).
- > ⚠️ **IMPORTANT**: Because of this major change, it might be that you have to reconfigure some of your accessories in your HomeKit setup, if you are coming from v0.0.10 or earlier, as names/identifiers of certain services might have changed. This should be a one time action only, because of this new major version.

## [1.1.0-beta.4] - 2021-02-07
### Fixed

- Temperature sensors showed up as unavailable if the temperature dropped below 0°C, because the default range in HomeKit is 0 to 100°C (see [#49](https://github.com/itavero/homebridge-z2m/pull/49)).

## [1.1.0-beta.3] - 2021-01-30
### Fixed

- `LockCurrentState` wasn't updated because the monitor was not initialized properly. (fix for [#46](https://github.com/itavero/homebridge-z2m/issues/46))

## [1.1.0-beta.2] - 2021-01-30
### Added

- Device documentation is now available on the website and generated based on information from the zigbee-herdsman-converters package,
  which is also used by Zigbee2MQTT.
- Support for `climate` devices added (like thermostats and TRVs). (see [#40](https://github.com/itavero/homebridge-z2m/issues/40))

### Changed

- Removed unhandled exceptions to prevent Homebridge from crashing. If the plugin does not work as expected, please investigate the
  Homebridge logs up on startup to see if there is anything wrong with your plugin configuration or any of the dependencies.

## [1.1.0-beta.1][] - 2021-01-16
### Changed
- Zigbee2MQTT minimal version check ignores the `-dev` suffix, so that the newer development build is also accepted.
- Updated Name characteristic of the Accessory Information service with the `friendly_name` received from Zigbee2MQTT.
- Fixed some typo's, both in code and documentation.
- Changed casing of Zigbee2MQTT in logs and such.

## [1.1.0-beta.0][] - 2021-01-10
### Added

- Remote control/push button support (devices that expose `action` will have a Stateless Programmable Switch service now).

### Changed

- Report an error in the logs if the zigbee2mqtt version is too old. Also check the legacy `bridge/config` topic for this.
- Bumped the minimum zigbee2mqtt version to the first official release with the new API, **version 1.17.0**.
- When the zigbee2mqtt version requirement is not met, this plugin will throw an error which will cause Homebridge to stop.
- Migration from pre-v1.0.0 should be a bit smoother. In previous version, all pre-v1.0.0 accessories would be fully removed and then
  get recreated. This caused all of the automations, room assignments etc. in HomeKit to get lost. With this version the migration from
  pre-v1.0.0 versions of this plugin should be smoother, although there still probably will be some services/accessories for which this
  information gets lost.
- Plugin configuration is now (partially) validated on start up. An incorrect configuration will cause Homebridge to stop.

## [1.0.2][] - 2020-12-30
### Changed

- Clean up old lodash dependency.

## [1.0.1][] - 2020-12-30
### Changed
- Cleaned up published package by "fixing" `.npmignore`

## [1.0.0][] - 2020-12-30
### Changed

- > ⚠️ **IMPORTANT**: Because the way this plugin works and constructs the accessories, it might be that you have to reconfigure some of your accessories in your HomeKit setup as names/identifiers of certain services might have changed. This should be a one time action, because of this new major version.
- Use `exposes` information added in zigbee2mqtt v1.16.0 (which is the minimum version required by this plugin from now on).
  This information is used to determine the available characteristics (and to which services they belong).
- Refactored internals: split up parts of the code and added automated tests.
- Cleaned up `README.md`
- Refactored/changed color conversion for converting hue/saturation to XY, based on [some documentation from Philips Hue](https://developers.meethue.com/develop/application-design-guidance/color-conversion-formulas-rgb-to-xy-and-back/).

### Added

- Documentation has been added in the `docs` folder and on [the new homebridge-z2m website](https://arno.dev/homebridge-z2m/).

### Removed

- Support for Electrical measurement information (added in 0.0.8) was removed. I personally did not have a use case for this information, so instead I decided to focus my efforts on other parts of this major release. If you miss this, please open up a feature request and also let me know what this information is useful for within a HomeKit context.

## [0.0.10][] - 2020-10-31
### Changed

- Only try to parse JSON of a possible status update if we find a matching accessory. Previously errors could show up for the `action` / `click` topics, due to the fixed support fo friendly names with a `/` in v0.0.8.
- Clean up old/unhandled services upon restoring an accessory.
- Exclude `action` and `click` key globally as long as there is no support for push buttons/remotes yet.
- Removed `voltage` key from global exclude list, due to previously added electrical measurement information (in v0.0.8).
- Refactored the Service to JSON key mapping so it's a separate function.
- When performing a get operation, all keys (derived from the services that are present) will be added if none where specified. (previously indicated in [#19](https://github.com/itavero/homebridge-z2m/issues/19) that it shouldn't be empty)

## [0.0.9][] - 2020-10-20
### Added

- Extended Battery Service with several keys: `battery_low`, `battery_state` and `ac_connected`. Note that `battery_low` will also fake the battery level in case the `battery` key is not present.
- Support for Gas Detection Sensors (`gas`). These will show up on HomeKit as Leak Sensor. As far as I know there is no built-in type for Methane Gas Sensors.

### Changed

- Very slightly refactored the service creation for keys starting with `state_`, to make it more generic.

## [0.0.8][] - 2020-10-19
### Added

- Electrical measurement information added for switches/lights that support it (using the Elgato Eve Energy characteristics).

### Fixed

- Removed some default values from `config.schema.json` so that the config UI will not generate an invalid configuration. (see [#16](https://github.com/itavero/homebridge-z2m/pull/16))
- Fix support for friendly names that contain a (`/`) forward slash. (see [#19](https://github.com/itavero/homebridge-z2m/issues/19))

## [0.0.7][] - 2020-10-15
### Added

- Restored support for Air Pressure Sensors.
- Configure excluded/ignored keys per device. (see [#12](https://github.com/itavero/homebridge-z2m/issues/12))

### Changed

- **BREAKING**: The configuration JSON slightly changed because of the new feature. This means that excluding devices is now done in a different way. See the example in the README. (related to [#12](https://github.com/itavero/homebridge-z2m/issues/12))
- Extended range of MQTT version setting, so that version 3 can also be selected when needed. The default is still version 4. (see [#13](https://github.com/itavero/homebridge-z2m/issues/13))
- Added a try catch block and logging in the function that handles received MQTT messages. (see [#13](https://github.com/itavero/homebridge-z2m/issues/13))

## [0.0.6][] - 2020-09-09
### Added

- Support for switches (relays) with more than two outputs (added a lot of keys starting with `state_`).
- Carbon Monoxide Sensor support.
- Lock Mechanism support, based on `state` [`LOCK`, `UNLOCK`] and `lock_state`, if available. (see [#9](https://github.com/itavero/homebridge-z2m/issues/9))

### Changed

- Call to `registerPlatform` changed to include package name (see [#8](https://github.com/itavero/homebridge-z2m/issues/8)).
- Use global `hap` variable to access characteristics, instead of storing references in each ServiceWrapper.

## [0.0.5][] - 2020-07-05
### Changed

- Removed support for Air Pressure Sensors (temporarily) due to [#6](https://github.com/itavero/homebridge-z2m/issues/6).

## [0.0.4][] - 2020-07-05
### Added

- Devices can now be excluded using their `friendly_name` as well as their IEEE address.
- Support for switches that use `state_left` and `state_right`.  ([#5](https://github.com/itavero/homebridge-z2m/issues/5))
- Support for Air Pressure Sensors

### Changed

- README now mentions how to run the "development" version.

### Fixed

- Hue Dimmer Switch appears as a light bulb ([#1](https://github.com/itavero/homebridge-z2m/issues/1))

## [0.0.3][] - 2020-07-01
### Added

- Devices can now be excluded via the configuration (`devices` > `exclude`).

## [0.0.2][] - 2020-06-30
### Changed

- Restore BatteryServuce and WindowConvering properly on start up.
- Improve state determination for WindowCovering.


[unreleased]: https://github.com/itavero/homebridge-z2m/compare/v1.11.0-beta.6...HEAD
[1.11.0-beta.6]: https://github.com/itavero/homebridge-z2m/compare/v1.11.0-beta.5...v1.11.0-beta.6
[1.11.0-beta.5]: https://github.com/itavero/homebridge-z2m/compare/v1.11.0-beta.4...v1.11.0-beta.5
[1.11.0-beta.4]: https://github.com/itavero/homebridge-z2m/compare/v1.11.0-beta.3...v1.11.0-beta.4
[1.11.0-beta.3]: https://github.com/itavero/homebridge-z2m/compare/v1.11.0-beta.2...v1.11.0-beta.3
[1.11.0-beta.2]: https://github.com/itavero/homebridge-z2m/compare/v1.11.0-beta.1...v1.11.0-beta.2
[1.11.0-beta.1]: https://github.com/itavero/homebridge-z2m/compare/v1.11.0-beta.0...v1.11.0-beta.1
[1.9.2]: https://github.com/itavero/homebridge-z2m/compare/v1.9.1...v1.9.2
[1.9.1]: https://github.com/itavero/homebridge-z2m/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/itavero/homebridge-z2m/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/itavero/homebridge-z2m/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/itavero/homebridge-z2m/compare/v1.7.0-rc.1...v1.7.0
[1.7.0-rc.1]: https://github.com/itavero/homebridge-z2m/compare/v1.6.2...v1.7.0-rc.1
[1.6.2]: https://github.com/itavero/homebridge-z2m/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/itavero/homebridge-z2m/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/itavero/homebridge-z2m/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/itavero/homebridge-z2m/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/itavero/homebridge-z2m/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/itavero/homebridge-z2m/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/itavero/homebridge-z2m/compare/v1.1.3...v1.2.0
[1.1.3]: https://github.com/itavero/homebridge-z2m/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/itavero/homebridge-z2m/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/itavero/homebridge-z2m/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/itavero/homebridge-z2m/compare/v1.1.0-beta.4...v1.1.0
[1.1.0-beta.4]: https://github.com/itavero/homebridge-z2m/compare/v1.1.0-beta.3...v1.1.0-beta.4
[1.1.0-beta.3]: https://github.com/itavero/homebridge-z2m/compare/v1.1.0-beta.2...v1.1.0-beta.3
[1.1.0-beta.2]: https://github.com/itavero/homebridge-z2m/compare/v1.1.0-beta.1...v1.1.0-beta.2
[1.1.0-beta.1]: https://github.com/itavero/homebridge-z2m/compare/v1.1.0-beta.0...v1.1.0-beta.1
[1.1.0-beta.0]: https://github.com/itavero/homebridge-z2m/compare/v1.0.2...v1.1.0-beta.0
[1.0.2]: https://github.com/itavero/homebridge-z2m/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/itavero/homebridge-z2m/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/itavero/homebridge-z2m/compare/v0.0.10...v1.0.0
[0.0.10]: https://github.com/itavero/homebridge-z2m/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/itavero/homebridge-z2m/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/itavero/homebridge-z2m/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/itavero/homebridge-z2m/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/itavero/homebridge-z2m/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/itavero/homebridge-z2m/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/itavero/homebridge-z2m/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/itavero/homebridge-z2m/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/itavero/homebridge-z2m/tree/v0.0.2
