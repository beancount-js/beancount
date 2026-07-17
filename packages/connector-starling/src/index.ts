export { starlingConnector, validateStarlingConfig } from "./connector";
export { StarlingClient, StarlingError } from "./client";
export { StarlingNormalizer } from "./normalize";
export { discoverStarlingAccounts, StarlingSource } from "./source";
export {
  commitStarlingSyncState,
  prepareStarlingFetch,
  resolveStarlingFetchWindow,
} from "./sync";
export {
  DEFAULT_ALLOWED_HOSTS,
  DEFAULT_BASE_URL,
  DEFAULT_FIRST_SYNC_DAYS,
  DEFAULT_LOOKBACK_DAYS,
  STARLING_KIND,
  type StarlingAccount,
  type StarlingConfig,
  type StarlingCurrencyAndAmount,
  type StarlingFeedItem,
  type StarlingFetchMode,
  type StarlingFetchWindow,
  type StarlingSyncState,
  type StarlingTransactionPage,
} from "./types";
