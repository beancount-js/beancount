import {
  AbstractFilterVisitor,
  AccountFilter,
  BooleanFilter,
  DateFilter,
  FieldFilter,
  Filter,
  FilterType,
  LinkFilter,
  NumberFilter,
  PatternFilter,
  QueryParserOptions,
  TagFilter,
  TextFilter,
  VisitorContext,
  parseQuery,
} from "@beancount-js/filters";
import {
  DirectiveBase,
  Note,
  Transaction,
  Document,
  isMissing,
  Price,
  Balance,
  Posting,
  isDirective,
  Directives,
  Directive,
} from "./data";
import { Decimal, isValidNumber, parseDate } from "@beancount-js/parser";
import { Cost } from "./position";

function getValueByDotNotation(
  obj: any,
  path: string,
  aliases: Record<string, string[]> = {},
): any {
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split("."); // Converts array indices to dot notation
  let result = obj;

  for (let key of keys) {
    if (result === undefined || result === null || isMissing(result)) {
      return undefined; // Return undefined if any key doesn't exist or if result becomes null
    }
    const names: string[] = [...(aliases[key] ?? []), key];
    key =
      names.find((k) => result[k] !== null && result[k] !== undefined) ?? key;
    // Check if the property is a function
    if (typeof result[key] === "function") {
      result = result[key](); // Call the function
    } else {
      result = result[key]; // Otherwise, just access the property
    }
  }
  return result;
}

export class BeancountFilter extends AbstractFilterVisitor<
  DirectiveBase | string
