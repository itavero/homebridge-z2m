# Changelog
All notable changes to this project will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
As soon as the project reaches a mature and stable state, the first major version (1.0.0) will be made
and after the project will apply [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased][]
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


[Unreleased]: https://github.com/itavero/homebridge-z2m/compare/v0.0.9...HEAD
[0.0.9]: https://github.com/itavero/homebridge-z2m/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/itavero/homebridge-z2m/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/itavero/homebridge-z2m/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/itavero/homebridge-z2m/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/itavero/homebridge-z2m/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/itavero/homebridge-z2m/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/itavero/homebridge-z2m/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/itavero/homebridge-z2m/tree/v0.0.2