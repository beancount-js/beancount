import {
  AbstractVisitor,
  BalanceDirective,
  CloseDirective,
  Cost as ParserCost,
  CostSpec as ParserCostSpec,
  CommodityDirective,
  CustomDirective,
  Directive,
  Amount as ParserAmount,
  DocumentDirective,
  Posting,
  EventDirective,
  IncludeDirective,
  NoteDirective,
  OpenDirective,
  OptionDirective,
  PadDirective,
  PluginDirective,
  PopTagDirective,
  PriceDirective,
  PushTagDirective,
  QueryDirective,
  TransactionDirective,
  BeanCountDocument,
  Position,
  Attributes,
  ParserOptions,
  Decimal,
  NumberExpression,
  Numeric,
  AttributeValue,
  parseDocument,
  ParseError,
} from "@beancount-js/parser";
import {
  Directive as BeancountDirective,
  Plugin,
  Metadata,
  ScalarType,
  Document,
  Query,
  CodeBlock,
  LedgerInclude,
  Custom,
  Price,
  LedgerOption,
  Open,
  Booking,
  Close,
  Commodity,
  Balance,
  Amount,
  Pad,
  Note,
  Transaction,
  Posting as TxPosting,
  Cost,
  CostSpec,
  Event,
  DIRECTIVE_META,
  Directives,
  sorted,
  SOURCE_META,
  ID_META,
} from "../core";

export interface ParserProperties {
  filename: string;
  attributes: Record<string, unknown>;
  transform: boolean;
  parser?: ParserOptions;
}

export function positionFor(directive: Directive): Position {
  const positions: Array<Position> = [directive.position];
  positions.push(...directive.comments.commentsBefore.map((it) => it.position));
  if (directive.comments.inlineComment) {
    positions.push(directive.comments.inlineComment.position);
  }
  positions.push(...directive.metadata.attributes.map((it) => it.position));
  return {
    from: Math.min(...positions.map((it) => it.from)),
    to: Math.max(...positions.map((it) => it.to)),
    line: Math.min(...positions.map((it) => it.line)),
  };
}

export function parseLedger(contents: string, props: ParserProperties) {
  return new LedgerParser(parseDocument(contents, props.parser), props);
}

export function parseDirectives(
  contents: string,
  props: Partial<ParserProperties> = {},
): [Directives, Array<ParseError>, Record<string, unknown>, LedgerParser] {
  const ledger = parseLedger(contents, {
    filename: "",
    transform: true,
    attributes: {},
    ...props,
  });
  return [ledger.directives, ledger.errors, ledger.optionsMap, ledger];
}

export class LedgerEntry {
  constructor(
    readonly position: Position,
    readonly directive: Directive,
    readonly content: string,
  ) {
    this.position = positionFor(directive);
  }

  get lineno() {
    return this.directive.position.line;
  }
}

export class LedgerParser extends AbstractVisitor<void> {
  readonly directives: Array<BeancountDirective> = [];
  readonly optionsMap: Metadata = {};
  readonly sources: Array<string> = [];

  constructor(
    readonly document: BeanCountDocument,
    readonly props: ParserProperties,
  ) {
    super();
    document.visit(this);
    sorted(this.directives);
  }

  get errors() {
    return this.document.errors;
  }

  metadataFor(directive: Directive): Metadata {
    const meta = this.attributesFor(directive.position, directive.metadata);
    const pos = positionFor(directive);
    const entry = new LedgerEntry(pos, directive, this.document.content(pos));
    meta[DIRECTIVE_META] = entry;
    meta[SOURCE_META] = entry.content;
    meta[ID_META] = directive.id;
    return meta;
  }

  attributesFor(position: Position, metadata: Attributes): Metadata {
    const meta: Metadata = {
      ...(this.props.attributes || {}),
    };
    meta["lineno"] = position.line;
    metadata.attributes.forEach((attr) => {
      const value = attr.value;
      if (value == null) {
        meta[attr.name] = null;
      } else if (value instanceof Decimal) {
        meta[attr.name] = value;
      }
      if (value instanceof NumberExpression) {
        meta[attr.name] = value.resolve();
      } else if (value instanceof ParserAmount) {
        meta[attr.name] = this.visitAmount(value);
      } else {
        meta[attr.name] = value;
      }
    });
    return meta;
  }

  attributeValue(value: AttributeValue): ScalarType {
    if (value instanceof NumberExpression) {
      return value.resolve();
    } else if (value instanceof ParserAmount) {
      return this.visitAmount(value);
    }
    return value;
  }

  visitDocument = (directive: DocumentDirective) => {
    this.directives.push(
      new Document(
        directive.date,
        directive.account,
        directive.path,
        [
          ...new Set([
            ...directive.tags.map((it) => it.value),
            ...directive.pushedTags.map((it) => it.tag.value),
          ]),
        ],
        directive.links.map((it) => it.value),
        this.metadataFor(directive),
      ),
    );
  };

  visitQuery = (directive: QueryDirective) => {
    const query = new Query(
      directive.date,
      directive.name,
      typeof directive.query === "string"
        ? directive.query
        : new CodeBlock(
            directive.query.code,
            directive.query.language,
            directive.query.content,
          ),
      this.metadataFor(directive),
    );
    this.directives.push(query);
  };

  visitInclude = (directive: IncludeDirective) => {
    this.sources.push(directive.value);
    this.directives.push(
      new LedgerInclude(directive.value, this.metadataFor(directive)),
    );
  };

  visitCustom = (directive: CustomDirective) => {
    const custom = new Custom(
      directive.date,
      directive.name,
      directive.args.map((it) => this.attributeValue(it)),
      this.metadataFor(directive),
    );
    this.directives.push(custom);
  };

