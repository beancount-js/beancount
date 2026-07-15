/** A tiny async queue used to expose app-server notifications as a stream. */
export class AsyncEventQueue<T> implements AsyncIterable<T> {
  #values: T[] = [];
  #waiters: Array<(result: IteratorResult<T>) => void> = [];
  #closed = false;

  push(value: T) {
    if (this.#closed) return;
    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter({ value, done: false });
      return;
    }
    this.#values.push(value);
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    for (const waiter of this.#waiters.splice(0)) {
      waiter({ value: undefined as T, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const value = this.#values.shift();
        if (value !== undefined) return Promise.resolve({ value, done: false });
        if (this.#closed)
          return Promise.resolve({ value: undefined as T, done: true });
        return new Promise<IteratorResult<T>>((resolve) =>
          this.#waiters.push(resolve),
        );
      },
    };
  }
}
