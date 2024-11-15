import { writable, type Writable } from "svelte/store";
import { parseDocument } from "yaml";
import { z, ZodIssueCode, type ZodTypeAny } from "zod";

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

export function yamlParser(schema: ZodTypeAny) {
  return z.preprocess(parseYamlPreprocessor, schema);
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function storageSyncedStore<T>(
  key: string,
  init: () => T,
  schema: ZodTypeAny,
  storage: Storage = localStorage,
): Writable<T> {
  const fullKey = `beancount://${key}`;
  const parser = yamlParser(schema);

  // Create a store which is empty first but reads the value from
  // localStorage on the first subscription.
  const store = writable<T>(undefined, (set) => {
    const stored_val = storage.getItem(fullKey);
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
        storage.setItem(fullKey, JSON.stringify(val));
      } else {
        console.error("Ledger:Storage", data.error);
      }
    });
  });

  return { ...store };
}

/** A store that has its value synced to localStorage. */
export type ValueStore<T> = Writable<T> & {
  /** List all the values that this store can take. */
  values: () => [T, string][];
};

export function valueStore<T>(
  store: Writable<T>,
  values: () => [T, string][] = () => [],
): ValueStore<T> {
  return { ...store, values };
}
