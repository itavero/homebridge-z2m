import { resetAllWhenMocks, verifyAllWhenMocksCalled } from 'jest-when';
import { ExposesEntry } from '../src/z2mModels';
import { setHap, hap } from '../src/hap';
import * as hapNodeJs from 'hap-nodejs';
import 'jest-chain';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';

jest.useFakeTimers();

describe('Cover', () => {
  beforeAll(() => {
    setHap(hapNodeJs);
  });

  describe('IKEA KADRILJ roller blind', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('ikea/e1926.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        const windowCovering = newHarness
          .getOrAddHandler(hap.Service.WindowCovering)
          .addExpectedCharacteristic('position', hap.Characteristic.CurrentPosition, false)
          .addExpectedCharacteristic('target_position', hap.Characteristic.TargetPosition, true)
          .addExpectedCharacteristic('position_state', hap.Characteristic.PositionState, false)
          .addExpectedCharacteristic('state', hap.Characteristic.HoldPosition, true);
        newHarness.prepareCreationMocks();

        const positionCharacteristicMock = windowCovering.getCharacteristicMock('position');
        if (positionCharacteristicMock !== undefined) {
          positionCharacteristicMock.props.minValue = 0;
          positionCharacteristicMock.props.maxValue = 100;
        }

        const targetPositionCharacteristicMock = windowCovering.getCharacteristicMock('target_position');
        if (targetPositionCharacteristicMock !== undefined) {
          targetPositionCharacteristicMock.props.minValue = 0;
          targetPositionCharacteristicMock.props.maxValue = 100;
        }

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys(['position']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: Position changes', () => {
      expect(harness).toBeDefined();

      // First update (previous state is unknown, so)
      harness.checkUpdateState(
        '{"position":100}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 100],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
      harness.clearMocks();
    });

    test('HomeKit: Hold position', () => {
      expect(harness).toBeDefined();

      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'state', true, { state: 'STOP' });
    });

    test('HomeKit: Change target position', () => {
      expect(harness).toBeDefined();

      // Set current position to a known value, to check assumed position state
      harness.checkUpdateState(
        '{"position":50}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 50],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 50],
        ])
      );
      harness.clearMocks();

      // Check changing the position to a higher value
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 51, { position: 51 });
      const windowCovering = harness
        .getOrAddHandler(hap.Service.WindowCovering)
        .checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING]]));
      harness.clearMocks();

      // Receive status update with target position that was previously send.
      // This should be ignored.
      harness.checkUpdateStateIsIgnored('{"position":51}');
      harness.clearMocks();

      // Check changing the position to a lower value
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { position: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING]]));
      harness.clearMocks();

      // Send two updates - should stop timer
      harness.checkUpdateState('{"position":51}', hap.Service.WindowCovering, new Map([[hap.Characteristic.CurrentPosition, 51]]));
      harness.clearMocks();
      harness.checkUpdateState('{"position":49}', hap.Service.WindowCovering, new Map([[hap.Characteristic.CurrentPosition, 49]]));
      harness.clearMocks();
      harness.checkUpdateState(
        '{"position":49}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 49],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 49],
        ])
      );
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      windowCovering.checkNoCharacteristicUpdates();
      harness.checkNoGetKeysQueued();

      // Check changing the position to the same value as was last received
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { position: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED]]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      harness.checkGetKeysQueued('position');
      harness.clearMocks();
    });
  });

  describe('Insta Flush-Mount Blinds Actuator', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('insta/57008000.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        const windowCovering = newHarness
          .getOrAddHandler(hap.Service.WindowCovering)
          .addExpectedCharacteristic('position', hap.Characteristic.CurrentPosition, false)
          .addExpectedCharacteristic('target_position', hap.Characteristic.TargetPosition, true)
          .addExpectedCharacteristic('position_state', hap.Characteristic.PositionState, false)
          .addExpectedCharacteristic('tilt', hap.Characteristic.CurrentHorizontalTiltAngle, false)
          .addExpectedCharacteristic('target_tilt', hap.Characteristic.TargetHorizontalTiltAngle, true)
          .addExpectedCharacteristic('state', hap.Characteristic.HoldPosition, true);
        newHarness.prepareCreationMocks();

        const positionCharacteristicMock = windowCovering.getCharacteristicMock('position');
        if (positionCharacteristicMock !== undefined) {
          positionCharacteristicMock.props.minValue = 0;
          positionCharacteristicMock.props.maxValue = 100;
        }

        const targetPositionCharacteristicMock = windowCovering.getCharacteristicMock('target_position');
        if (targetPositionCharacteristicMock !== undefined) {
          targetPositionCharacteristicMock.props.minValue = 0;
          targetPositionCharacteristicMock.props.maxValue = 100;
        }

        const tiltCharacteristicMock = windowCovering.getCharacteristicMock('tilt');
        if (tiltCharacteristicMock !== undefined) {
          tiltCharacteristicMock.props.minValue = -90;
          tiltCharacteristicMock.props.maxValue = 90;
        }

        const targetTiltCharacteristicMock = windowCovering.getCharacteristicMock('target_tilt');
        if (targetTiltCharacteristicMock !== undefined) {
          targetTiltCharacteristicMock.props.minValue = -90;
          targetTiltCharacteristicMock.props.maxValue = 90;
        }

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        newHarness.checkExpectedGetableKeys(['position', 'tilt']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Check new changed Tilt', () => {
      expect(harness).toBeDefined();

      // Expect CurrentHorizontalTiltAngle to be retrieved to determine range
      harness.getOrAddHandler(hap.Service.WindowCovering).prepareGetCharacteristicMock('tilt');

      // External tilt update 100%
      harness.checkUpdateState(
        '{"position":100, "tilt":100}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 100],
          [hap.Characteristic.CurrentHorizontalTiltAngle, 90],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
      harness.clearMocks();

      // External tilt update 50%
      harness.checkUpdateState(
        '{"position":100, "tilt":50}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 100],
          [hap.Characteristic.CurrentHorizontalTiltAngle, 0],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
      harness.clearMocks();

      // External tilt update 0%
      harness.checkUpdateState(
        '{"position":100, "tilt":0}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 100],
          [hap.Characteristic.CurrentHorizontalTiltAngle, -90],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
    });

    test('HomeKit: Change target tilt', () => {
      expect(harness).toBeDefined();

      // Check changing the tilt to -90°
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_tilt', -90, { tilt: 0 });
      harness.clearMocks();

      // Check changing the tilt to -90°
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_tilt', 0, { tilt: 50 });
      harness.clearMocks();

      // Check changing the tilt to -90°
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_tilt', 90, { tilt: 100 });
      harness.clearMocks();
    });

    test('HomeKit: Hold position', () => {
      expect(harness).toBeDefined();

      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'state', true, { state: 'STOP' });
    });
  });

  describe('Current Products Corp CP180335E-01', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes information from file
        deviceExposes = loadExposesFromFile('current_products_corp/cp180335e-01.json');
        expect(deviceExposes.length).toBeGreaterThan(0);
        const newHarness = new ServiceHandlersTestHarness();

        // Check service creation
        const windowCovering = newHarness
          .getOrAddHandler(hap.Service.WindowCovering)
          .addExpectedCharacteristic('position', hap.Characteristic.CurrentPosition, false, 'tilt')
          .addExpectedCharacteristic('target_position', hap.Characteristic.TargetPosition, true)
          .addExpectedCharacteristic('position_state', hap.Characteristic.PositionState, false)
          .addExpectedCharacteristic('state', hap.Characteristic.HoldPosition, true);
        newHarness.prepareCreationMocks();

        const positionCharacteristicMock = windowCovering.getCharacteristicMock('position');
        if (positionCharacteristicMock !== undefined) {
          positionCharacteristicMock.props.minValue = 0;
          positionCharacteristicMock.props.maxValue = 100;
        }

        const targetPositionCharacteristicMock = windowCovering.getCharacteristicMock('target_position');
        if (targetPositionCharacteristicMock !== undefined) {
          targetPositionCharacteristicMock.props.minValue = 0;
          targetPositionCharacteristicMock.props.maxValue = 100;
        }

        newHarness.callCreators(deviceExposes);

        newHarness.checkCreationExpectations();
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      verifyAllWhenMocksCalled();
      resetAllWhenMocks();
    });

    test('Status update is handled: Position changes', () => {
      expect(harness).toBeDefined();

      // First update (previous state is unknown, so)
      harness.checkUpdateState(
        '{"tilt":100}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 100],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
      harness.clearMocks();
    });

    test('HomeKit: Change target position', () => {
      expect(harness).toBeDefined();

      // Set current position to a known value, to check assumed position state
      harness.checkUpdateState(
        '{"tilt":50}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 50],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 50],
        ])
      );
      harness.clearMocks();

      // Check changing the position to a higher value
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 51, { tilt: 51 });
      const windowCovering = harness
        .getOrAddHandler(hap.Service.WindowCovering)
        .checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING]]));
      harness.clearMocks();

      // Receive status update with target position that was previously send.
      // This should be ignored.
      harness.checkUpdateStateIsIgnored('{"tilt":51}');
      harness.clearMocks();

      // Check changing the position to a lower value
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { tilt: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING]]));
      harness.clearMocks();

      // Send two updates - should stop timer
      harness.checkUpdateState('{"tilt":51}', hap.Service.WindowCovering, new Map([[hap.Characteristic.CurrentPosition, 51]]));
      harness.clearMocks();
      harness.checkUpdateState('{"tilt":49}', hap.Service.WindowCovering, new Map([[hap.Characteristic.CurrentPosition, 49]]));
      harness.clearMocks();
      harness.checkUpdateState(
        '{"tilt":49}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 49],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 49],
        ])
      );
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      windowCovering.checkNoCharacteristicUpdates();
      harness.checkNoGetKeysQueued();

      // Check changing the position to the same value as was last received
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { tilt: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED]]));
      harness.clearMocks();

      // Check timer - should request position
      jest.runOnlyPendingTimers();
      harness.checkGetKeysQueued('tilt');
      harness.clearMocks();
    });

    test('HomeKit: Hold position', () => {
      expect(harness).toBeDefined();

      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'state', true, { state: 'STOP' });
    });
  });
});
