import { DateTime } from "luxon";
import { Decimal, parseNumber } from "./number.js";
import { formatDate, writeAttribute, writeString } from "./parser.js";
import type { DocumentVisitor } from "./visitor.js";
import { checksum } from "./hash.js";

/** `[from, to, line]` */
export type Currency = string;
export type Numeric = Decimal | NumberExpression;
export type Account = string;
export type AttributeValue = string | Numeric | boolean | DateTime | Amount;
export type Flag = string;

export class Position {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly line: number,
  ) {}

  public toString() {
    return `${this.line}:${this.from}-${this.to}`;
  }
}

export abstract class Node {
  constructor(readonly position: Position) {}
}

export class LineComment extends Node {
  constructor(
    readonly position: Position,
    readonly content: string,
  ) {
    super(position);
  }

  public toString() {
    return this.content;
  }
}

export class Comments {
  constructor(
    readonly commentsBefore: Array<LineComment> = [],
    public inlineComment?: LineComment,
  ) {}

  prepend(comment: LineComment | Array<LineComment>) {
    if (Array.isArray(comment)) {
      this.commentsBefore.push(...comment);
    } else {
      this.commentsBefore.push(comment);
    }
  }

  copy(
    props: Partial<{
      commentsBefore: Array<LineComment>;
      readonly inlineComment?: LineComment;
    }> = {},
  ) {
    return new Comments(
      props.commentsBefore ?? this.commentsBefore.slice(),
      props.inlineComment ?? this.inlineComment,
    );
  }

  public toString(source: string = "") {
    let str = "";
    this.commentsBefore.forEach((it) => {
      if (str && !/\n\s*$/.test(str) && !/^\s*\n/.test(it.toString())) {
        str += "\n";
      }
      str += it.toString();
    });
    if (str && !/\n\s*$/.test(str)) {
      str += "\n";
    }
    str += source;
    if (this.inlineComment) {
      str = str.replace(/\n\s*$/, "") + " " + this.inlineComment.toString();
      if (!/\n\s*$/.test(str)) {
        str += "\n";
      }
    } else {
      if (str && !/\n\s*$/.test(str)) {
        str += "\n";
      }
    }
    return str;
  }
}

export abstract class NodeBase extends Node {
  constructor(
    readonly position: Position,
    readonly comments: Comments = new Comments(),
  ) {
    super(position);
  }

  /** Create a copy of this node. */
  clone(): NodeBase {
    const copy: NodeBase = Object.create(
      Object.getPrototypeOf(this),
      Object.getOwnPropertyDescriptors(this),
    );
    return copy;
  }
}

export class CodeBlock extends Node {
  constructor(
    readonly position: Position,
    readonly content: string,
  ) {
    super(position);
  }

