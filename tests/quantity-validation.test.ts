import { describe, it, expect } from 'vitest';
import { validateTargetCount } from '../src/shared/utils.js';
import {
  PREDEFINED_TARGET_OPTIONS,
  MIN_TARGET_POSTS,
  MAX_TARGET_POSTS,
} from '../src/shared/constants.js';

describe('Quantity Validation', () => {
  it('validates all predefined options successfully', () => {
    for (const opt of PREDEFINED_TARGET_OPTIONS) {
      const result = validateTargetCount(opt, MIN_TARGET_POSTS, MAX_TARGET_POSTS);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(opt);
      expect(result.error).toBeUndefined();
    }
  });

  it('validates valid custom integer values within range', () => {
    const customValid = [1, 7, 25, 75, 250, 500];
    for (const val of customValid) {
      const result = validateTargetCount(val, MIN_TARGET_POSTS, MAX_TARGET_POSTS);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(val);
    }
  });

  it('rejects values below the minimum limit', () => {
    const resultZero = validateTargetCount(0, MIN_TARGET_POSTS, MAX_TARGET_POSTS);
    expect(resultZero.isValid).toBe(false);
    expect(resultZero.error).toContain('Minimum');

    const resultNegative = validateTargetCount(-10, MIN_TARGET_POSTS, MAX_TARGET_POSTS);
    expect(resultNegative.isValid).toBe(false);
  });

  it('rejects values above the maximum configurable limit', () => {
    const resultOver = validateTargetCount(501, MIN_TARGET_POSTS, MAX_TARGET_POSTS);
    expect(resultOver.isValid).toBe(false);
    expect(resultOver.error).toContain('Maximum');
  });

  it('rejects non-integer and NaN values', () => {
    const resultFloat = validateTargetCount(12.5, MIN_TARGET_POSTS, MAX_TARGET_POSTS);
    expect(resultFloat.isValid).toBe(false);
    expect(resultFloat.error).toContain('whole number');

    const resultNaN = validateTargetCount(NaN, MIN_TARGET_POSTS, MAX_TARGET_POSTS);
    expect(resultNaN.isValid).toBe(false);
  });
});
