import { DateTime } from "luxon";
import {
  Account,
  Amount,
  Attributes,
  AttributeValue,
  CodeBlock,
  Comments,
  Cost,
  CostSpec,
  Currency,
  DatedDirective,
  Directive,
  Flag,
  Node,
  NumberExpression,
  Position,
  Numeric,
} from "./models";
import { checksum } from "./hash";
import { formatDate, writeAttribute, writeString } from "./parser";
import { DocumentVisitor } from "./visitor";
import { Decimal } from "./number";

export type BookingMethod =
  | "DEFAULT"
  | "STRICT"
  | "NONE"
  | "AVERAGE"
  | "FIFO"
  | "LIFO"
  | "HIFO";

export class Tag extends Node {
  readonly value: string;
  constructor(
    readonly position: Position,
    value: string,
  ) {
    super(position);
    this.value = value.trim().replace(/^#/, "");
  }

  public toString() {
    return "#" + this.value;
  }
}

export class Link extends Node {
  readonly value: string;
  constructor(
    readonly position: Position,
    value: string,
  ) {
    super(position);
    this.value = value.trim().replace(/^\^/, "");
  }

  public toString() {
    return "^" + this.value;
  }
}

/**
 * YYYY-MM-DD open Account [ConstraintCurrency,...] ["BookingMethod"]
 */
export class OpenDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly account: Account,
    readonly currencies: Array<Currency> = [],
    readonly bookingMethod: BookingMethod = "DEFAULT",
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      account: Account;
      currencies: Array<Currency>;
      bookingMethod: BookingMethod;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): OpenDirective {
    return new OpenDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.account ?? this.account,
      props.currencies ?? this.currencies.slice(),
      props.bookingMethod ?? this.bookingMethod,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  #id: string = "";
  get id() {
    if (this.#id === "") {
      this.#id = checksum(this.toString());
    }
    return this.#id;
  }

  get type() {
    return "open";
  }

  visit<T>(visitor: DocumentVisitor<T>): T {
    return visitor.visit(this);
  }

  public toString() {
    let str = (
      formatDate(this.date) +
      " " +
      this.type +
      " " +
      this.account.toString() +
      " " +
      this.currencies.join(",")
    ).trim();

    if (this.bookingMethod !== "DEFAULT") {
      str += " " + this.bookingMethod;
    }
    return this.comments.toString(str) + this.metadata.toString(2);
  }
}

/**
 * YYYY-MM-DD close Account
 */
export class CloseDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly account: Account,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  get type() {
    return "close";
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      account: Account;
      currencies: Array<Currency>;
      bookingMethod: BookingMethod;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): CloseDirective {
    return new CloseDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.account ?? this.account,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  public toString() {
    return (
      this.comments.toString(
        formatDate(this.date) + " " + this.type + " " + this.account,
      ) + this.metadata.toString(2)
    );
  }
}

/**
 * YYYY-MM-DD commodity Currency
 */
export class CommodityDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly currency: Currency,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  get type() {
    return "commodity";
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      currency: Currency;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): CommodityDirective {
    return new CommodityDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.currency ?? this.currency,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  public toString() {
    return (
      this.comments.toString(
        formatDate(this.date) + " " + this.type + " " + this.currency,
      ) + this.metadata.toString(2)
    );
  }
}

/**
 * YYYY-MM-DD price Commodity Price
 */
export class PriceDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly currency: string,
    readonly amount: Amount,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  get type() {
    return "price";
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      currency: Currency;
      amount: Amount;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): PriceDirective {
    return new PriceDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.currency ?? this.currency,
      props.amount ?? this.amount,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  public toString() {
    return (
      this.comments.toString(
        formatDate(this.date) +
          " " +
          this.type +
          " " +
          this.currency +
          " " +
          this.amount,
      ) + this.metadata.toString(2)
    );
  }
}

/**
 * YYYY-MM-DD custom TypeName Value1 ...
 */
export class CustomDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly name: string,
    readonly args: ReadonlyArray<AttributeValue> = [],
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  get type() {
    return "custom";
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      name: string;
      args: ReadonlyArray<AttributeValue>;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): CustomDirective {
    return new CustomDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.name ?? this.name,
      props.args ?? this.args.slice(),
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  public toString() {
    return (
      this.comments.toString(
        formatDate(this.date) +
          " " +
          this.type +
          " " +
          writeString(this.name.toString()) +
          " " +
          writeAttribute(this.args),
      ) + this.metadata.toString(2)
    );
  }
}

