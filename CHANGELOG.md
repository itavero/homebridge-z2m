# Changelog
All notable changes to this project will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Since version 1.0.0, we try to follow the [Semantic Versioning](https://semver.org/spec/v2.0.0.html) standard.

## [Unreleased]
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


[Unreleased]: https://github.com/itavero/homebridge-z2m/compare/v1.1.0-beta.1...HEAD
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