import {
  filterLedger,
  LoadError,
  type LoadProps,
} from "@beancount-js/beancount";
import { LedgerData, LedgerSource } from "../core/ledger.js";
import { FilterState } from "./filter.svelte";
import type { Options } from "../context";
import type { MenuItem } from "../menu";
import { getContext, setContext } from "svelte";

type Getter<T> = () => T;

export type LedgerStateProps = {
  contents: Getter<string>;
  setContents: (contents: string) => void;
  loadProps?: Partial<LoadProps>;
};

export class LedgerState {
  setContents: LedgerStateProps["setContents"];
  menu: Array<Array<MenuItem>> = $state([]);
  contents: string = $state("");

  readonly source = $derived.by(
    () => new LedgerSource(this.contents, this.props.loadProps),
  );
  readonly filter: FilterState = new FilterState();
  readonly options: Options = $derived(this.source.options);
  readonly data: LedgerData = $derived.by(() => {
    if (!this.filter.filter) {
      return this.source.data;
    }

    const errors = [...this.filter.errors];
    const [directives, filterErrors] = filterLedger(
      this.source.directives,
      this.filter.filter,
    );
    errors.push(...filterErrors);
    return this.source.data.copy({
      directives,
      errors: [...this.source.errors, ...errors.map((it) => new LoadError(it))],
    });
  });

  constructor(readonly props: LedgerStateProps) {
    this.setContents = (value) => {
      props.setContents(value);
      this.contents = value;
    };
    this.contents = props.contents();
  }

  set ledgerSource(value: LedgerSource) {
    this.setContents(value.toString());
  }
}

const SYMBOL_KEY = "beancount";

/**
 * Instantiates a new `LedgerState` instance and sets it in the context.
 *
 * @param props The constructor props for the `LedgerState` class.
 * @returns The `LedgerState` instance.
 */
export function setLedger(props: LedgerStateProps): LedgerState {
  return setContext(Symbol.for(SYMBOL_KEY), new LedgerState(props));
}

/**
 * Retrieves the `LedgerState` instance from the context. This is a class
 * instance, so you cannot destructure it.
 *
 * @returns The `LedgerState` instance.
 */
export function useLedger(): LedgerState {
  return getContext(Symbol.for(SYMBOL_KEY));
}
