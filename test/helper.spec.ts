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
