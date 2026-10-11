import { getContext } from "svelte";
import { DateTime } from "luxon";
export const ClockKey = Symbol("beancount-clock");
export function useClock(): () => DateTime {
  return getContext<() => DateTime>(ClockKey) ?? (() => DateTime.now());
}
