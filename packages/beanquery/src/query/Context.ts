import { defaultBeancountOptions } from "@beancount-js/beancount";
import type { BeancountOptions, LedgerError } from "@beancount-js/beancount";
import {
  parseBql,
  LiteralExpression,
  Expression,
  CreateTableExpression,
  InsertExpression,
} from "../parser";
import { Compiler, type CompilerOptions } from "./compiler";
import { Table } from "./models";
import { DateTime, Duration } from "luxon";
import { CompilationError, ParseError } from "../errors";
import { setActiveContext } from "./active_context";
type Constant = number | string | boolean | null | DateTime | Duration;

export class Context {
  readonly tables = new Map<string, Table>();
  readonly settings: Record<string, Constant | Array<Constant>> = {};

  constructor(
    readonly options: BeancountOptions = defaultBeancountOptions(),
    readonly errors: LedgerError[] = [],
    ...tables: Table[]
  ) {
    this.tables.set("", Table.create("").data([null]));
    tables.forEach((table) => {
      table.setContext(this);
      this.tables.set(table.name, table);
    });
  }

  withTables(...tables: Table[]) {
    tables.forEach((table) => {
      table.setContext(this);
      this.tables.set(table.name, table);
    });
    return this;
  }

  copy(
    props: Partial<{
      options: BeancountOptions;
      errors: LedgerError[];
      settings: Record<string, Constant | Array<Constant>>;
    }> = {},
  ) {
    const context = new Context(
      props.options ?? { ...this.options },
      props.errors ?? [...this.errors],
    ).withTables(
      ...[...this.tables.values()].map((it) => {
        return it;
      }),
    );

    for (const [key, value] of Object.entries({
      ...(props.settings || this.settings),
    })) {
      context.settings[key] = value;
    }
    return context;
  }

  prepare(
    query: string,
  ): [Expression, ParseError[], Record<string, Constant | Array<Constant>>] {
    const shorthand = /\bFROM\s+(OPEN|CLOSE|CLEAR)(?:\s+ON\s+(\d{4}-\d{2}-\d{2}))?/i;
    const matched = query.match(shorthand);
    const source = matched
      ? `SET ${matched[1].toLowerCase()} = ${matched[2] ?? "true"}; ${query.replace(shorthand, "")}`
      : query;
    const [expr, errors, options] = parseBql(source);
    const settings = options.reduce(
      (acc: Record<string, Constant | Array<Constant>>, option) => {
        if (option.value instanceof LiteralExpression) {
          acc[option.name] = option.value.value;
        } else {
          acc[option.name] = option.value.values.map((it) => it.value);
        }
        return acc;
      },
      {},
    );
    return [expr, errors, settings];
  }

  compile(
    query: string,
    parameters?: Record<string, Constant | Array<Constant>>,
    options: Partial<CompilerOptions> = {},
  ) {
    const [expr, errors, settings] = this.prepare(query);
    if (errors.length) {
      throw new CompilationError(
        `${errors.map((it) => `${query}\n\n${it.options.node}: ${it.message}`).join("\n")}`,
      );
    }
    if (
      expr instanceof CreateTableExpression ||
      expr instanceof InsertExpression
    ) {
      return new Compiler(this, options).compile(expr, parameters);
    }
    return new Compiler(this.copy({ settings }), options).compile(
      expr,
      parameters,
    );
  }

  execute(
    query: string,
    parameters?: Record<string, Constant | Array<Constant>>,
    options: Partial<CompilerOptions> = {},
  ) {
    setActiveContext(this);
    try {
      return this.compile(query, parameters, options).resolve();
    } finally {
      setActiveContext(null);
    }
  }
}