  #language: string | null = null;
  get language(): string {
    if (this.#language !== null) {
      return this.#language;
    }
    const match = this.content
      .trim()
      .split("\n", 2)[0]
      .match(/^[`]+([a-zA-Z][a-zA-Z0-9-_]*)/);
    this.#language = match ? match[1] : "";
    return this.#language;
  }

  get code(): string {
    return this.content.replaceAll(/(^\s+[`])|(\s*[`]+$)/g, "");
  }

  public toString() {
    return this.content;
  }
}

export class NumberExpression {
  #operands: Array<Numeric> = [];
  op: string;

  constructor(value: string | Numeric | Array<Numeric>, op: string = "") {
    this.op = op;
    if (typeof value === "string") {
      this.#operands.push(parseNumber(value)!);
    } else if (Array.isArray(value)) {
      value.forEach((it) => this.#operands.push(it));
    } else {
      this.#operands.push(value);
    }
    if (this.#operands.length < 1 || this.#operands.length > 2) {
      throw new Error(`Invalid NumberExpression`);
    }
  }

  get value() {
    return this.resolve();
  }

  get operands() {
    return [...this.#operands];
  }

  resolve(): Decimal {
    if (this.#operands.length == 1) {
      if (this.#operands[0] instanceof Decimal) {
        return this.#operands[0];
      } else {
        return this.#operands[0].resolve();
      }
    }
    return this.eval(this.#operands[0], this.#operands[1]);
  }

  private eval(left: Numeric, right: Numeric) {
    const l: Decimal = left instanceof NumberExpression ? left.resolve() : left;
    const r: Decimal =
      right instanceof NumberExpression ? right.resolve() : right;
    switch (this.op) {
      case "*":
        return l.mul(r);
      case "-":
        return l.minus(r);
      case "/":
        return l.div(r);
      case "+":
        return l.add(r);
    }
    throw new Error("Unsupported expression: " + this.toString());
  }

  times(value: Numeric) {
    return new NumberExpression([this, value], "*");
  }

  plus(value: Numeric) {
    return new NumberExpression([this, value], "+");
  }

  minus(value: Numeric) {
    return new NumberExpression([this, value], "-");
  }

  div(value: Numeric) {
    return new NumberExpression([this, value], "/");
  }

  public toString(): string {
    if (this.#operands.length == 1) {
      const operand = this.#operands[0];
      if (operand instanceof NumberExpression) {
        return "(" + this.#operands[0] + ")";
      }
      return operand.toString();
    }
    return this.#operands[0] + " " + this.op + " " + this.#operands[1];
  }
}

export class Amount {
  value: Numeric | null;
  constructor(
    value: string | Numeric,
    readonly currency: Currency | null = null,
  ) {
    this.value = typeof value === "string" ? parseNumber(value)! : value;
  }

  get resolvedValue() {
    return this.value;
  }

  public toString() {
    return (this.value + " " + (this.currency ?? "")).trim();
  }
}

export class Cost {
  constructor(
    readonly amount: Amount | null = null,
    readonly date: DateTime | null = null,
    readonly label: string = "",
  ) {}

  public toString() {
    const parts: Array<string> = [
      this.amount?.toString() || "",
      formatDate(this.date),
      this.label,
    ];
    return "{ " + parts.filter((it) => it).join(" , ") + " }";
  }
}

export class CostSpec {
  constructor(
    readonly numberPer: Numeric | null = null,
    readonly numberTotal: Numeric | null = null,
    readonly currency: string | null = null,
    readonly date: DateTime | null = null,
    readonly label: string = "",
    readonly numberTotalMissing: boolean = false,
  ) {}

  public toString() {
    let str = "{ ";
    let value = `${this.numberTotal} # ${this.numberPer}`.trim();
    if (value !== "#") {
      str += value + " ";
    }

    value = this.currency?.toString() || "";
    if (value) {
      str += value + " ";
    }

    const parts: Array<string> = [];
    value = formatDate(this.date);
    if (value) {
      parts.push(value);
    }

    if (this.label) {
      parts.push(writeString(this.label));
    }

    str += parts.join(" , ");

    str += " }";
    return str;
  }
}

export class Attribute extends NodeBase {
  constructor(
    readonly position: Position,
    readonly name: string,
    readonly value?: AttributeValue | null,
    readonly comments: Comments = new Comments(),
  ) {
    super(position, comments);
  }

  copy(
    props: Partial<{
      position: Position;
      name: string;
      value?: AttributeValue | null;
      comments: Comments;
    }> = {},
  ) {
    return new Attribute(
      props.position ?? this.position,
      props.name ?? this.name,
      props.value ?? this.value,
      props.comments ?? this.comments.copy(),
    );
  }

  public toString(indent: number = 2) {
    let str = "";
    const pad = " ".repeat(indent);
    this.comments.commentsBefore.forEach(
      (it) => (str += pad + it.toString() + "\n"),
    );
    str += pad + this.name + ":";
    if (this.value != null) {
      str += " " + writeAttribute(this.value);
    }
    if (this.comments.inlineComment) {
      str += " " + this.comments.inlineComment + "\n";
    } else {
      str += "\n";
    }
    return str;
  }
}

export class Attributes {
  constructor(readonly attributes: Array<Attribute> = []) {}

  get empty() {
    return this.attributes.length == 0;
  }

  public copy(
    props: Partial<{
      attributes: Array<Attribute>;
    }> = {},
  ) {
    return new Attributes(
      props.attributes ?? this.attributes.map((it) => it.copy()),
    );
  }

  public toString(indent: number = 0) {
    return this.attributes.map((it) => it.toString(indent)).join("");
  }

  get(name: string): Attribute | undefined {
    return this.attributes.find((it) => it.name === name);
  }

  toMap(): Record<string, AttributeValue | null> {
    const data: Record<string, AttributeValue | null> = {};
    return this.attributes.reduce((acc, value) => {
      acc[value.name] = value.value ?? null;
      return acc;
    }, data);
  }
}

export abstract class Directive extends NodeBase {
  abstract readonly type: string;

  constructor(
    readonly position: Position,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, comments);
  }

  visit<T>(visitor: DocumentVisitor<T>): T {
    return visitor.visit(this);
  }

  abstract copy(props: Partial<Record<string, unknown>>): Directive;

  #id: string = "";
  get id() {
    if (this.#id === "") {
      this.#id = checksum(this.toString());
    }
    return this.#id;
  }
}

export abstract class DatedDirective extends Directive {
  constructor(
    readonly position: Position,
    readonly date: DateTime,
    readonly metadata: Attributes = new Attributes(),
    readonly comments: Comments = new Comments(),
  ) {
    super(position, metadata, comments);
  }
}
