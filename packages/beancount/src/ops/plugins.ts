import { BeancountOptions } from "../core";
import type { Directives } from "../core/data";
import { autoInsertOpen } from "../plugins/autoaccount";
import { forecast } from "../plugins/forecast";
import { checkBalance } from "./balance";
import { pad } from "./pad";
import type { ValidationError } from "./validation";

export type Plugin = (
  entries: Directives,
  options: BeancountOptions,
) => [Directives, Array<ValidationError>];

export const PLUGINS_PRE = [];
export const PLUGINS_AUTO = [];
export const PLUGINS_POST = ["beancount.ops.pad", "beancount.ops.balance"];

export interface PluginType {
  id: string;
  plugin: Plugin;
  order: number;
}

export const Plugins: Record<string, PluginType> = {
  "beancount.ops.pad": {
    plugin: pad,
    order: 10,
    id: "beancount.ops.pad",
  },
  "beancount.ops.balance": {
    plugin: checkBalance,
    order: 0,
    id: "beancount.ops.balance",
  },
  "beancount.plugins.auto": {
    plugin: autoInsertOpen,
    order: 0,
    id: "beancount.plugins.auto",
  },
  "beancount.plugins.forecast": {
    plugin: forecast,
    order: 0,
    id: "beancount.plugins.forecast",
  },
};
