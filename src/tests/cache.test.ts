import { TTLCache } from '../infrastructure/cache/TTLCache';
import { describe, it, expect, vi } from 'vitest';

describe('TTLCache', () => {
  it('should evict the oldest key when size exceeds max entries', () => {
    const cache = new TTLCache<string>(10_000, 2);

    cache.set('key1', 'val1');
    cache.set('key2', 'val2');
    expect(cache.size).toBe(2);

    // This should evict key1
    cache.set('key3', 'val3');
    expect(cache.size).toBe(2);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('val2');
    expect(cache.get('key3')).toBe('val3');
  });

  it('should invalidate specific key prefix or clear all', () => {
    const cache = new TTLCache<string>(10_000);

    cache.set('user_1_dash', 'dash1');
    cache.set('user_1_recs', 'recs1');
    cache.set('user_2_dash', 'dash2');

    cache.invalidate('user_1');
    expect(cache.get('user_1_dash')).toBeUndefined();
    expect(cache.get('user_1_recs')).toBeUndefined();
    expect(cache.get('user_2_dash')).toBe('dash2');

    cache.invalidate();
    expect(cache.get('user_2_dash')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('should return undefined and delete key if entry has expired', () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string>(100);

    cache.set('key', 'val');
    expect(cache.get('key')).toBe('val');

    vi.advanceTimersByTime(150);
    expect(cache.get('key')).toBeUndefined();
    expect(cache.size).toBe(0);

    vi.useRealTimers();
  });
});
