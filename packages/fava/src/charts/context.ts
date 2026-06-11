import { derived } from "svelte/store";

import { useContext } from "../context";
import { useCurrentDateFormat } from "../stores/format";

/** Context data for parsing and rendering of the charts. */
export interface ChartContext {
  /**
   * The list of operating currencies, complemented by the current conversion
   * currency.
   */
  readonly currencies: readonly string[];
  /** The current date format as determined from the interval. */
  readonly dateFormat: (date: Date) => string;
}

/** The list of operating currencies, adding in the current conversion currency. */
export function useOperatingCurrenciesWithConversion() {
  const { operatingCurrency, currencies, conversion } = useContext();
  return derived(
    [operatingCurrency, currencies, conversion],
    ([$operatingCurrency, $currencies, $conversion]) =>
      $currencies.includes($conversion) &&
      !$operatingCurrency.includes($conversion)
        ? [...$operatingCurrency, $conversion]
        : $operatingCurrency,
  );
}

export function useChartContext() {
  return derived(
    [useOperatingCurrenciesWithConversion(), useCurrentDateFormat()],
    ([
      $operatingCurrenciesWithConversion,
      $currentDateFormat,
    ]): ChartContext => ({
      currencies: $operatingCurrenciesWithConversion,
      dateFormat: $currentDateFormat,
    }),
  );
}
