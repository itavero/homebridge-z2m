import { PlatformConfig } from 'homebridge';
import { isPluginConfiguration } from '../src/configModels';
import { BasicServiceCreatorManager } from '../src/converters/creators';
import * as hapNodeJs from '@homebridge/hap-nodejs';
import { setHap } from '../src/hap';

/* eslint-disable-next-line @typescript-eslint/no-extraneous-class */
class ConsoleLogger {
  /* eslint-disable no-console */
  static error(message: string) {
    console.error(message);
  }

  static warn(message: string) {
    console.warn(message);
  }

  static info(message: string) {
    console.info(message);
  }

  static debug(message: string) {
    console.debug(message);
  }
}

describe('Plugin configuration', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  const minimalValidConfiguration: PlatformConfig = {
    platform: 'zigbee2mqtt',
    mqtt: {
      server: 'http://localhost:1883',
      base_topic: 'zigbee2mqtt',
    },
  };
  it('accepts the minimum valid configuration', () => {
    expect(isPluginConfiguration(minimalValidConfiguration, BasicServiceCreatorManager.getInstance(), ConsoleLogger)).toBe(true);
  });

  it('requires MQTT server to be defined', () => {
    const config: PlatformConfig = {
      ...minimalValidConfiguration,
    };
    config.mqtt = { base_topic: 'zigbee2mqtt' };
    expect(isPluginConfiguration(config, BasicServiceCreatorManager.getInstance())).toBe(false);
  });

  it('requires MQTT base topic to be defined', () => {
    const config: PlatformConfig = {
      ...minimalValidConfiguration,
    };
    config.mqtt = { server: 'http://localhost:1883' };
    expect(isPluginConfiguration(config, BasicServiceCreatorManager.getInstance())).toBe(false);
  });

  it('requires experimental (if defined) to be a string array', () => {
    const configWithNoArray: PlatformConfig = {
      ...minimalValidConfiguration,
      experimental: 'not an array',
    };
    expect(isPluginConfiguration(configWithNoArray, BasicServiceCreatorManager.getInstance())).toBe(false);

    const configWithInvalidTypes: PlatformConfig = {
      ...minimalValidConfiguration,
      experimental: ['this is ok', 'the next value is not', 0],
    };
    expect(isPluginConfiguration(configWithInvalidTypes, BasicServiceCreatorManager.getInstance())).toBe(false);

    const configValid: PlatformConfig = {
      ...minimalValidConfiguration,
      experimental: ['this', 'is', 'all', 'valid'],
    };
    expect(isPluginConfiguration(configValid, BasicServiceCreatorManager.getInstance())).toBe(true);
  });

  it('requires exclude_grouped_devices (if defined) to be a boolean', () => {
    const configInvalid: PlatformConfig = {
      ...minimalValidConfiguration,
      exclude_grouped_devices: 'y',
    };
    expect(isPluginConfiguration(configInvalid, BasicServiceCreatorManager.getInstance())).toBe(false);

    const configValid: PlatformConfig = {
      ...minimalValidConfiguration,
      exclude_grouped_devices: true,
    };
    expect(isPluginConfiguration(configValid, BasicServiceCreatorManager.getInstance())).toBe(true);
  });

  describe('requires valid defaults', () => {
    it('with a boolean exclude value (if present)', () => {
      const configInvalid: PlatformConfig = {
        ...minimalValidConfiguration,
        defaults: {
          exclude: 'y',
        },
      };
      expect(isPluginConfiguration(configInvalid, BasicServiceCreatorManager.getInstance())).toBe(false);

      const configValid: PlatformConfig = {
        ...minimalValidConfiguration,
        defaults: {
          exclude: true,
        },
      };
      expect(isPluginConfiguration(configValid, BasicServiceCreatorManager.getInstance())).toBe(true);
    });

    it('with excluded_keys as a string array (if present)', () => {
      const configNotAnArray: PlatformConfig = {
        ...minimalValidConfiguration,
        defaults: {
          excluded_keys: 'y',
        },
      };
      expect(isPluginConfiguration(configNotAnArray, BasicServiceCreatorManager.getInstance())).toBe(false);

      const configArrayWithInvalidTypes: PlatformConfig = {
        ...minimalValidConfiguration,
        defaults: {
          excluded_keys: ['some', 'key', 0],
        },
      };
      expect(isPluginConfiguration(configArrayWithInvalidTypes, BasicServiceCreatorManager.getInstance())).toBe(false);

      const configValid: PlatformConfig = {
        ...minimalValidConfiguration,
        defaults: {
          excluded_keys: ['some', 'key'],
        },
      };
      expect(isPluginConfiguration(configValid, BasicServiceCreatorManager.getInstance())).toBe(true);
    });

    describe('with valid devices config', () => {
      it('devices as object', () => {
        const configDevicesNotAnArray: PlatformConfig = { ...minimalValidConfiguration, devices: { '0x123': 'not an array' } };
        expect(isPluginConfiguration(configDevicesNotAnArray, BasicServiceCreatorManager.getInstance())).toBe(false);
      });
      it('device without ID', () => {
        const configDevicesNotAnArray: PlatformConfig = { ...minimalValidConfiguration, devices: [{ exclude: false }] };
        expect(isPluginConfiguration(configDevicesNotAnArray, BasicServiceCreatorManager.getInstance())).toBe(false);
      });
      it('device with invalid config', () => {
        const configDevicesNotAnArray: PlatformConfig = {
          ...minimalValidConfiguration,
          devices: [{ id: '0x1234', ignore_availability: 'nope' }],
        };
        expect(isPluginConfiguration(configDevicesNotAnArray, BasicServiceCreatorManager.getInstance())).toBe(false);
      });
      it('device with valid config', () => {
        const configDevicesNotAnArray: PlatformConfig = {
          ...minimalValidConfiguration,
          devices: [{ id: '0x1234', ignore_availability: true }],
        };
        expect(isPluginConfiguration(configDevicesNotAnArray, BasicServiceCreatorManager.getInstance())).toBe(true);
      });
    });

    it('with experimental as a string array (if present)', () => {
      const configNotAnArray: PlatformConfig = {
        ...minimalValidConfiguration,
        defaults: {
          experimental: 'y',
        },
      };
      expect(isPluginConfiguration(configNotAnArray, BasicServiceCreatorManager.getInstance())).toBe(false);

      const configArrayWithInvalidTypes: PlatformConfig = {
        ...minimalValidConfiguration,
        defaults: {
          experimental: ['some', 'key', 0],
        },
      };
      expect(isPluginConfiguration(configArrayWithInvalidTypes, BasicServiceCreatorManager.getInstance())).toBe(false);

      const configValid: PlatformConfig = {
        ...minimalValidConfiguration,
        defaults: {
          experimental: ['some', 'key'],
        },
      };
      expect(isPluginConfiguration(configValid, BasicServiceCreatorManager.getInstance())).toBe(true);
    });

    describe('for converters', () => {
      it('may only contain configurations for known converters', () => {
        const configInvalid: PlatformConfig = {
          ...minimalValidConfiguration,
          defaults: {
            converters: {
              unknown: {
                type: 'unknown',
              },
            },
          },
        };
        expect(isPluginConfiguration(configInvalid, BasicServiceCreatorManager.getInstance())).toBe(false);
      });

      it.each`
        converter      | type           | expected
        ${'occupancy'} | ${'occupancy'} | ${true}
        ${'occupancy'} | ${'motion'}    | ${true}
        ${'occupancy'} | ${'contact'}   | ${false}
        ${'occupancy'} | ${1}           | ${false}
        ${'switch'}    | ${'switch'}    | ${true}
        ${'switch'}    | ${'outlet'}    | ${true}
        ${'switch'}    | ${'contact'}   | ${false}
        ${'switch'}    | ${1}           | ${false}
      `(
        'validates converter config for $converter if type is set to $type correctly (result: $expected)',
        ({ converter, type, expected }) => {
          const config: PlatformConfig = {
            ...minimalValidConfiguration,
            defaults: {
              converters: {},
            },
          };
          config.defaults.converters[converter] = {
            type: type,
          };
          expect(isPluginConfiguration(config, BasicServiceCreatorManager.getInstance())).toBe(expected);
        }
      );
    });
  });
});
