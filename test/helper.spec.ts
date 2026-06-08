import { getAllEndpoints, parseBridgeOnlineState, sanitizeAccessoryName, sanitizeAndFilterExposesEntries } from '../src/helpers';
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

  describe('sanitizeAccessoryName', () => {
    test('leaves a simple ASCII name unchanged', () => {
      expect(sanitizeAccessoryName('Living Room Light')).toBe('Living Room Light');
    });

    test('replaces disallowed ASCII characters with spaces', () => {
      expect(sanitizeAccessoryName('Kitchen@Light!')).toBe('Kitchen Light');
    });

    test('preserves hyphen (allowed by HAP-NodeJS)', () => {
      expect(sanitizeAccessoryName('Kitchen-Light')).toBe('Kitchen-Light');
    });

    test('preserves period and comma (allowed by HAP-NodeJS)', () => {
      expect(sanitizeAccessoryName('Dr. Smith, Jr')).toBe('Dr. Smith, Jr');
    });

    test('preserves Unicode right single quotation mark U+2019 (allowed by HAP-NodeJS)', () => {
      expect(sanitizeAccessoryName('Bob\u2019s Light')).toBe('Bob\u2019s Light');
    });

    test('strips trailing characters not allowed at end by HAP-NodeJS', () => {
      expect(sanitizeAccessoryName('My Device-')).toBe('My Device');
    });

    test('strips trailing characters not allowed at end (period)', () => {
      expect(sanitizeAccessoryName('My Device.')).toBe('My Device');
    });

    test('collapses multiple spaces into one', () => {
      expect(sanitizeAccessoryName('My  Device')).toBe('My Device');
    });

    test('removes leading special characters', () => {
      expect(sanitizeAccessoryName('---My Device')).toBe('My Device');
    });

    test('removes trailing spaces', () => {
      expect(sanitizeAccessoryName('My Device   ')).toBe('My Device');
    });

    test('preserves Cyrillic characters (e.g. Ukrainian device names)', () => {
      expect(sanitizeAccessoryName('Кухня')).toBe('Кухня');
    });

    test('preserves Cyrillic characters mixed with hyphen', () => {
      expect(sanitizeAccessoryName('Кухня-Світло')).toBe('Кухня-Світло');
    });

    test('preserves Chinese characters', () => {
      expect(sanitizeAccessoryName('厨房灯')).toBe('厨房灯');
    });

    test('preserves Arabic characters', () => {
      expect(sanitizeAccessoryName('مصباح المطبخ')).toBe('مصباح المطبخ');
    });

    test('returns undefined when all characters would be stripped', () => {
      // A name made purely of characters that would be stripped (e.g. emoji-only)
      expect(sanitizeAccessoryName('🏠')).toBeUndefined();
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
