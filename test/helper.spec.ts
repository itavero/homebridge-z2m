import { filterExposesEntriesByEndpoint, getAllEndpoints, parseBridgeOnlineState, sanitizeAndFilterExposesEntries } from '../src/helpers';
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

  describe('filterExposesEntriesByEndpoint', () => {
    test('returns only entries for the specified endpoint', () => {
      const exposes = loadExposesFromFile('tuya/ts0115.json');

      const l1Entries = filterExposesEntriesByEndpoint(exposes, 'l1');
      expect(l1Entries).toHaveLength(1);
      expect(l1Entries[0].endpoint).toBe('l1');

      const l2Entries = filterExposesEntriesByEndpoint(exposes, 'l2');
      expect(l2Entries).toHaveLength(1);
      expect(l2Entries[0].endpoint).toBe('l2');
    });

    test('returns entries with no endpoint when filtering for undefined', () => {
      const exposes = loadExposesFromFile('tuya/ts0115.json');

      const undefinedEntries = filterExposesEntriesByEndpoint(exposes, undefined);
      // Only 'power_on_behavior' has no endpoint
      expect(undefinedEntries).toHaveLength(1);
      expect(undefinedEntries[0].name).toBe('power_on_behavior');
    });

    test('returns empty array when no entries match the endpoint', () => {
      const exposes = loadExposesFromFile('tuya/ts0115.json');

      const nonExistentEntries = filterExposesEntriesByEndpoint(exposes, 'nonexistent');
      expect(nonExistentEntries).toHaveLength(0);
    });

    test('covers all entries when filtering for all known endpoints', () => {
      const exposes = loadExposesFromFile('tuya/ts0115.json');
      const endpoints = getAllEndpoints(exposes);

      const allFilteredEntries = endpoints.flatMap((ep) => filterExposesEntriesByEndpoint(exposes, ep));
      // ts0115 has 5 switch entries (l1-l5) + 1 power_on_behavior = 6 total
      expect(allFilteredEntries).toHaveLength(exposes.length);
    });

    test('handles entries with parent endpoint inheritance for composite types', () => {
      // aqara/znddmk11lm has composite entries where features inherit endpoint
      const exposes = loadExposesFromFile('aqara/znddmk11lm.json');
      const endpoints = getAllEndpoints(exposes);

      // All endpoints should return non-empty results
      for (const endpoint of endpoints) {
        const filtered = filterExposesEntriesByEndpoint(exposes, endpoint);
        expect(filtered.length).toBeGreaterThan(0);
        // All returned entries should have the matching effective endpoint
        for (const entry of filtered) {
          expect(entry.endpoint).toBe(endpoint);
        }
      }

      // Endpoint 'l1' should return the light composite entry
      const l1Entries = filterExposesEntriesByEndpoint(exposes, 'l1');
      expect(l1Entries).toHaveLength(1);
      expect(l1Entries[0].type).toBe('light');
      expect(l1Entries[0].endpoint).toBe('l1');

      // Endpoint 'l2' should return the other light composite entry
      const l2Entries = filterExposesEntriesByEndpoint(exposes, 'l2');
      expect(l2Entries).toHaveLength(1);
      expect(l2Entries[0].type).toBe('light');
      expect(l2Entries[0].endpoint).toBe('l2');

      // Undefined endpoint should return entries without an explicit endpoint (power, energy, etc.)
      const undefinedEntries = filterExposesEntriesByEndpoint(exposes, undefined);
      expect(undefinedEntries.length).toBeGreaterThan(0);
      for (const entry of undefinedEntries) {
        expect(entry.endpoint).toBeUndefined();
      }
    });
  });
});
