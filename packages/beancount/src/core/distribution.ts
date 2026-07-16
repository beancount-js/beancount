/** Accumulates a histogram and exposes the bounds and deterministic mode. */
export class Distribution<T extends number = number> {
  readonly histogram = new Map<T, number>();

  empty() {
    return this.histogram.size === 0;
  }

  update(value: T) {
    this.histogram.set(value, (this.histogram.get(value) ?? 0) + 1);
  }

  updateFrom(other: Distribution<T>) {
    for (const [value, count] of other.histogram) {
      this.histogram.set(value, (this.histogram.get(value) ?? 0) + count);
    }
  }

  min(): T | null {
    return this.values().at(0) ?? null;
  }

  max(): T | null {
    return this.values().at(-1) ?? null;
  }

  mode(): T | null {
    let result: T | null = null;
    let maximum = 0;
    for (const value of this.values()) {
      const count = this.histogram.get(value)!;
      if (count >= maximum) {
        result = value;
        maximum = count;
      }
    }
    return result;
  }

  private values() {
    return [...this.histogram.keys()].sort((left, right) => left - right);
  }
}
