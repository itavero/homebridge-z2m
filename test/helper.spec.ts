
import 'jest-chain';
import { getAllEndpoints, sanitizeAndFilterExposesEntries } from '../src/helpers';
import { exposesCollectionsAreEqual, normalizeExposes } from '../src/z2mModels';
import { loadExposesFromFile } from './testHelpers';

describe('Helper functions', () => {

  test('Add missing endpoints to ExposesEntry', () => {
    const exposes = loadExposesFromFile('siglis/zfp-1a-ch.json');
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
    const exposes = loadExposesFromFile('siglis/zfp-1a-ch.json');
    const endpoints = getAllEndpoints(exposes);
    endpoints.sort();

    const expectedEndpoints = [
      undefined,
      'l1',
      'l2',
      'l3',
      'l4',
      'l5',
      'l6',
      'l7',
    ];
    expectedEndpoints.sort();

    expect(endpoints).toEqual(expectedEndpoints);
  });
});