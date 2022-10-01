import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { hap, setHap } from '../src/hap';
import { ExposesEntry } from '../src/z2mModels';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';
import { sanitizeAndFilterExposesEntries } from '../src/helpers';

describe('Action', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('Xiaomi WXKG07LM', () => {
    // Shared "state"
    const actionProperty = 'action';
    const serviceLabelCharacteristic = 'label';
    let serviceIdLeft = '';
    let serviceIdRight = '';
    let serviceIdBoth = '';
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('xiaomi/wxkg07lm.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Expect 3 services (one for each value)
        serviceIdLeft = `${hap.Service.StatelessProgrammableSwitch.UUID}#left`;
        const leftService = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'left', serviceIdLeft)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        serviceIdRight = `${hap.Service.StatelessProgrammableSwitch.UUID}#right`;
        const rightService = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'right', serviceIdRight)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        serviceIdBoth = `${hap.Service.StatelessProgrammableSwitch.UUID}#both`;
        const bothService = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'both', serviceIdBoth)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys([]);

        // Expect the correct event types to be enabled
        const expectedCharacteristicProps = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          validValues: [
            hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
            hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS,
            hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          ],
        };
        leftService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);
        rightService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);
        bothService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);

        // Expect the correct service label indexes to be set
        bothService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 1);
        leftService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 2);
        rightService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 3);

        // Store harness for future use
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: Left single', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"single_left"}',
          serviceIdLeft,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
        );
      }
    });

    test('Status update is handled: Right double', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"double_right"}',
          serviceIdRight,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS
        );
      }
    });

    test('Status update is handled: Both long', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"hold_both"}',
          serviceIdBoth,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS
        );
      }
    });
  });

  describe('IKEA TRADFRI open/close remote', () => {
    // Shared "state"
    const actionProperty = 'action';
    const serviceLabelCharacteristic = 'label';
    let serviceIdClose = '';
    let serviceIdOpen = '';
    let serviceIdStop = '';
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('ikea/e1766.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Expect 3 services (one for each value)
        serviceIdClose = `${hap.Service.StatelessProgrammableSwitch.UUID}#close`;
        const closeService = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'close', serviceIdClose)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        serviceIdOpen = `${hap.Service.StatelessProgrammableSwitch.UUID}#open`;
        const openService = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'open', serviceIdOpen)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        serviceIdStop = `${hap.Service.StatelessProgrammableSwitch.UUID}#stop`;
        const stopService = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'stop', serviceIdStop)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys([]);

        // Expect the correct event types to be enabled
        const expectedCharacteristicProps = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          validValues: [hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS],
        };
        closeService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);
        openService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);
        stopService.checkCharacteristicPropertiesHaveBeenSet(actionProperty, expectedCharacteristicProps);

        // Expect the correct service label indexes to be set
        closeService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 1);
        openService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 2);
        stopService.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 3);

        // Store harness for future use
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: Close', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"close"}',
          serviceIdClose,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
        );
      }
    });

    test('Status update is handled: Open', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"open"}',
          serviceIdOpen,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
        );
      }
    });

    test('Status update is handled: Stop', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"stop"}',
          serviceIdStop,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
        );
      }
    });

    test('Status update is handled: Empty', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkUpdateStateIsIgnored('{"action":""}');
      }
    });
  });

  // eslint-disable-next-line sonarjs/cognitive-complexity
  describe('Aqara Opple switch 3 bands', () => {
    // Shared "state"
    const actionProperty = 'action';
    const serviceLabelCharacteristic = 'label';
    let serviceIdButton1 = '';
    let serviceIdButton2 = '';
    let serviceIdButton5 = '';
    let serviceIdButton5E = '';
    let serviceIdButton6 = '';
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('xiaomi/wxcjkg13lm.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // For this test explicitly include certain values (to check that function from the accessory is used correctly)
        const allowedActionValues = [
          'button_1_hold',
          'button_1_release',
          'button_1_single',
          'button_1_double',
          'button_2_hold',
          'button_2_release',
          'button_2_single',
          'button_5_hold',
          'button_5_release',
          'button_5_triple',
          'button_6_hold',
          'button_6_release',
          'button_6_single',
          'button_6_double',
        ];
        deviceExposes = sanitizeAndFilterExposesEntries(deviceExposes, undefined, (e) => {
          if (e.property === 'action' && Array.isArray(e.values)) {
            return e.values.filter((v) => allowedActionValues.includes(v));
          }
          return e.values ?? [];
        });

        // Expect 4 services (one for each button)
        serviceIdButton1 = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_1`;
        const serviceButton1 = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_1', serviceIdButton1)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        serviceIdButton2 = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_2`;
        const serviceButton2 = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_2', serviceIdButton2)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        serviceIdButton5 = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_5`;
        const serviceButton5 = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_5', serviceIdButton5)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        serviceIdButton5E = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_5#ext1`;
        const serviceButton5E = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_5#ext1', serviceIdButton5E)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        serviceIdButton6 = `${hap.Service.StatelessProgrammableSwitch.UUID}#button_6`;
        const serviceButton6 = newHarness
          .getOrAddHandler(hap.Service.StatelessProgrammableSwitch, 'button_6', serviceIdButton6)
          .addExpectedCharacteristic(actionProperty, hap.Characteristic.ProgrammableSwitchEvent, false, actionProperty)
          .addExpectedCharacteristic(serviceLabelCharacteristic, hap.Characteristic.ServiceLabelIndex, false);

        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys([]);

        // Expect the correct event types to be enabled
        const allowAllEvents = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          validValues: [
            hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
            hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS,
            hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          ],
        };
        const allowSingleAndLong = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          validValues: [hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS, hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS],
        };
        const allowSingle = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          validValues: [hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS],
        };
        const allowLong = {
          minValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          maxValue: hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
          validValues: [hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS],
        };
        serviceButton1.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowAllEvents);
        serviceButton2.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowSingleAndLong);
        serviceButton5.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowLong);
        serviceButton5E.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowSingle);
        serviceButton6.checkCharacteristicPropertiesHaveBeenSet(actionProperty, allowAllEvents);

        // Expect the correct service label indexes to be set
        serviceButton1.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 10);
        serviceButton2.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 20);
        serviceButton5.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 50);
        serviceButton5E.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 51);
        serviceButton6.checkCharacteristicUpdateValue(serviceLabelCharacteristic, 60);

        // Store harness for future use
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update: button_1_single', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"button_1_single"}',
          serviceIdButton1,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
        );
      }
    });

    test('Status update: button_1_double', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"button_1_double"}',
          serviceIdButton1,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS
        );
      }
    });

    test('Status update: button_1_hold', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"button_1_hold"}',
          serviceIdButton1,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS
        );
      }
    });

    test('Status update: button_1_release (should be ignored)', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkUpdateStateIsIgnored('{"action":"button_1_release"}');
      }
    });

    test('Status update: button_2_single', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"button_2_single"}',
          serviceIdButton2,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
        );
      }
    });

    test('Status update is handled: button_2_double (ignored by accessory)', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkUpdateStateIsIgnored('{"action":"button_2_double"}');
      }
    });

    test('Status update: button_2_hold', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"button_2_hold"}',
          serviceIdButton2,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS
        );
      }
    });

    test('Status update: button_5_hold', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"button_5_hold"}',
          serviceIdButton5,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS
        );
      }
    });

    test('Status update: button_5_triple', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"button_5_triple"}',
          serviceIdButton5E,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
        );
      }
    });

    test('Status update: button_6_double', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkSingleUpdateState(
          '{"action":"button_6_double"}',
          serviceIdButton6,
          hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS
        );
      }
    });

    test('Status update is handled: Empty', () => {
      expect(harness).toBeDefined();
      if (harness !== undefined) {
        harness.checkUpdateStateIsIgnored('{"action":""}');
      }
    });
  });
});
