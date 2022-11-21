import 'jest-chain';
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
    test('availability (simple) set to true with empty passlist', () => {
      const config: object = {
        availability: true,
        advanced: {
          availability_passlist: [],
        },
      };
      expect(isAvailabilityEnabledGlobally(config)).toBe(true);
    });
    test('availability (simple) set to true with non-empty passlist', () => {
      const config: object = {
        availability: true,
        advanced: {
          availability_passlist: ['0x1234'],
        },
      };
      expect(isAvailabilityEnabledGlobally(config)).toBe(false);
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
    test('devices and pass list, block list ignored', () => {
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
          availability_passlist: ['device_d', 'device_e'],
          availability_whitelist: ['device_f'],
          availability_blocklist: ['device_g', 'device_h'],
        },
      };

      const result = getAvailabilityConfigurationForDevices(config);
      const expect_enabled = ['device_a', 'device_d', 'device_e', 'device_f'].sort();
      const expect_disabled = ['device_b'].sort();
      expect(result.enabled.sort()).toEqual(expect_enabled);
      expect(result.disabled.sort()).toEqual(expect_disabled);
    });
    test('devices and block list, empty pass list', () => {
      const config = {
        devices: {
          device_a: {
            availability: false,
          },
          device_b: {
            availability: true,
          },
          device_c: {
            transition: 4,
          },
        },
        advanced: {
          availability_blocklist: ['device_d', 'device_e'],
          availability_blacklist: ['device_f', 'device_g'],
        },
      };

      const result = getAvailabilityConfigurationForDevices(config);
      const expect_enabled = ['device_b'].sort();
      const expect_disabled = ['device_a', 'device_d', 'device_e', 'device_f', 'device_g'].sort();
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
