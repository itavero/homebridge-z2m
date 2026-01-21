import { getAllEndpoints, parseBridgeOnlineState, sanitizeAndFilterExposesEntries } from '../src/helpers';
import { exposesCollectionsAreEqual, normalizeExposes } from '../src/z2mModels';
import { loadExposesFromFile } from './testHelpers';

describe('Helper functions', () => {
  describe('parseBridgeOnlineState', () => {
    test('returns true for z2m 2.0+ JSON format with state online', () => {
      expect(parseBridgeOnlineState('{"state":"online"}')).toBe(true);
    });

    test('returns false for z2m 2.0+ JSON format with state offline', () => {
      expect(parseBridgeOnlineState('{"state":"offline"}')).toBe(false);
    });

    test('returns true for legacy plain string format online', () => {
      expect(parseBridgeOnlineState('online')).toBe(true);
    });

    test('returns false for legacy plain string format offline', () => {
      expect(parseBridgeOnlineState('offline')).toBe(false);
    });

    test('returns true for JSON without state property (assumes online)', () => {
      expect(parseBridgeOnlineState('{"foo":"bar"}')).toBe(true);
    });

    test('returns true for JSON with non-string state (assumes online)', () => {
      expect(parseBridgeOnlineState('{"state":123}')).toBe(true);
    });

    test('returns true for JSON array (assumes online)', () => {
      expect(parseBridgeOnlineState('["online"]')).toBe(true);
    });

    test('returns true for JSON null (assumes online)', () => {
      expect(parseBridgeOnlineState('null')).toBe(true);
    });
  });

  describe('parseDeviceAvailability', () => {
    const parseDeviceAvailability = (statePayload: string): boolean => {
      let isAvailable = false;
      if (statePayload.includes('{')) {
        const json = JSON.parse(statePayload);
        if (json !== undefined) {
          isAvailable = json.state === 'online' || json.availability?.state === 'online';
        }
      } else {
        isAvailable = statePayload === 'online';
      }
      return isAvailable;
    };

    test('returns true for z2m 2.0+ JSON format with state online', () => {
      expect(parseDeviceAvailability('{"state":"online"}')).toBe(true);
    });

    test('returns false for z2m 2.0+ JSON format with state offline', () => {
      expect(parseDeviceAvailability('{"state":"offline"}')).toBe(false);
    });

    test('returns true for legacy plain string format online', () => {
      expect(parseDeviceAvailability('online')).toBe(true);
    });

    test('returns false for legacy plain string format offline', () => {
      expect(parseDeviceAvailability('offline')).toBe(false);
    });

    test('returns false for JSON without state property', () => {
      expect(parseDeviceAvailability('{"foo":"bar"}')).toBe(false);
    });

    test('returns false for empty JSON object', () => {
      expect(parseDeviceAvailability('{}')).toBe(false);
    });

    test('handles legacy nested availability.state format (online)', () => {
      expect(parseDeviceAvailability('{"availability":{"state":"online"}}')).toBe(true);
    });

    test('handles legacy nested availability.state format (offline)', () => {
      expect(parseDeviceAvailability('{"availability":{"state":"offline"}}')).toBe(false);
    });

    test('prefers top-level state when both formats present', () => {
      // Top-level state="online" should make device available even if nested is offline
      expect(parseDeviceAvailability('{"state":"online","availability":{"state":"offline"}}')).toBe(true);
    });

    test('returns true if either state path is online (OR logic)', () => {
      expect(parseDeviceAvailability('{"state":"offline","availability":{"state":"online"}}')).toBe(true);
    });

    test('handles JSON with additional properties', () => {
      expect(parseDeviceAvailability('{"state":"online","last_seen":1234567890}')).toBe(true);
      expect(parseDeviceAvailability('{"state":"offline","last_seen":1234567890}')).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(parseDeviceAvailability('')).toBe(false);
    });

    test('returns false for non-matching plain strings', () => {
      expect(parseDeviceAvailability('available')).toBe(false);
      expect(parseDeviceAvailability('true')).toBe(false);
    });
  });

  test('Add missing endpoints to ExposesEntry', () => {
    const exposes = loadExposesFromFile('aqara/znddmk11lm.json');
    const sanitized = sanitizeAndFilterExposesEntries(exposes);

    // Should not be identical, as explicit endpoint information is added.
    expect(exposesCollectionsAreEqual(exposes, sanitized)).toBe(false);

    // After normalization (a.k.a. removing endpoints), the collections should be identical.
    const originalNormalized = normalizeExposes(exposes);
    const sanitizedNormalized = normalizeExposes(sanitized);
    expect(exposesCollectionsAreEqual(originalNormalized, sanitizedNormalized)).toBe(true);

    // TODO: Check if the added endpoints are correct (a.k.a. if it is actually sanitized)
  });

  test('Get all endpoints', () => {
    const exposes = loadExposesFromFile('tuya/ts0115.json');
    const endpoints = getAllEndpoints(exposes);
    endpoints.sort();

    const expectedEndpoints = [undefined, 'l1', 'l2', 'l3', 'l4', 'l5'];
    expectedEndpoints.sort();

    expect(endpoints).toEqual(expectedEndpoints);
  });
});
