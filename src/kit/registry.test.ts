import { describe, expect, it } from 'vitest';
import { kitRegistry, seedFromId, wireframeKit, diagramKit } from './registry';

describe('kit registry', () => {
  it('has unique types', () => {
    expect(kitRegistry.size).toBe(wireframeKit.length + diagramKit.length);
  });
  it('every item has sane sizes and a description', () => {
    for (const def of kitRegistry.values()) {
      expect(def.defaultSize.w).toBeGreaterThanOrEqual(def.minSize.w);
      expect(def.defaultSize.h).toBeGreaterThanOrEqual(def.minSize.h);
      expect(def.describe(def.defaultProps)).toMatch(/\S/);
    }
  });
  it('seedFromId is stable and positive', () => {
    expect(seedFromId('abc')).toBe(seedFromId('abc'));
    expect(seedFromId('abc')).toBeGreaterThan(0);
  });
});