  visitPrice = (directive: PriceDirective) => {
    this.directives.push(
      new Price(
        directive.date,
        directive.currency,
        this.visitAmount(directive.amount)!,
        this.metadataFor(directive),
      ),
    );
  };

  visitPlugin = (directive: PluginDirective) => {
    const plugin = new Plugin(
      directive.name,
      directive.options
        ? typeof directive.options === "string"
          ? directive.options
          : new CodeBlock(
              directive.options.code,
              directive.options.language,
              directive.options.content,
            )
        : undefined,
      this.metadataFor(directive),
    );
    this.directives.push(plugin);
  };

  private visitNumber(
    number: Numeric | null | undefined | null,
  ): null | Decimal {
    if (number === null || number === undefined) {
      return null;
    } else if (number instanceof Decimal) {
      return number;
    } else if (number instanceof NumberExpression) {
      return number.resolve();
    }
    return null;
  }

  visitOption = (directive: OptionDirective) => {
    const existing = this.optionsMap[directive.name];
    if (existing) {
      this.optionsMap[directive.name] = Array.isArray(existing)
        ? [...new Set([...existing, directive.value])]
        : [...new Set([existing, directive.value])];
    } else {
      this.optionsMap[directive.name] = directive.value;
    }
    this.directives.push(
      new LedgerOption(
        directive.name,
        directive.value,
        this.metadataFor(directive),
      ),
    );
  };

  visitOpen = (directive: OpenDirective) => {
    this.directives.push(
      new Open(
        directive.date,
        directive.account,
        directive.currencies,
        Booking[directive.bookingMethod as keyof typeof Booking],
        this.metadataFor(directive),
      ),
    );
  };

  visitClose = (directive: CloseDirective) => {
    this.directives.push(
      new Close(directive.date, directive.account, this.metadataFor(directive)),
    );
  };

  visitCommodity = (directive: CommodityDirective) => {
    this.directives.push(
      new Commodity(
        directive.date,
        directive.currency,
        this.metadataFor(directive),
      ),
    );
  };

  visitBalance = (directive: BalanceDirective) => {
    this.directives.push(
      new Balance(
        directive.date,
        directive.account,
        new Amount(
          this.visitNumber(directive.amount?.value)?.toString(),
          directive.amount?.currency ?? null,
        ),
        null,
        this.visitNumber(directive.tolerance)?.toString(),
        this.metadataFor(directive),
      ),
    );
  };

  visitPad = (directive: PadDirective) => {
    this.directives.push(
      new Pad(
        directive.date,
        directive.source,
        directive.target,
        this.metadataFor(directive),
      ),
    );
  };

  visitNote = (directive: NoteDirective) => {
    this.directives.push(
      new Note(
        directive.date,
        directive.account,
        directive.narrative,
        [
          ...new Set([
            ...directive.tags.map((it) => it.value),
            ...directive.pushedTags.map((it) => it.tag.value),
          ]),
        ],
        directive.links.map((it) => it.value),
        this.metadataFor(directive),
      ),
    );
  };

  visitTransaction = (directive: TransactionDirective) => {
    const tx = new Transaction(
      directive.date,
      directive.status,
      directive.payee,
      directive.narrative,
      [
        ...new Set([
          ...directive.tags.map((it) => it.value),
          ...directive.pushedTags.map((it) => it.tag.value),
        ]),
      ],
      directive.links.map((it) => it.value),
      directive.postings.map((it) => this.visitTxPosting(directive, it)),
      this.metadataFor(directive),
    );
    this.directives.push(tx);
  };

  private visitTxPosting(directive: TransactionDirective, posting: Posting) {
    const price = this.visitPostingPrice(posting);
    return new TxPosting(
      posting.account,
      this.visitAmount(posting.amount),
      this.visitCost(directive, posting) ?? null,
      price,
      posting.status,
      this.attributesFor(posting.position, posting.metadata),
    );
  }

  visitAmount(units: ParserAmount | null | null | undefined): Amount | null {
    if (!units) {
      return null;
    }
    return new Amount(this.visitNumber(units.value), units.currency ?? null);
  }

  visitPostingPrice(posting: Posting) {
    if (posting.price?.value) {
      return this.visitAmount(posting.price);
    } else if (posting.totalCost && posting.amount) {
      const totalCost = this.visitNumber(posting.totalCost?.value);
      const amount = this.visitNumber(posting.amount?.value);

      if (totalCost && amount) {
        return new Amount(
          totalCost.div(amount.abs()).toString(),
          posting.totalCost.currency ?? null,
        );
      }
    }
    return this.visitAmount(posting.price);
  }

  visitCost(directive: TransactionDirective, posting: Posting) {
    const cost = posting.cost;
    if (!cost) {
      return cost;
    } else if (cost && cost instanceof ParserCost && cost.amount) {
      return new Cost(
        cost.date || directive.date,
        this.visitAmount(cost.amount),
        cost.label,
      );
    } else if (cost && cost instanceof ParserCostSpec) {
      const numberPer = this.visitNumber(cost.numberPer);
      const numberTotal = this.visitNumber(cost.numberTotal);
      return new CostSpec(
        numberPer !== null ? numberPer : null,
        numberTotal !== null ? numberTotal : null,
        cost.currency ?? null,
        cost.date ?? null,
        cost.label ?? "",
      );
    }
    return null;
  }

  visitPushTag = (_directive: PushTagDirective) => {};

  visitPopTag = (_directive: PopTagDirective) => {};

  visitEvent = (directive: EventDirective) => {
    this.directives.push(
      new Event(
        directive.date,
        directive.type,
        directive.description,
        this.metadataFor(directive),
      ),
    );
  };
}
