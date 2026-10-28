import { derived, type Readable } from "svelte/store";

type StrictEquality = string | number | null;

/** Shallow equality of two arrays - the elements are compared strictly. */
export function shallowEqual<T extends StrictEquality>(
  a: readonly T[],
  b: readonly T[],
): boolean {
  const l = a.length;
  if (l !== b.length) {
    return false;
  }

  for (let i = 0; i < l; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Create a derived store that does a shallow array equality check.
 *
 * @param store - The store to derive the value from.
 * @param getter - A getter that obtains the array that should be contained in
 *   the store.
 */
export function derivedArray<S, T extends StrictEquality>(
  store: Readable<S>,
  getter: (values: S) => readonly T[],
): Readable<readonly T[]> {
  let val: readonly T[] = [];
  return derived(
    store,
    (storeVal, set) => {
      const newVal = getter(storeVal);
      if (!shallowEqual(val, newVal)) {
        set(newVal);
        val = newVal;
      }
    },
    val,
  );
}
