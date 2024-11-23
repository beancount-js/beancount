import type { Schema } from "inspector/promises";
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

type SyncedStorageProps<T> = {
  read(data: string | null): T | null;
  write: (data: T) => string;
  storage: Storage;
};

export function storageSyncedStore<T>(
  key: string,
  init: () => T,
  schema: ZodTypeAny,
  props: Partial<SyncedStorageProps<T>> = {},
): Writable<T> {
  const fullKey = `beancount://${key}`;
  const options: SyncedStorageProps<T> = {
    read: props.read ?? ((data) => yamlParser(schema).safeParse(data).data),
    write: props.write ?? ((data: T) => JSON.stringify(data)),
    storage: props.storage ?? localStorage,
  };

  // Create a store which is empty first but reads the value from
  // localStorage on the first subscription.
  const store = writable<T>(undefined, (set) => {
    const stored_val = options.storage.getItem(fullKey);
    const initial: T | null = options.read(stored_val);
    set(initial ?? init());

    store.subscribe((data) => {
      options.storage.setItem(fullKey, options.write(data));
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
