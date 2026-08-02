import * as hapNodeJs from '@homebridge/hap-nodejs';
import { vi } from 'vitest';
import { IrBlasterCreator } from '../src/converters/ir_blaster';
import { hap, setHap } from '../src/hap';
import { ExposesEntry } from '../src/z2mModels';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';

describe('IR Blaster', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Tuya ZS06', () => {
    let deviceExposes: ExposesEntry[] = [];

    beforeAll(() => {
      deviceExposes = loadExposesFromFile('tuya/zs06.json');
      expect(deviceExposes.length).toBeGreaterThan(0);
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('No config: warning logged, no services created', () => {
      const harness = new ServiceHandlersTestHarness();
      harness.callCreators(deviceExposes);

      expect(harness.accessoryMock.log.warn).toHaveBeenCalledTimes(1);
      expect(harness.accessoryMock.registerServiceHandler).not.toHaveBeenCalled();
    });

    test('Empty commands array: warning logged, no services created', () => {
      const harness = new ServiceHandlersTestHarness();
      harness.addConverterConfiguration(IrBlasterCreator.CONFIG_TAG, { commands: [] });
      harness.callCreators(deviceExposes);

      expect(harness.accessoryMock.log.warn).toHaveBeenCalledTimes(1);
      expect(harness.accessoryMock.registerServiceHandler).not.toHaveBeenCalled();
    });

    describe('With two configured commands', () => {
      const commands = [
        { name: 'AC On', value: 'CODE_AC_ON' },
        { name: 'AC Off', value: 'CODE_AC_OFF' },
      ];

      let harness: ServiceHandlersTestHarness;

      beforeEach(() => {
        if (harness === undefined) {
          const newHarness = new ServiceHandlersTestHarness();
          newHarness.addConverterConfiguration(IrBlasterCreator.CONFIG_TAG, { commands });

          newHarness.getOrAddHandler(hap.Service.Switch, 'ir_command_0').addExpectedCharacteristic('on', hap.Characteristic.On, true);

          newHarness.getOrAddHandler(hap.Service.Switch, 'ir_command_1').addExpectedCharacteristic('on', hap.Characteristic.On, true);

          newHarness.prepareCreationMocks();
          newHarness.callCreators(deviceExposes);
          newHarness.checkCreationExpectations();
          newHarness.checkHasMainCharacteristics();
          newHarness.checkExpectedGetableKeys([]);
          harness = newHarness;
        }
        harness.clearMocks();
      });

      test('Set ON: queues ir_code_to_send and resets characteristic to OFF', () => {
        expect(harness).toBeDefined();

        const handler = harness.getOrAddHandler(hap.Service.Switch, 'ir_command_0');
        handler.callAndCheckHomeKitSetCallback('on', true);

        expect(harness.accessoryMock.queueDataForSetAction).toHaveBeenCalledTimes(1);
        expect(harness.accessoryMock.queueDataForSetAction).toHaveBeenCalledWith({ ir_code_to_send: 'CODE_AC_ON' });

        handler.checkCharacteristicUpdateValue('on', false);
      });

      test('Set OFF: no action queued', () => {
        expect(harness).toBeDefined();

        const handler = harness.getOrAddHandler(hap.Service.Switch, 'ir_command_0');
        handler.callAndCheckHomeKitSetCallback('on', false);

        expect(harness.accessoryMock.queueDataForSetAction).not.toHaveBeenCalled();
      });

      test('Second command queues correct IR code', () => {
        expect(harness).toBeDefined();

        const handler = harness.getOrAddHandler(hap.Service.Switch, 'ir_command_1');
        handler.callAndCheckHomeKitSetCallback('on', true);

        expect(harness.accessoryMock.queueDataForSetAction).toHaveBeenCalledWith({ ir_code_to_send: 'CODE_AC_OFF' });
      });

      test('updateState: no-op', () => {
        expect(harness).toBeDefined();
        expect(() => {
          harness.getOrAddHandler(hap.Service.Switch, 'ir_command_0');
          // Trigger updateState via the harness accessory (indirectly via service handler)
          // biome-ignore lint/suspicious/noExplicitAny: accessing private test-only handler map
          const serviceHandlerTestData = (harness as any).handlers.get(`${hap.Service.Switch.UUID}_ir_command_0`);
          serviceHandlerTestData?.serviceHandler?.updateState({ ir_code_to_send: 'CODE_AC_ON' });
        }).not.toThrow();
      });
    });
  });
});
