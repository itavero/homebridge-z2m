import 'jest-chain';
import 'jest';
import { isDeviceDefinition, isDeviceListEntry, isExposesEntry, isGroupListEntry, isGroupMember } from '../src/z2mModels';

describe('z2mModels', () => {
  describe('isDeviceDefinition', () => {
    it('does check on null', () => {
      expect(isDeviceDefinition(null)).toBe(false);
    });
    it('does check on undefined', () => {
      expect(isDeviceDefinition(undefined)).toBe(false);
    });
  });
  describe('isDeviceListEntry', () => {
    it('does check on null', () => {
      expect(isDeviceListEntry(null)).toBe(false);
    });
    it('does check on undefined', () => {
      expect(isDeviceListEntry(undefined)).toBe(false);
    });
  });
  describe('isExposesEntry', () => {
    it('does check on null', () => {
      expect(isExposesEntry(null)).toBe(false);
    });
    it('does check on undefined', () => {
      expect(isExposesEntry(undefined)).toBe(false);
    });
  });
  describe('isGroupListEntry', () => {
    it('does check on null', () => {
      expect(isGroupListEntry(null)).toBe(false);
    });
    it('does check on undefined', () => {
      expect(isGroupListEntry(undefined)).toBe(false);
    });
  });
  describe('isGroupMember', () => {
    it('does check on null', () => {
      expect(isGroupMember(null)).toBe(false);
    });
    it('does check on undefined', () => {
      expect(isGroupMember(undefined)).toBe(false);
    });
  });
});
