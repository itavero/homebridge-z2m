import { getAllEndpoints, parseBridgeStatePayload, sanitizeAndFilterExposesEntries } from '../src/helpers';
import { exposesCollectionsAreEqual, normalizeExposes } from '../src/z2mModels';
import { loadExposesFromFile } from './testHelpers';

describe('Helper functions', () => {
  describe('parseBridgeStatePayload', () => {
    test('parses z2m 2.0+ JSON format with state online', () => {
      expect(parseBridgeStatePayload('{"state":"online"}')).toBe('online');
    });

    test('parses z2m 2.0+ JSON format with state offline', () => {
      expect(parseBridgeStatePayload('{"state":"offline"}')).toBe('offline');
    });

    test('parses legacy plain string format online', () => {
      expect(parseBridgeStatePayload('online')).toBe('online');
    });

    test('parses legacy plain string format offline', () => {
      expect(parseBridgeStatePayload('offline')).toBe('offline');
    });

    test('returns raw payload for JSON without state property', () => {
      expect(parseBridgeStatePayload('{"foo":"bar"}')).toBe('{"foo":"bar"}');
    });

    test('returns raw payload for JSON with non-string state', () => {
      expect(parseBridgeStatePayload('{"state":123}')).toBe('{"state":123}');
    });

    test('returns raw payload for JSON array', () => {
      expect(parseBridgeStatePayload('["online"]')).toBe('["online"]');
    });

    test('returns raw payload for JSON null', () => {
      expect(parseBridgeStatePayload('null')).toBe('null');
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
