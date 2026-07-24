import { writable, type Writable } from "svelte/store";
import { parseDocument } from "yaml";
import { z, ZodIssueCode, type ZodTypeAny } from "zod";

/** A store that has its value synced to localStorage. */
export type LocalStoreSyncedStore<T> = Writable<T> & {
  /** List all the values that this store can take. */
  values: () => [T, string][];
};

/**
 * Create a store that syncs its value to localStorage.
 *
 * @param key - The key to save this with in localStorage.
 * @param init - A default to initialise the store with if localStorage is
 *   empty.
 * @param values - An optional enumerator of all possible values and
 *   descriptions.
 */
export function localStorageSyncedStore<T>(
  key: string,
  init: () => T,
  values: () => [T, string][] = () => [],
): LocalStoreSyncedStore<T> {
  const fullKey = `beancount-${key}`;

  // Create a store which is empty first but reads the value from
  // localStorage on the first subscription.
  const store = writable<T>(undefined, (set) => {
    const stored_val = localStorage.getItem(fullKey);
    let initial: T | null = null;
    if (stored_val != null) {
      try {
        const val = JSON.parse(stored_val);
        if (val !== null) {
          initial = val;
        }
      } catch (e) {}
    }
    set(initial ?? init());

    store.subscribe((val) => {
      localStorage.setItem(fullKey, JSON.stringify(val));
    });
  });

  return { ...store, values };
}

const parseJsonPreprocessor = (value: any, ctx: z.RefinementCtx) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (e) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: (e as Error).message,
      });
    }
  }

  return value;
};

export const parseYamlPreprocessor = (value: any, ctx: z.RefinementCtx) => {
  if (typeof value === "string") {
    try {
      const doc = parseDocument(value);
      doc.errors.forEach((err) => {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: err.message,
        });
      });
      return doc.toJS();
    } catch (e) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: (e as Error).message,
      });
    }
  }

  return value;
};

export function jsonParser(schema: ZodTypeAny) {
  return z.preprocess(parseJsonPreprocessor, schema);
}

export function yamlParser(schema: ZodTypeAny) {
  return z.preprocess(parseYamlPreprocessor, schema);
}

export function validatedLocalStorageSyncedStore<T>(
  key: string,
  init: () => T,
  schema: ZodTypeAny,
): Writable<T> {
  const fullKey = `beancount-${key}`;
  const parser = jsonParser(schema);

  // Create a store which is empty first but reads the value from
  // localStorage on the first subscription.
  const store = writable<T>(undefined, (set) => {
    const stored_val = localStorage.getItem(fullKey);
    let initial: T | null = null;
    if (stored_val != null) {
      const data = parser.safeParse(stored_val);
      if (data.success) {
        initial = data.data;
      } else {
        console.error("Ledger:Storage", data.error);
      }
    }
    set(initial ?? init());

    store.subscribe((val) => {
      const data = parser.safeParse(val);
      if (data.success) {
        localStorage.setItem(fullKey, JSON.stringify(val));
      } else {
        console.error("Ledger:Storage", data.error);
      }
    });
  });

  return { ...store };
}
