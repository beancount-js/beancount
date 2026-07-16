import type { BeancountOptions } from "../core";
import type { Directives } from "../core/data";
import { autoInsertOpen } from "../plugins/autoaccount";
import { auto } from "../plugins/auto";
import { creditCard } from "../plugins/creditcard";
import { closeTree } from "../plugins/close_tree";
import { validateCommodityAttributes } from "../plugins/commodity_attr";
import { validateCoherentCost } from "../plugins/coherent_cost";
import { checkClosing } from "../plugins/check_closing";
import { validateAverageCost } from "../plugins/check_average_cost";
import { validateCommodityDirectives } from "../plugins/check_commodity";
import { checkDrained } from "../plugins/check_drained";
import { forecast } from "../plugins/forecast";
import { addImplicitPrices } from "../plugins/implicit_prices";
import { validateLeafOnly } from "../plugins/leafonly";
import { validateOneCommodity } from "../plugins/onecommodity";
import { validateNoDuplicates } from "../plugins/noduplicates";
import { validateUnusedAccounts } from "../plugins/nounused";
import { validateUniquePrices } from "../plugins/unique_prices";
import { validateSellGains } from "../plugins/sellgains";
import { checkBalance } from "./balance";
import { pad } from "./pad";
import type { ValidationError } from "./validation";

export type PluginSpec = (
  entries: Directives,
  options: BeancountOptions,
  arg?: string,
) => [Directives, Array<ValidationError>];

export const PLUGINS_PRE = [];
export const PLUGINS_AUTO = [];
export const PLUGINS_POST = ["beancount.ops.pad", "beancount.ops.balance"];

export interface PluginType {
  id: string;
  plugin: PluginSpec;
  order: number;
  /**
   * Built-in plugins opt out explicitly when they have no configuration
   * contract. External plugins remain configurable by default, matching
   * Beancount's raw third-argument plugin API.
   */
  supportsConfig?: boolean;
}

export const Plugins: Record<string, PluginType> = {
  "beancount.ops.pad": {
    plugin: pad,
    order: 10,
    id: "beancount.ops.pad",
    supportsConfig: false,
  },
  "beancount.ops.balance": {
    plugin: checkBalance,
    order: 0,
    id: "beancount.ops.balance",
    supportsConfig: false,
  },
  "beancount.plugins.auto": {
    plugin: auto,
    order: 0,
    id: "beancount.plugins.auto",
    supportsConfig: false,
  },
  "beancount.plugins.auto_accounts": {
    plugin: autoInsertOpen,
    order: 0,
    id: "beancount.plugins.auto_accounts",
    supportsConfig: false,
  },
  "beancount.plugins.implicit_prices": {
    plugin: addImplicitPrices,
    order: 0,
    id: "beancount.plugins.implicit_prices",
    supportsConfig: false,
  },
  "beancount.plugins.close_tree": {
    plugin: closeTree,
    order: 0,
    id: "beancount.plugins.close_tree",
    supportsConfig: false,
  },
  "beancount.plugins.commodity_attr": {
    plugin: validateCommodityAttributes,
    order: 0,
    id: "beancount.plugins.commodity_attr",
    supportsConfig: true,
  },
  "beancount.plugins.coherent_cost": {
    plugin: validateCoherentCost,
    order: 0,
    id: "beancount.plugins.coherent_cost",
    supportsConfig: false,
  },
  "beancount.plugins.check_commodity": {
    plugin: validateCommodityDirectives,
    order: 0,
    id: "beancount.plugins.check_commodity",
    supportsConfig: true,
  },
  "beancount.plugins.check_average_cost": {
    plugin: validateAverageCost,
    order: 0,
    id: "beancount.plugins.check_average_cost",
    supportsConfig: true,
  },
  "beancount.plugins.check_closing": {
    plugin: checkClosing,
    order: 0,
    id: "beancount.plugins.check_closing",
    supportsConfig: false,
  },
  "beancount.plugins.check_drained": {
    plugin: checkDrained,
    order: 0,
    id: "beancount.plugins.check_drained",
    supportsConfig: false,
  },
  "beancount.plugins.unique_prices": {
    plugin: validateUniquePrices,
    order: 0,
    id: "beancount.plugins.unique_prices",
    supportsConfig: false,
  },
  "beancount.plugins.sellgains": {
    plugin: validateSellGains,
    order: 0,
    id: "beancount.plugins.sellgains",
    supportsConfig: false,
  },
  "beancount.plugins.leafonly": {
    plugin: validateLeafOnly,
    order: 0,
    id: "beancount.plugins.leafonly",
    supportsConfig: false,
  },
  "beancount.plugins.onecommodity": {
    plugin: validateOneCommodity,
    order: 0,
    id: "beancount.plugins.onecommodity",
    supportsConfig: true,
  },
  "beancount.plugins.noduplicates": {
    plugin: validateNoDuplicates,
    order: 0,
    id: "beancount.plugins.noduplicates",
    supportsConfig: false,
  },
  "beancount.plugins.nounused": {
    plugin: validateUnusedAccounts,
    order: 0,
    id: "beancount.plugins.nounused",
    supportsConfig: false,
  },
  "beancount.plugins.forecast": {
    plugin: forecast,
    order: 0,
    id: "beancount.plugins.forecast",
    supportsConfig: true,
  },
  "beancount.plugins.creditcard": {
    plugin: creditCard,
    order: 0,
    id: "beancount.plugins.creditcard",
    supportsConfig: true,
  },
};
