/**
 * Find the last element before the given value in a sorted list.
 *
 * @param sequence A sorted sequence of elements.
 * @param value The value to search for.
 * @param key Function used to extract the value from the elements of sequence.
 * @returns
 */
export function bisectLeftWithKey<T, V>(
  sequence: ArrayLike<T>,
  value: V,
  key: (item: T) => V,
) {
  let lo = 0,
    hi = sequence.length;
  let mid;
  while (lo < hi) {
    mid = Math.floor((lo + hi) / 2);
    if (key(sequence[mid]) < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * @param sequence The list to search in.
 * @param value The element to search for.
 * @param key A function, to extract the value from the list.
 * @param lo The smallest index to search.
 * @param hi The largest index to search.
 * @returns An element from list 'a'.
 */
export function bisectRightWithKey<T, V>(
  sequence: ArrayLike<T>,
  value: V,
  key: (item: T) => V,
  lo: number = 0,
  hi: number = sequence.length,
) {
  if (lo < 0) {
    throw new Error("lo must be non-negative");
  }
  let mid;

  while (lo < hi) {
    mid = Math.floor((lo + hi) / 2);
    if (value < key(sequence[mid])) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}