/**
 * plugin ModuleName StringConfig
 */
export class PluginDirective extends Directive {
  constructor(
    readonly position: Position,
    readonly name: string,
    readonly options?: string | CodeBlock,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, metadata, comments);
  }

  copy(
    props: Partial<{
      position: Position;
      name: string;
      options: string | CodeBlock;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): PluginDirective {
    return new PluginDirective(
      props.position ?? this.position,
      props.name ?? this.name,
      props.options ?? this.options,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  get type() {
    return "plugin";
  }

  public toString() {
    const opt = this.options
      ? typeof this.options === "string"
        ? writeString(this.options)
        : this.options.toString()
      : "";
    return (
      this.comments.toString(
        (this.type + " " + writeString(this.name) + " " + opt).trim(),
      ) + this.metadata.toString(2)
    );
  }
}

/**
 * option Name Value
 */
export class OptionDirective extends Directive {
  constructor(
    readonly position: Position,
    readonly name: string,
    readonly value: string,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, metadata, comments);
  }

  get type() {
    return "option";
  }

  copy(
    props: Partial<{
      position: Position;
      name: string;
      value: string;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): OptionDirective {
    return new OptionDirective(
      props.position ?? this.position,
      props.name ?? this.name,
      props.value ?? this.value,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  public toString() {
    return (
      this.comments.toString(
        this.type +
          " " +
          writeString(this.name) +
          " " +
          writeString(this.value),
      ) + this.metadata.toString(2)
    );
  }
}

/**
 * event Type Description
 */
export class EventDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly eventType: string,
    readonly description: string,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  get type() {
    return "event";
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      eventType: string;
      description: string;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): EventDirective {
    return new EventDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.eventType ?? this.eventType,
      props.description ?? this.description,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  public toString() {
    return (
      this.comments.toString(
        formatDate(this.date) +
          " " +
          this.type +
          " " +
          writeString(this.eventType) +
          " " +
          writeString(this.description),
      ) + this.metadata.toString(2)
    );
  }
}

/**
 * include Filename
 */
export class IncludeDirective extends Directive {
  constructor(
    readonly position: Position,
    readonly value: string,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, metadata, comments);
  }

  get type() {
    return "include";
  }

  copy(
    props: Partial<{
      position: Position;
      value: string;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): IncludeDirective {
    return new IncludeDirective(
      props.position ?? this.position,
      props.value ?? this.value,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  public toString() {
    return (
      this.comments.toString(this.type + " " + writeString(this.value)) +
      this.metadata.toString(2)
    );
  }
}

/**
 * poptag #[tag]
 */
export class PopTagDirective extends Directive {
  constructor(
    readonly position: Position,
    readonly tag: Tag,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, metadata, comments);
  }

  copy(
    props: Partial<{
      position: Position;
      tag: Tag;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): PopTagDirective {
    return new PopTagDirective(
      props.position ?? this.position,
      props.tag ?? this.tag,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  get type() {
    return "poptag";
  }

  public toString() {
    return (
      this.comments.toString(this.type + " " + this.tag) +
      this.metadata.toString(2)
    );
  }
}

/**
 * pushtag #[tag]
 */
export class PushTagDirective extends Directive {
  popTag?: PopTagDirective;

  constructor(
    readonly position: Position,
    readonly tag: Tag,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, metadata, comments);
  }

  copy(
    props: Partial<{
      position: Position;
      tag: Tag;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): PushTagDirective {
    const directive = new PushTagDirective(
      props.position ?? this.position,
      props.tag ?? this.tag,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
    directive.popTag = this.popTag?.copy();
    return directive;
  }

  get type() {
    return "pushtag";
  }

  public toString() {
    return (
      this.comments.toString(this.type + " " + this.tag) +
      this.metadata.toString(2)
    );
  }
}

/**
 * YYYY-MM-DD document Account PathToDocument [..<#tags>] [...<#links>]
 */
export class DocumentDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly account: Account,
    readonly path: string,
    readonly tags: Array<Tag> = [],
    readonly links: Array<Link> = [],
    readonly pushedTags: Array<PushTagDirective> = [],
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      account: Account;
      path: string;
      tags: Array<Tag>;
      links: Array<Link>;
      pushedTags: Array<PushTagDirective>;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): DocumentDirective {
    return new DocumentDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.account ?? this.account,
      props.path ?? this.path,
      props.tags ?? this.tags.slice(),
      props.links ?? this.links.slice(),
      props.pushedTags ?? this.pushedTags.map((it) => it.copy()),
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  get type() {
    return "document";
  }

  public toString() {
    let str =
      formatDate(this.date) +
      " " +
      this.type +
      " " +
      this.account +
      " " +
      writeString(this.path);

    str += [...this.tags, ...this.links]
      .sort((a, b) => a.position.from - b.position.from)
      .map((it) => it.toString())
      .join(" ");
    return this.comments.toString(str) + this.metadata.toString(2);
  }
}

/**
 * YYYY-MM-DD [txn|Flag] [[Payee] Narration] [Flag] Account Amount [{Cost}] [@ Price] [Flag] Account Amount [{Cost}] [@ Price] ...

 */
export class TransactionDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly status: Flag,
    readonly date: DateTime,
    readonly payee: string,
    readonly narrative: string = "",
    readonly postings: Array<Posting>,
    readonly tags: Array<Tag> = [],
    readonly links: Array<Link> = [],
    readonly pushedTags: Array<PushTagDirective> = [],
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
    postings.forEach((it) => (it.transaction = this));
  }

  copy(
    data: Partial<{
      position: Position;
      status: Flag;
      date: DateTime;
      payee: string;
      postings: Array<Posting>;
      narrative: string;
      tags: Array<Tag>;
      links: Array<Link>;
      pushedTags: Array<PushTagDirective>;
      metadata: Attributes;
      comments: Comments;
    }>,
  ): TransactionDirective {
    return new TransactionDirective(
      data.position ?? this.position,
      data.status ?? this.status,
      data.date ?? this.date,
      data.payee ?? this.payee,
      data.narrative ?? this.narrative,
      data.postings ?? this.postings.slice(),
      data.tags ?? this.tags.slice(),
      data.links ?? this.links.slice(),
      data.pushedTags ?? this.pushedTags.slice(),
      data.metadata ?? this.metadata.copy(),
      data.comments ?? this.comments.copy(),
    );
  }

  get type() {
    return "txn";
  }

  visit<T>(visitor: DocumentVisitor<T>): T {
    this.postings.forEach((it) => visitor.visit(it));
    return visitor.visit(this);
  }

  public toString() {
    let str = (formatDate(this.date) + " " + this.status).trim();

    str = (
      str +
      " " +
      [this.payee, this.narrative]
        .filter((it) => it.length)
        .map((it) => writeString(it))
        .join(" ")
    ).trim();

    str = (
      str +
      " " +
      [...this.tags, ...this.links]
        .sort((a, b) => a.position.from - b.position.from)
        .map((it) => it.toString())
        .join(" ")
    ).trim();

    str = this.comments.toString(str) + this.metadata.toString(2);
    str += this.postings.map((it) => it.toString()).join("");
    return str;
  }
}

/**
 * [Flag] Account Amount [{Cost}] [@ Price]
 */
export class Posting extends Directive {
  transaction!: TransactionDirective;

  constructor(
    readonly position: Position,
    readonly status: Flag,
    readonly account: Account,
    readonly amount: Amount | null = null,
    readonly cost: Cost | CostSpec | null = null,
    readonly price: Amount | null = null,
    readonly totalCost: Amount | null = null,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, metadata, comments);
  }

  copy(
    data: Partial<{
      position: Position;
      status: Flag;
      account: Account;
      amount: Amount | null;
      cost: Cost | CostSpec | null;
      price: Amount | null;
      totalCost: Amount | null;
      metadata: Attributes;
      comments: Comments;
    }>,
  ): Posting {
    return new Posting(
      data.position ?? this.position,
      data.status ?? this.status,
      data.account ?? this.account,
      data.amount || data.amount === null ? data.amount : this.amount,
      data.cost || data.cost === null ? data.cost : this.cost,
      data.price || data.price === null ? data.price : this.price,
      data.totalCost || data.totalCost === null
        ? data.totalCost
        : this.totalCost,
      data.metadata ?? this.metadata.copy(),
      data.comments ?? this.comments.copy(),
    );
  }

  get type() {
    return "posting";
  }

  public toString() {
    let str = "  " + (this.status + " " + this.account).trim();
    if (this.amount) {
      str += " " + this.amount.toString();
    }
    if (this.cost) {
      str += " " + this.cost.toString();
    }
    if (this.price) {
      str += " @ " + this.price.toString();
    } else if (this.totalCost) {
      str += " @@ " + this.totalCost.toString();
    }
    return this.comments.toString(str) + this.metadata.toString(4);
  }
}

/**
 * YYYY-MM-DD query Name SqlContents
 */
export class QueryDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly name: string,
    readonly query: string | CodeBlock,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      name: string;
      query: string | CodeBlock;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): QueryDirective {
    return new QueryDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.name ?? this.name,
      props.query ?? this.query,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  get type(): string {
    return "query";
  }

  public toString() {
    const qs =
      typeof this.query === "string"
        ? writeString(this.query)
        : this.query.toString();
    return (
      this.comments.toString(
        formatDate(this.date) + " query " + writeString(this.name) + " " + qs,
      ) + this.metadata.toString(2)
    );
  }
}

/**
 * YYYY-MM-DD note Account Narrative [..<#tags>] [...<#links>]
 */
export class NoteDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly account: Account,
    readonly narrative: string,
    readonly tags: Array<Tag> = [],
    readonly links: Array<Link> = [],
    readonly pushedTags: Array<PushTagDirective> = [],
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  get type() {
    return "note";
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      account: Account;
      narrative: string;
      tags: Array<Tag>;
      links: Array<Link>;
      pushedTags: Array<PushTagDirective>;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): NoteDirective {
    return new NoteDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.account ?? this.account,
      props.narrative ?? this.narrative,
      props.tags ?? this.tags.slice(),
      props.links ?? this.links.slice(),
      props.pushedTags ?? this.pushedTags.map((it) => it.copy()),
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  public toString() {
    return this.comments.toString(
      formatDate(this.date) +
        " " +
        this.type +
        " " +
        this.account +
        " " +
        writeString(this.narrative) +
        "\n" +
        this.metadata,
    );
  }
}

/**
 * YYYY-MM-DD balance Account Amount
 */
export class BalanceDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly account: Account,
    readonly amount: Amount,
    readonly tolerance?: Numeric,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  get type() {
    return "balance";
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      account: Account;
      amount: Amount;
      tolerance: Numeric;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): BalanceDirective {
    return new BalanceDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.account ?? this.account,
      props.amount ?? this.amount,
      props.tolerance ?? this.tolerance,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  get value(): Decimal | undefined {
    if (this.amount.value instanceof NumberExpression) {
      return this.amount.value.resolve();
    } else if (this.amount.value instanceof Decimal) {
      return this.amount.value;
    }
  }

  public toString() {
    let str =
      formatDate(this.date) + " " + this.type + " " + this.account + " ";

    if (this.tolerance) {
      str +=
        this.amount.value.toString() +
        " ~ " +
        this.tolerance +
        " " +
        this.amount.currency;
    } else {
      str += this.amount;
    }
    return this.comments.toString(str) + this.metadata.toString(2);
  }
}

/**
 * YYYY-MM-DD pad <SourceAccount> <TargetAccount>
 */
export class PadDirective extends DatedDirective {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly source: Account,
    readonly target: Account,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, date, metadata, comments);
  }

  get type() {
    return "pad";
  }

  copy(
    props: Partial<{
      position: Position;
      date: DateTime;
      source: Account;
      target: Account;
      metadata: Attributes;
      comments: Comments;
    }> = {},
  ): PadDirective {
    return new PadDirective(
      props.position ?? this.position,
      props.date ?? this.date,
      props.source ?? this.source,
      props.target ?? this.target,
      props.metadata ?? this.metadata.copy(),
      props.comments ?? this.comments.copy(),
    );
  }

  public toString() {
    let str =
      formatDate(this.date) +
      " " +
      this.type.toString() +
      " " +
      this.source +
      " " +
      this.target;
    return this.comments.toString(str) + this.metadata.toString(2);
  }
}
