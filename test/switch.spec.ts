import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';

describe('Switch', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('IKEA TRADFRI control outlet', () => {
    describe('as Switch', () => {
      // Shared "state"
      let deviceExposes: ExposesEntry[] = [];
      let harness: ServiceHandlersTestHarness;

      beforeEach(() => {
        // Only test service creation for first test case and reuse harness afterwards
        if (deviceExposes.length === 0 && harness === undefined) {
          // Load exposes from JSON
          deviceExposes = loadExposesFromFile('ikea/e1603_e1702_e1708.json');
          expect(deviceExposes.length).toBeGreaterThan(0);
          const newHarness = new ServiceHandlersTestHarness();

          // Check service creation
          newHarness.getOrAddHandler(hap.Service.Switch).addExpectedCharacteristic('state', hap.Characteristic.On, true);
          newHarness.prepareCreationMocks();

          newHarness.callCreators(deviceExposes);

          newHarness.checkCreationExpectations();
          newHarness.checkExpectedGetableKeys(['state']);
          harness = newHarness;
        }
        harness?.clearMocks();
      });

      afterEach(() => {
        verifyAllWhenMocksCalled();
        resetAllWhenMocks();
      });

      test('Status update is handled: On', () => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Switch, hap.Characteristic.On, true);
      });

      test('Status update is handled: Off', () => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState('{"state":"OFF"}', hap.Service.Switch, hap.Characteristic.On, false);
      });

      test('Status update is handled: Toggle', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateStateIsIgnored('{"state":"TOGGLE"}');
      });

      test('HomeKit: Turn On', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Switch, 'state', true, 'ON');
      });

      test('HomeKit: Turn Off', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Switch, 'state', false, 'OFF');
      });
    });

    describe('as Outlet', () => {
      // Shared "state"
      let deviceExposes: ExposesEntry[] = [];
      let harness: ServiceHandlersTestHarness;

      beforeEach(() => {
        // Only test service creation for first test case and reuse harness afterwards
        if (deviceExposes.length === 0 && harness === undefined) {
          // Load exposes from JSON
          deviceExposes = loadExposesFromFile('ikea/e1603_e1702_e1708.json');
          const newHarness = new ServiceHandlersTestHarness();

          // Check service creation
          newHarness.addConverterConfiguration('switch', { type: 'outlet' });
          newHarness.getOrAddHandler(hap.Service.Outlet).addExpectedCharacteristic('state', hap.Characteristic.On, true);
          newHarness.prepareCreationMocks();

          newHarness.callCreators(deviceExposes);

          newHarness.checkCreationExpectations();
          newHarness.checkExpectedGetableKeys(['state']);
          harness = newHarness;
        }
        harness?.clearMocks();
      });

      afterEach(() => {
        verifyAllWhenMocksCalled();
        resetAllWhenMocks();
      });

      test('Status update is handled: On', () => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState('{"state":"ON"}', hap.Service.Outlet, hap.Characteristic.On, true);
      });

      test('Status update is handled: Off', () => {
        expect(harness).toBeDefined();
        harness.checkSingleUpdateState('{"state":"OFF"}', hap.Service.Outlet, hap.Characteristic.On, false);
      });

      test('Status update is handled: Toggle', () => {
        expect(harness).toBeDefined();
        harness.checkUpdateStateIsIgnored('{"state":"TOGGLE"}');
      });

      test('HomeKit: Turn On', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Outlet, 'state', true, 'ON');
      });

      test('HomeKit: Turn Off', () => {
        expect(harness).toBeDefined();
        harness.checkHomeKitUpdateWithSingleValue(hap.Service.Outlet, 'state', false, 'OFF');
      });
    });
  });

  describe('Ubisys S2', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('ubisys/s2.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        newHarness.getOrAddHandler(hap.Service.Switch, 'l1').addExpectedCharacteristic('state_l1', hap.Characteristic.On, true);
        newHarness.getOrAddHandler(hap.Service.Switch, 'l2').addExpectedCharacteristic('state_l2', hap.Characteristic.On, true);
        newHarness.prepareCreationMocks();

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys(['state_l1', 'state_l2']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: On (L1)', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state_l1":"ON"}',
        harness.generateServiceId(hap.Service.Switch, 'l1'), hap.Characteristic.On, true);
    });

    test('Status update is handled: Off (L2)', () => {
      expect(harness).toBeDefined();
      harness.checkSingleUpdateState('{"state_l2":"OFF"}',
        harness.generateServiceId(hap.Service.Switch, 'l2'), hap.Characteristic.On, false);
    });

    test('Status update is handled: Toggle', () => {
      expect(harness).toBeDefined();
      harness.checkUpdateStateIsIgnored('{"state_l1":"TOGGLE","state_l2":"TOGGLE"}');
    });

    test('HomeKit: Turn On (L1)', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(harness.generateServiceId(hap.Service.Switch, 'l1'), 'state_l1', true, 'ON');
    });

    test('HomeKit: Turn Off (L1)', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(harness.generateServiceId(hap.Service.Switch, 'l1'), 'state_l1', false, 'OFF');
    });

    test('HomeKit: Turn On (L2)', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(harness.generateServiceId(hap.Service.Switch, 'l2'), 'state_l2', true, 'ON');
    });

    test('HomeKit: Turn Off (L2)', () => {
      expect(harness).toBeDefined();
      harness.checkHomeKitUpdateWithSingleValue(harness.generateServiceId(hap.Service.Switch, 'l2'), 'state_l2', false, 'OFF');
    });
  });
});