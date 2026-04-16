import * as hapNodeJs from '@homebridge/hap-nodejs';
import { vi } from 'vitest';
import { hap, setHap } from '../src/hap';
import { ExposesEntry } from '../src/z2mModels';
import { loadExposesFromFile, ServiceHandlersTestHarness } from './testHelpers';

describe('Cover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
        newHarness.checkHasMainCharacteristics();
        newHarness.checkExpectedGetableKeys(['position']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
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
      vi.runOnlyPendingTimers();
      windowCovering.checkNoCharacteristicUpdates();
      harness.checkNoGetKeysQueued();

      // Check changing the position to the same value as was last received
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { position: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED]]));
      harness.clearMocks();

      // Check timer - should request position
      vi.runOnlyPendingTimers();
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
        newHarness.checkHasMainCharacteristics();
        newHarness.checkExpectedGetableKeys(['position', 'tilt']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
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
        newHarness.checkHasMainCharacteristics();
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
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
      vi.runOnlyPendingTimers();
      windowCovering.checkNoCharacteristicUpdates();
      harness.checkNoGetKeysQueued();

      // Check changing the position to the same value as was last received
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 49, { tilt: 49 });
      windowCovering.checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED]]));
      harness.clearMocks();

      // Check timer - should request position
      vi.runOnlyPendingTimers();
      harness.checkGetKeysQueued('tilt');
      harness.clearMocks();
    });

    test('HomeKit: Hold position', () => {
      expect(harness).toBeDefined();

      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'state', true, { state: 'STOP' });
    });
  });

  describe('Bosch Light/shutter control unit II', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('bosch/bmct-slz.json');
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
        newHarness.checkHasMainCharacteristics();
        newHarness.checkExpectedGetableKeys(['position']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('Status update is handled: Position changes', () => {
      expect(harness).toBeDefined();

      // First update (previous state is unknown, so)
      harness.checkUpdateState(
        '{"position":100, "motor_state":"stopped"}',
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

      // Ignore known stopped position
      harness.checkUpdateStateIsIgnored('{"position":100, "motor_state":"stopped"}');
      harness.clearMocks();

      // Check changing the position to a lower value
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 51, { position: 51 });
      harness.getOrAddHandler(hap.Service.WindowCovering).checkCharacteristicUpdates(new Map([[hap.Characteristic.TargetPosition, 51]]));
      harness.clearMocks();

      harness.checkUpdateState(
        '{"position":41, "motor_state":"closing"}',
        hap.Service.WindowCovering,
        new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING]])
      );
      harness.clearMocks();

      harness.checkUpdateState(
        '{"position":51, "motor_state":"stopped"}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 51],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 51],
        ])
      );
      harness.clearMocks();
    });
  });

  describe('Inverted cover (without motor_state)', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('inverted_cover/without_motor_state.json');
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
        newHarness.checkHasMainCharacteristics();
        newHarness.checkExpectedGetableKeys(['position']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('Status update is handled: Position inverted correctly', () => {
      expect(harness).toBeDefined();

      // Z2M position 100 = physically closed → HomeKit should show 0 (closed)
      harness.checkUpdateState(
        '{"position":100}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 0],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 0],
        ])
      );
      harness.clearMocks();

      // Z2M position 0 = physically open → HomeKit should show 100 (open)
      harness.checkUpdateState(
        '{"position":0}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 100],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
      harness.clearMocks();

      // Z2M position 50 = half-open → HomeKit should show 50
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
    });

    test('HomeKit: Change target position is inverted correctly', () => {
      expect(harness).toBeDefined();

      // Set current position to known value (Z2M 100 = closed → HomeKit 0)
      harness.checkUpdateState(
        '{"position":100}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 0],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 0],
        ])
      );
      harness.clearMocks();

      // HomeKit requests open (100) → should send Z2M position 0 and show INCREASING
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 100, { position: 0 });
      const windowCovering = harness
        .getOrAddHandler(hap.Service.WindowCovering)
        .checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING]]));
      harness.clearMocks();

      // First update equal to the target (Z2M echoes back position 0) should be ignored
      harness.checkUpdateStateIsIgnored('{"position":0}');
      harness.clearMocks();

      // Cover is moving towards open (Z2M 50 → HomeKit 50)
      harness.checkUpdateState('{"position":50}', hap.Service.WindowCovering, new Map([[hap.Characteristic.CurrentPosition, 50]]));
      harness.clearMocks();

      // Cover arrives at open position: two identical updates stop the timer
      harness.checkUpdateState('{"position":0}', hap.Service.WindowCovering, new Map([[hap.Characteristic.CurrentPosition, 100]]));
      harness.clearMocks();
      harness.checkUpdateState(
        '{"position":0}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 100],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
      harness.clearMocks();

      // HomeKit requests close (0) → should send Z2M position 100 and show DECREASING
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 0, { position: 100 });
      windowCovering.checkCharacteristicUpdates(new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING]]));
      harness.clearMocks();
    });
  });

  describe('Inverted cover (with motor_state)', () => {
    // Shared "state"
    let deviceExposes: ExposesEntry[] = [];
    let harness: ServiceHandlersTestHarness;

    beforeEach(() => {
      // Only test service creation for first test case and reuse harness afterwards
      if (deviceExposes.length === 0 && harness === undefined) {
        // Load exposes from JSON
        deviceExposes = loadExposesFromFile('inverted_cover/with_motor_state.json');
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
        newHarness.checkHasMainCharacteristics();
        newHarness.checkExpectedGetableKeys(['position']);
        harness = newHarness;
      }
      harness?.clearMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('Status update is handled: Position inverted correctly', () => {
      expect(harness).toBeDefined();

      // Z2M position 100 + stopped = physically closed → HomeKit should show 0 (closed)
      harness.checkUpdateState(
        '{"position":100, "motor_state":"stopped"}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 0],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 0],
        ])
      );
      harness.clearMocks();

      // Cover starts opening (motor_state transitions → HomeKit shows INCREASING + guesses TargetPosition)
      harness.checkUpdateState(
        '{"position":50, "motor_state":"opening"}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
      harness.clearMocks();

      // Z2M position 0 + stopped = physically open → HomeKit should show 100 (open)
      harness.checkUpdateState(
        '{"position":0, "motor_state":"stopped"}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 100],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
      harness.clearMocks();
    });

    test('HomeKit: Change target position is inverted correctly', () => {
      expect(harness).toBeDefined();

      // State carried from previous test: position=0 (Z2M=open), motor_state=stopped
      // Duplicate stopped state → nothing should update
      harness.checkUpdateStateIsIgnored('{"position":0, "motor_state":"stopped"}');
      harness.clearMocks();

      // HomeKit requests close (0) → should send Z2M position 100, set TargetPosition=0 in HomeKit
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 0, { position: 100 });
      harness.getOrAddHandler(hap.Service.WindowCovering).checkCharacteristicUpdates(new Map([[hap.Characteristic.TargetPosition, 0]]));
      harness.clearMocks();

      // Z2M echoes back the position set (position 100 = equal to lastPositionSet → ignored)
      harness.checkUpdateStateIsIgnored('{"position":100, "motor_state":"stopped"}');
      harness.clearMocks();

      // Z2M reports closing in progress
      harness.checkUpdateState(
        '{"position":50, "motor_state":"closing"}',
        hap.Service.WindowCovering,
        new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.DECREASING]])
      );
      harness.clearMocks();

      // Z2M reports stopped at closed position (Z2M 100 = closed → HomeKit 0)
      harness.checkUpdateState(
        '{"position":100, "motor_state":"stopped"}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 0],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 0],
        ])
      );
      harness.clearMocks();

      // HomeKit requests open (100) → should send Z2M position 0, set TargetPosition=100 in HomeKit
      harness.checkHomeKitUpdate(hap.Service.WindowCovering, 'target_position', 100, { position: 0 });
      harness.getOrAddHandler(hap.Service.WindowCovering).checkCharacteristicUpdates(new Map([[hap.Characteristic.TargetPosition, 100]]));
      harness.clearMocks();

      // Z2M reports opening in progress
      harness.checkUpdateState(
        '{"position":50, "motor_state":"opening"}',
        hap.Service.WindowCovering,
        new Map([[hap.Characteristic.PositionState, hap.Characteristic.PositionState.INCREASING]])
      );
      harness.clearMocks();

      // Z2M reports stopped at open position (Z2M 0 = open → HomeKit 100)
      harness.checkUpdateState(
        '{"position":0, "motor_state":"stopped"}',
        hap.Service.WindowCovering,
        new Map([
          [hap.Characteristic.CurrentPosition, 100],
          [hap.Characteristic.PositionState, hap.Characteristic.PositionState.STOPPED],
          [hap.Characteristic.TargetPosition, 100],
        ])
      );
      harness.clearMocks();
    });
  });
});
