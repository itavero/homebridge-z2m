import * as hapNodeJs from '@homebridge/hap-nodejs';
import { PlatformAccessory, Service } from 'homebridge';
import { mock, mockDeep } from 'vitest-mock-extended';
import { ServiceCreatorManager } from '../src/converters/creators';
import { setHap } from '../src/hap';
import { Zigbee2mqttPlatform } from '../src/platform';
import { Zigbee2mqttAccessory } from '../src/platformAccessory';
import { DeviceListEntry } from '../src/z2mModels';

/**
 * Creates a minimal mock PlatformAccessory with the given context values.
 */
function createMockPlatformAccessory(context: Record<string, unknown>): PlatformAccessory {
  const serviceMock = mock<Service>();
  serviceMock.UUID = hapNodeJs.Service.AccessoryInformation.UUID;
  serviceMock.subtype = undefined;
  serviceMock.getCharacteristic.mockReturnValue(mock());
  serviceMock.updateCharacteristic.mockReturnThis();

  const accessory = mock<PlatformAccessory>();
  accessory.context = context;
  accessory.services = [serviceMock];
  accessory.addService.mockReturnValue(serviceMock);
  return accessory;
}

function createMinimalDevice(friendlyName: string, ieeeAddress: string): DeviceListEntry {
  return {
    friendly_name: friendlyName,
    ieee_address: ieeeAddress,
    supported: true,
    definition: null,
  };
}

describe('Zigbee2mqttAccessory', () => {
  let platform: ReturnType<typeof mockDeep<Zigbee2mqttPlatform>>;
  let noopServiceCreator: ServiceCreatorManager;

  beforeAll(() => {
    setHap(hapNodeJs);
  });

  beforeEach(() => {
    platform = mockDeep<Zigbee2mqttPlatform>();
    platform.log.debug.mockReturnValue(undefined);
    platform.log.warn.mockReturnValue(undefined);
    platform.log.error.mockReturnValue(undefined);
    platform.log.info.mockReturnValue(undefined);
    platform.api.updatePlatformAccessories.mockReturnValue(undefined);
    platform.config = undefined;
    noopServiceCreator = {
      createHomeKitEntitiesFromExposes: () => {
        /* no-op */
      },
    };
  });

  describe('displayName', () => {
    test('returns friendly_name for a regular (non-split) accessory', () => {
      const device = createMinimalDevice('My Device', '0xABCDEF1234567890');
      const accessory = createMockPlatformAccessory({ device });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.displayName).toBe('My Device');
    });

    test('returns friendly_name + endpoint for a split endpoint accessory', () => {
      const device = createMinimalDevice('My Device', '0xABCDEF1234567890');
      const accessory = createMockPlatformAccessory({
        device,
        isSplitEndpoint: true,
        splitEndpoint: 'left',
      });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.displayName).toBe('My Device left');
    });

    test('returns friendly_name when isSplitEndpoint is false', () => {
      const device = createMinimalDevice('My Device', '0xABCDEF1234567890');
      const accessory = createMockPlatformAccessory({
        device,
        isSplitEndpoint: false,
        splitEndpoint: 'left',
      });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.displayName).toBe('My Device');
    });

    test('returns friendly_name when splitEndpoint is undefined even if isSplitEndpoint is true', () => {
      const device = createMinimalDevice('My Device', '0xABCDEF1234567890');
      const accessory = createMockPlatformAccessory({
        device,
        isSplitEndpoint: true,
        splitEndpoint: undefined,
      });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.displayName).toBe('My Device');
    });
  });

  describe('serialNumber', () => {
    test('returns ieee_address for a regular (non-split) accessory', () => {
      const ieee = '0xABCDEF1234567890';
      const device = createMinimalDevice('My Device', ieee);
      const accessory = createMockPlatformAccessory({ device });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.serialNumber).toBe(ieee);
    });

    test('returns ieee_address:endpoint for a split endpoint accessory', () => {
      const ieee = '0xABCDEF1234567890';
      const device = createMinimalDevice('My Device', ieee);
      const accessory = createMockPlatformAccessory({
        device,
        isSplitEndpoint: true,
        splitEndpoint: 'left',
      });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.serialNumber).toBe(`${ieee}:left`);
    });

    test('returns ieee_address for a split accessory when splitEndpoint is undefined', () => {
      const ieee = '0xABCDEF1234567890';
      const device = createMinimalDevice('My Device', ieee);
      const accessory = createMockPlatformAccessory({
        device,
        isSplitEndpoint: true,
        splitEndpoint: undefined,
      });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.serialNumber).toBe(ieee);
    });

    test('returns GROUP:<id> for a group accessory', () => {
      const device = {
        ...createMinimalDevice('My Group', '0x0'),
        group_id: 42,
      };
      const accessory = createMockPlatformAccessory({ device });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.serialNumber).toBe('GROUP:42');
    });
  });

  describe('matchesIdentifier', () => {
    test('matches by ieee_address', () => {
      const ieee = '0xABCDEF1234567890';
      const device = createMinimalDevice('My Device', ieee);
      const accessory = createMockPlatformAccessory({ device });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.matchesIdentifier(ieee)).toBe(true);
      expect(acc.matchesIdentifier('wrong')).toBe(false);
    });

    test('matches by friendly_name', () => {
      const device = createMinimalDevice('My Device', '0xABCDEF1234567890');
      const accessory = createMockPlatformAccessory({ device });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      expect(acc.matchesIdentifier('My Device')).toBe(true);
    });

    test('split endpoint accessory matches by the base device ieee_address (receives shared MQTT updates)', () => {
      const ieee = '0xABCDEF1234567890';
      const device = createMinimalDevice('My Device', ieee);
      const accessory = createMockPlatformAccessory({
        device,
        isSplitEndpoint: true,
        splitEndpoint: 'left',
      });
      const acc = new Zigbee2mqttAccessory(platform, accessory, {}, noopServiceCreator);

      // Split endpoint accessories should still match by ieee_address so they
      // receive MQTT state updates for the device they belong to.
      expect(acc.matchesIdentifier(ieee)).toBe(true);
    });
  });
});
