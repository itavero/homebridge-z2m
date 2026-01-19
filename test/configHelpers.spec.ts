import { getAvailabilityConfigurationForDevices, isAvailabilityEnabledGlobally } from '../src/configHelpers';

describe('Zigbee2MQTT Config Helper functions', () => {
  describe('isAvailabilityEnabledGlobally', () => {
    test('availability not set', () => {
      const config = {};
      expect(isAvailabilityEnabledGlobally(config)).toBe(false);
    });
    test('availability_timeout set to 0', () => {
      const config = {
        advanced: {
          availability_timeout: 0,
        },
      };
      expect(isAvailabilityEnabledGlobally(config)).toBe(false);
    });
    test('availability_timeout set to positive value', () => {
      const config = {
        advanced: {
          availability_timeout: 1,
        },
      };
      expect(isAvailabilityEnabledGlobally(config)).toBe(true);
    });
    test('availability (simple) set to false', () => {
      const config: object = {
        availability: false,
      };
      expect(isAvailabilityEnabledGlobally(config)).toBe(false);
    });
    test('availability (simple) set to true', () => {
      const config: object = {
        availability: true,
      };
      expect(isAvailabilityEnabledGlobally(config)).toBe(true);
    });
    test('availability (advanced) timeout set for active devices', () => {
      const config: object = {
        availability: {
          active: {
            timeout: 10,
          },
        },
      };
      expect(isAvailabilityEnabledGlobally(config)).toBe(true);
    });
    test('availability (advanced) timeout set for passive devices', () => {
      const config: object = {
        availability: {
          passive: {
            timeout: 1500,
          },
        },
      };
      expect(isAvailabilityEnabledGlobally(config)).toBe(true);
    });
    test('availability (advanced) configuration is empty, assume disabled', () => {
      const config: object = {
        availability: {},
      };
      expect(isAvailabilityEnabledGlobally(config)).toBe(true);
    });
  });

  describe('getAvailabilityConfigurationForDevices', () => {
    test('devices with availability configuration (legacy passlist/blocklist no longer supported)', () => {
      const config = {
        devices: {
          device_a: {
            availability: true,
          },
          device_b: {
            availability: false,
          },
          device_c: {
            transition: 4,
          },
        },
        advanced: {
          // These legacy settings are ignored (removed in zigbee2mqtt v2)
          availability_passlist: ['device_d', 'device_e'],
          availability_whitelist: ['device_f'],
          availability_blocklist: ['device_g', 'device_h'],
        },
      };

      const result = getAvailabilityConfigurationForDevices(config);
      // Only device-specific config is used, legacy passlist/blocklist are ignored
      const expect_enabled = ['device_a'].sort();
      const expect_disabled = ['device_b'].sort();
      expect(result.enabled.sort()).toEqual(expect_enabled);
      expect(result.disabled.sort()).toEqual(expect_disabled);
    });
    test('no pass or block list, only device config', () => {
      const config = {
        devices: {
          device_a: {
            availability: true,
          },
          device_b: {
            availability: false,
          },
          device_c: {
            transition: 4,
          },
        },
        advanced: {
          some_other_setting: 'some_value',
        },
      };

      const result = getAvailabilityConfigurationForDevices(config);
      const expect_enabled = ['device_a'].sort();
      const expect_disabled = ['device_b'].sort();
      expect(result.enabled.sort()).toEqual(expect_enabled);
      expect(result.disabled.sort()).toEqual(expect_disabled);
    });
  });
});
