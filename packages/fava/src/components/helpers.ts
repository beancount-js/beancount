import type { Filter } from "@beancount-js/filters";
import { useContext } from "../context";
import { derived, type Readable } from "svelte/store";
import type { LedgerData } from "../core/ledger";

export function useLedger(filter?: Filter): Readable<LedgerData> {
    const { ledgerData, predicate } = useContext();
    return derived([ledgerData, predicate], ([$lederData, $predicate]) => {
      return $lederData.filter($predicate.predicate).filter(filter);
    });
}
  