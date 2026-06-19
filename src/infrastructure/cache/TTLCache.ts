const DEFAULT_MAX_ENTRIES = 500;

export class TTLCache<T> {
  private store = new Map<string, { data: T; expiresAt: number }>();
  private maxEntries: number;

  constructor(
    private defaultTTLMs: number = 30_000,
    maxEntries?: number,
  ) {
    this.maxEntries = maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    this.store.delete(key);
    return undefined;
  }

  set(key: string, data: T, ttlMs?: number): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, { data, expiresAt: Date.now() + (ttlMs ?? this.defaultTTLMs) });
  }

  invalidate(keyPrefix?: string): void {
    if (keyPrefix === undefined) {
      this.store.clear();
    } else {
      for (const key of this.store.keys()) {
        if (key.startsWith(keyPrefix)) this.store.delete(key);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }
}