> {
  accept(
    filter: Filter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    return super.accept(filter, entity, context);
  }

  visitTagFilter(
    filter: TagFilter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    if (typeof entity === "string") {
      return entity.startsWith(filter.tag);
    } else if (
      entity instanceof Transaction ||
      entity instanceof Document ||
      entity instanceof Note
    ) {
      return entity.tags.some((it) => it.startsWith(filter.tag));
    }
    return false;
  }

  visitLinkFilter(
    filter: LinkFilter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    if (typeof entity === "string") {
      return entity.startsWith(filter.link);
    } else if (
      entity instanceof Transaction ||
      entity instanceof Document ||
      entity instanceof Note
    ) {
      return entity.links.some((it) => it.startsWith(filter.link));
    }
    return false;
  }

  compareNumber(a: Decimal, b: Decimal, op: string): boolean {
    switch (op) {
      case "=":
        return a.eq(b);
      case "!=":
        return !a.eq(b);
      case "~":
        return a.abs().eq(b.abs());
      case "!~":
        return !a.abs().eq(b.abs());
      case ">":
        return a.abs().gt(b.abs());
      case ">=":
        return a.abs().gte(b.abs());
      case "<":
        return a.abs().lt(b.abs());
      case "<=":
        return a.abs().lte(b.abs());
    }
    return a.abs().eq(b.abs());
  }

  amounts(entity: Posting | Directive | string): Decimal[] {
    if (typeof entity === "string") {
      return isValidNumber(entity) ? [new Decimal(entity)] : [];
    } else if (entity instanceof Transaction) {
      return entity.postings.map((it) => this.amounts(it)).flat();
    } else if (entity instanceof Price || entity instanceof Balance) {
      return isMissing(entity.amount.units) ? [] : [entity.amount.units];
    } else if (entity instanceof Posting) {
      const amounts: Decimal[] = [];
      if (!isMissing(entity.units) && !isMissing(entity.units.units)) {
        amounts.push(entity.units.units);
      }
      if (
        entity.cost instanceof Cost &&
        !isMissing(entity.cost.amount) &&
        !isMissing(entity.cost.amount.units)
      ) {
        amounts.push(entity.cost.amount.units);
      }
      if (!isMissing(entity.price) && !isMissing(entity.price.units)) {
        amounts.push(entity.price.units);
      }
      return amounts;
    }
    return [];
  }

  visitNumberFilter(
    filter: NumberFilter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    const amount = new Decimal(filter.value);
    return this.amounts(entity).some((it) =>
      this.compareNumber(it, amount, context.op),
    );
  }

  visitTextFilter(
    filter: TextFilter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    if (typeof entity === "string") {
      switch (context.op) {
        case "=":
          return entity === filter.value;
        case "!=":
          return entity !== filter.value;
        case "~":
          return filter.pattern().value.test(entity) === true;
        case "!~":
          return filter.pattern().value.test(entity) === false;
        case ">":
          return entity > filter.value;
        case ">=":
          return entity >= filter.value;
        case "<":
          return entity < filter.value;
        case "<=":
          return entity <= filter.value;
      }
      return (
        entity.includes(filter.value) || filter.pattern().value.test(entity)
      );
    }
    return this.visitTextFilter(filter, entity.content, context);
  }

  visitPatternFilter(
    filter: PatternFilter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    if (typeof entity === "string") {
      return filter.value.test(entity);
    }
    return filter.value.test(entity.content);
  }

  visitAccountFilter(
    filter: AccountFilter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    if (typeof entity === "string") {
      return (
        entity.startsWith(filter.value) ||
        filter.pattern().accept(this, entity, context)
      );
    }
    return entity.accounts.some(
      (account) =>
        account.startsWith(filter.value) ||
        filter.pattern().accept(this, entity, context),
    );
  }

  visitFieldFilter(
    filter: FieldFilter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    switch (filter.field) {
      case "type":
        return filter.value.accept(
          this,
          typeof entity === "string" ? entity : entity.directiveType,
          { op: filter.op },
        );
      case "amount":
      case "units":
        return this.amounts(entity).some((it) =>
          filter.value.accept(this, it.toString(), { op: filter.op }),
        );
      case "date":
        return filter.value.accept(this, entity, { op: filter.op });
      case "account":
        return typeof entity === "string"
          ? filter.value.accept(this, entity, { op: filter.op })
          : entity.accounts.some((it) =>
              filter.value.accept(this, it, { op: filter.op }),
            );
    }

    if (entity instanceof Transaction) {
      switch (filter.field) {
        case "payee":
          return filter.value.accept(this, entity.payee, { op: filter.op });
        case "narration":
          return filter.value.accept(this, entity.narration, { op: filter.op });
        case "flag":
          return (
            filter.value.accept(this, entity.flag, { op: filter.op }) ||
            entity.postings.some((it) =>
              filter.value.accept(this, it.flag, { op: filter.op }),
            )
          );
        case "tx.flag":
        case "transaction.flag":
        case "txn.flag":
          return filter.value.accept(this, entity.flag, { op: filter.op });
        case "posting.flag":
        case "p.flag":
          return entity.postings.some((it) =>
            filter.value.accept(this, it.flag, { op: filter.op }),
          );
        case "tag":
          return entity.tags.some((it) =>
            filter.value.accept(this, it, { op: filter.op }),
          );
        case "link":
          return entity.links.some((it) =>
            filter.value.accept(this, it, { op: filter.op }),
          );
        case "amount":
        case "units":
          return this.amounts(entity).some((it) =>
            filter.value.accept(this, it.toString(), { op: filter.op }),
          );
        case "cost":
          return entity.postings
            .map((posting) => {
              if (
                posting.cost instanceof Cost &&
                !isMissing(posting.cost.amount) &&
                !isMissing(posting.cost.amount.units)
              ) {
                return [posting.cost.amount.units];
              } else {
                return [];
              }
            })
            .flat()
            .some((it) =>
              filter.value.accept(this, it.toString(), { op: filter.op }),
            );

        case "price":
          return entity.postings
            .map((posting) => {
              if (
                !isMissing(posting.price) &&
                !isMissing(posting.price.units)
              ) {
                return [posting.price.units];
              } else {
                return [];
              }
            })
            .flat()
            .some((it) =>
              filter.value.accept(this, it.toString(), { op: filter.op }),
            );
      }
      if (
        entity.postings.some((posting) => {
          const value =
            getValueByDotNotation(posting, filter.field, {
              attributes: ["meta"],
              attr: ["meta"],
            }) || getValueByDotNotation(posting.meta, filter.field);
          if (value === null || value === undefined) {
            return false;
          }
          return filter.value.accept(this, value.toString(), { op: filter.op });
        })
      ) {
        return true;
      }
    }

    const value =
      typeof entity === "string"
        ? entity
        : (getValueByDotNotation(entity, filter.field, {
            attributes: ["meta"],
            attr: ["meta"],
          }) ?? getValueByDotNotation(entity.meta, filter.field));

    if (value === null || value === undefined) {
      return false;
    }
    return filter.value.accept(
      this,
      isDirective(value) ? value : value.toString(),
      { op: filter.op },
    );
  }

  visitDateFilter(
    filter: DateFilter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    const date = typeof entity === "string" ? parseDate(entity) : entity.date;
    if (!date?.isValid) {
      return false;
    }
    const from = filter.range.from.toMillis();
    const to = filter.range.endInclusive.toMillis();
    const value = date.toMillis();

    switch (context.op) {
      case "=":
      case ":":
        return filter.range.contains(date);
      case ">":
        return value > to;
      case ">=":
        return value >= to;
      case "<":
        return value < from;
      case "<=":
        return value <= from;
    }
    throw new Error(
      `Unsopported op: ${context.op} for filter: {${filter.toString()}}`,
    );
  }

  visitBooleanFilter(
    filter: BooleanFilter,
    entity: DirectiveBase | string,
    context: VisitorContext,
  ): boolean {
    if (!filter.args.length) {
      return true;
    }
    if (filter.op == FilterType.AND) {
      return filter.args.every((it) => it.accept(this, entity, context));
    } else if (filter.op == FilterType.OR) {
      return filter.args.some((it) => it.accept(this, entity, context));
    } else if (filter.op == FilterType.NOT) {
      if (filter.args.some((it) => it.accept(this, entity, context))) {
        return false;
      }
      return true;
    }
    return false;
  }
}

const beancountFilter = new BeancountFilter();

export function filterLedger(
  directives: Directives,
  query: string,
  options: QueryParserOptions = {},
): [Directives, Array<string>] {
  const [filter, errors] = parseQuery(query, options);
  if (errors.length) {
    return [[], errors];
  }
  if (!filter) {
    return [directives, []];
  }
  return [
    directives.filter((it) => beancountFilter.accept(filter, it, { op: ":" })),
    [],
  ];
}
