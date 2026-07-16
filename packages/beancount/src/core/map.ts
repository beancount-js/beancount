export class DefaultMap<K, V> extends Map<K, V> {
  private handler: (key: K, map: DefaultMap<K, V>) => V;

  constructor(
    handler: (key: K, map: DefaultMap<K, V>) => V,
    entries?: readonly (readonly [K, V])[] | null,
  ) {
    super();
    this.handler = handler;
    if (entries) {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    }
  }

  map<T>(mapper: (entry: [K, V]) => [string, T]): Record<string, T> {
    const data: Record<string, T> = {};
    for (const entry of this.entries()) {
      const [key, value] = mapper(entry);
      data[key] = value;
    }
    return data;
  }

  insert(key: K) {
    if (!this.has(key)) {
      super.set(key, this.handler(key, this));
    }
  }

  get(key: K): V {
    let value = super.get(key);
    if (value !== undefined) {
      return value;
    }

    value = this.handler(key, this);
    this.set(key, value);
    return value;
  }
}

export interface MapKey {
  hash: string;
}

export class DefaultKeyedMap<K extends MapKey, V> extends DefaultMap<K, V> {
  private mapKeys: Record<string, K> = {};

  constructor(
    handler: (key: K, map: DefaultMap<K, V>) => V,
    entries?: readonly (readonly [K, V])[] | null,
  ) {
    super(handler);
    if (entries) {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    }
  }

  clear() {
    super.clear();
    this.mapKeys = {};
  }

  keyFor(key: K, create: boolean = false): K {
    const id = key.hash;
    if (!this.mapKeys) {
      this.mapKeys = {};
    }
    if (this.mapKeys[id]) {
      return this.mapKeys[id];
    }
    if (create) {
      this.mapKeys[id] = key;
    }
    return key;
  }

  has(key: K): boolean {
    return super.has(this.keyFor(key));
  }

  set(key: K, value: V) {
    if (!key.hash) {
      return this;
    }
    key = this.keyFor(key, true);
    this.insert(key);
    return super.set(key, value);
  }

  delete(key: K): boolean {
    key = this.keyFor(key);
    if (super.delete(key)) {
      delete this.mapKeys[key.hash];
      return true;
    }
    return false;
  }

  get(key: K): V {
    key = this.keyFor(key);
    return super.get(key);
  }
}

export class CaseInsensitiveMap<T, U> extends Map<T, U> {
  constructor(entries?: readonly (readonly [T, U])[] | null) {
    super(entries);
  }

  set(key: T, value: U): this {
    if (typeof key === "string") {
      key = key.toLowerCase() as unknown as T;
    }
    return super.set(key, value);
  }

  get(key: T): U | undefined {
    if (typeof key === "string") {
      key = key.toLowerCase() as unknown as T;
    }

    return super.get(key);
  }

  has(key: T): boolean {
    if (typeof key === "string") {
      key = key.toLowerCase() as unknown as T;
    }

    return super.has(key);
  }
}
