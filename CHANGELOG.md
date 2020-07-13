# Changelog
All notable changes to this project will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
As soon as the project reaches a mature and stable state, the first major version (1.0.0) will be made
and after the project will apply [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased][]
### Added

- Support for switches (relays) with more than two outputs (added a lot of keys starting with `state_`).
- Carbon Monoxide Sensor support.

### Changed

- Call to `registerPlatform` changed to include package name (see [#8](https://github.com/itavero/homebridge-z2m/issues/6)).

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


[Unreleased]: https://github.com/itavero/homebridge-z2m/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/itavero/homebridge-z2m/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/itavero/homebridge-z2m/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/itavero/homebridge-z2m/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/itavero/homebridge-z2m/tree/v0.0.2