export interface Cache {
  get(key: string): Promise<unknown | undefined> | unknown | undefined;
  set(key: string, value: unknown, ttlMs: number): Promise<void> | void;
  delete?(key: string): Promise<void> | void;
}
export class MemoryCache implements Cache {
  private entries = new Map<string, { value: unknown; expires: number }>();
  constructor(readonly maxEntries = 256) {}
  get(key: string): unknown | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expires) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: unknown, ttlMs: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + ttlMs });
    while (this.entries.size > this.maxEntries)
      this.entries.delete(this.entries.keys().next().value!);
  }
  delete(key: string): void {
    this.entries.delete(key);
  }
}
