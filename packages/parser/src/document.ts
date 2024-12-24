import { parser } from "@beancount-js/codemirror-lang-beancount";
import { Text } from "./text";
import { SyntaxNode, SyntaxNodeRef, Tree } from "@lezer/common";
import {
  Amount,
  Attribute,
  Attributes,
  AttributeValue,
  CodeBlock,
  LineComment,
  Comments,
  Cost,
  CostSpec,
  Directive,
  NumberExpression,
  Position,
} from "./models";
import { DocumentVisitor } from "./visitor";
import {
  BalanceDirective,
  BookingMethod,
  CloseDirective,
  CommodityDirective,
  CustomDirective,
  DocumentDirective,
  EventDirective,
  IncludeDirective,
  Link,
  NoteDirective,
  OpenDirective,
  OptionDirective,
  PadDirective,
  PluginDirective,
  PopTagDirective,
  Posting,
  PriceDirective,
  PushTagDirective,
  QueryDirective,
  Tag,
  TransactionDirective,
} from "./directives";
import { parseDate, readString } from "./parser";
import { Decimal, parseNumber } from "./number";
import { md5 } from "./hash";

export type ParserOptions = {
  strict: boolean;
  filename: string;
  bookingMethod: BookingMethod;
  attributes: Record<string, unknown>;
};

export interface ParseError {
  position: Position;
  message: string;
  directives?: Directive[];
}

export class BeanCountDocument {
  readonly doc: Text;
  readonly tree: Tree;

  tagStack: Array<PushTagDirective> = [];
  #directives: Array<Directive> = [];
  errors: Array<ParseError> = [];
  #directiveMap: Record<string, Directive> = {};

  constructor(
    readonly contents: string,
    readonly options: ParserOptions = {
      strict: false,
      filename: "",
      bookingMethod: "DEFAULT",
      attributes: {},
    },
  ) {
    this.doc = Text.of(contents.split("\n"));
    this.tree = parser.configure({ strict: options.strict }).parse(contents);
    this.tree.cursor().iterate(this.enter.bind(this));
  }

  get filename() {
    return this.options.filename;
  }

  #hash: string = ""
  get hash() {
    if (this.#hash === "") {
      this.#hash = md5(this.contents);
    }
    return this.#hash;
  }

  get directives(): Array<Directive> {
    return [...this.#directives];
  }

  visit<T>(visitor: DocumentVisitor<T>) {
    this.directives.forEach((it) => it.visit(visitor));
  }

  findById(id: string | null | undefined) {
    return id ? this.#directiveMap[id] : undefined;
  }

  private add(directive: Directive) {
    const exist = this.#directiveMap[directive.id];
    if (exist) {
      this.errors.push({
        message: `Directive with id: ${directive.id} already exists at position ${exist.position}`,
        position: directive.position,
        directives: [exist, directive],
      });
      this.#directives.push(directive);
      return;
    }
    this.#directiveMap[directive.id] = directive;
    this.#directives.push(directive);
  }

  public toString() {
    return this.directives
      .map((it) => it.toString())
      .join("\n")
      .trim();
  }

  private enter(node: SyntaxNodeRef) {
    if (node.name === "Open") {
      return this.openDirective(node);
    } else if (node.name === "Close") {
      return this.closeDirective(node);
    } else if (node.name === "Commodity") {
      return this.commodityDirective(node);
    } else if (node.name === "Balance") {
      return this.balanceDirective(node);
    } else if (node.name === "Pad") {
      return this.padDirective(node);
    } else if (node.name === "Note") {
      return this.noteDirective(node);
    } else if (node.name === "Option") {
      return this.optionDirective(node);
    } else if (node.name === "PushTag") {
      return this.pushTagDirective(node);
    } else if (node.name === "Plugin") {
      return this.pluginDirective(node);
    } else if (node.name === "PopTag") {
      return this.popTagDirective(node);
    } else if (node.name === "Transaction") {
      return this.transactionDirective(node);
    } else if (node.name === "Price") {
      return this.priceDirective(node);
    } else if (node.name === "Custom") {
      return this.customDirective(node);
    } else if (node.name === "Query") {
      return this.queryDirective(node);
    } else if (node.name === "Include") {
      return this.includeDirective(node);
    } else if (node.name === "Document") {
      return this.documentDirective(node);
    } else if (node.name === "Event") {
      return this.eventDirective(node);
    }
  }

  private queryDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const name = node.node.getChild("String");
    const value = name?.nextSibling;
    if (
      !date ||
      !name ||
      !value ||
      !["String", "CodeBlock"].includes(value.name)
    ) {
      this.error(node, "Expected: (Date query <string> <string|code-block>)");
      return;
    }

    const directive = new QueryDirective(
      this.position(node),
      parseDate(this.content(date)),
      readString(this.content(name)),
      value.name === "String"
        ? readString(this.content(value))
        : new CodeBlock(this.position(value), this.content(value)),
    );
    this.add(this.addComments(node.node, directive));
    return false;
  }

  private includeDirective(node: SyntaxNodeRef) {
    const path = node.node.getChild("String");

    if (!path) {
      this.error(node, "Expected: (include String)");
      return;
    }

    this.add(
      this.addComments(
        node.node,
        new IncludeDirective(
          this.position(node),
          readString(this.content(path)),
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private documentDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const account = node.node.getChild("AccountName");
    const path = node.node.getChild("String");

    if (!date || !account || !path) {
      this.error(node, "Expected: (document Date Account String)");
      return;
    }

    const tags = (node.node.getChildren("Tag") || []).map(
      (it) => new Tag(this.position(it), this.content(it)),
    );
    const links = (node.node.getChildren("Link") || []).map(
      (it) => new Link(this.position(it), this.content(it)),
    );

    this.add(
      this.addComments(
        node.node,
        new DocumentDirective(
          this.position(node),
          parseDate(this.content(date)),
          this.content(account),
          readString(this.content(path)),
          tags,
          links,
          [...this.tagStack],
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private position(node: SyntaxNode | SyntaxNodeRef) {
    return {
      from: node.from,
      to: node.to,
      line: this.doc.lineAt(node.from).number,
    };
  }

  private transactionDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const flag = node.node.getChild("Flag");
    const descriptions = (node.node.getChildren("String") || [])
      .map((it) => readString(this.content(it)))
      .filter((it) => it.trim().length > 0);

    if (!date) {
      this.error(
        node,
        "Expected: (Date [Flag] Payee [Narrative] [Metadata] [Transactions])",
      );
      return;
    }

    const tags = (node.node.getChildren("Tag") || []).map(
      (it) => new Tag(this.position(it), this.content(it)),
    );
    const links = (node.node.getChildren("Link") || []).map(
      (it) => new Link(this.position(it), this.content(it)),
    );
    const metadata = this.attributes(node.node.getChild("Metadata"));

    const lastChild = (
      node.node.getChild("Metadata") || node.node.getChild("Posting")
    )?.prevSibling;

    const postings: Array<Posting> = (node.node.getChildren("Posting") || [])
      .map((it) => this.posting(it))
      .filter((it) => it !== undefined);

    this.add(
      this.addComments(
        node.node,
        new TransactionDirective(
          this.position(node),
          this.flag(flag),
          parseDate(this.content(date)),
          (descriptions.length === 2 ? descriptions[0] : "") ?? "",
          (descriptions.length === 2 ? descriptions[1] : descriptions[0]) ?? "",
          postings,
          tags,
          links,
          [...this.tagStack],
          metadata,
        ),
        lastChild,
      ),
    );
    return false;
  }

  private posting(node: SyntaxNode) {
    const flag = node.getChild("Flag");
    const account = node.getChild("AccountName");

    if (!account) {
      this.error(node, "Expected: Posting ([Flag] Account)");
      return;
    }
    const amount = this.amount(node.getChild("Amount"));
    const price = this.amount(
      node.getChild("PostingPrice")?.getChild("Amount"),
    );
    const totalCost = this.amount(
      node.getChild("TotalCost")?.getChild("Amount"),
    );

    if (
      price &&
      price.value instanceof NumberExpression &&
      price.value.resolve().lt(0)
    ) {
      this.error(node, `Negative prices are not allowed: ${price.value}`);
    } else if (price && price.value instanceof Decimal && price.value.lt(0)) {
      this.error(node, `Negative prices are not allowed: ${price.value}`);
    }

    if (
      totalCost &&
      (totalCost.value instanceof NumberExpression ||
        totalCost.value instanceof Decimal) &&
      (!amount || !amount.value)
    ) {
      this.error(
        node,
        `Total price on a posting without units: ${totalCost.value}`,
      );
    }

    const cost = this.cost(
      node.getChild("Cost") || node.getChild("CostTotalValue"),
    );
    const metadata = this.attributes(node.getChild("Metadata"));

    const posting = new Posting(
      this.position(node),
      this.flag(flag),
      this.content(account),
      amount,
      cost,
      price,
      totalCost,
      metadata,
    );
    posting.comments.prepend(this.findComments(node));
    this.addInlineComment(
      node.getChild("Comment") || node.lastChild,
      node,
      posting,
    );
    return posting;
  }

  private flag(node: SyntaxNode | null) {
    if (!node) {
      return "";
    }
    return this.content(node).trim();
  }

  private cost(node: SyntaxNode | null): Cost | CostSpec | null {
    if (!node) {
      return null;
    } else if (node.name === "CostTotalValue") {
      let cost = this.cost(node.getChild("Cost"));
      if (cost instanceof CostSpec) {
        if (cost.numberPer) {
          this.error(
            node,
            "Per-unit cost may not be specified using total cost syntax",
          );
          cost = new CostSpec(
            Decimal.ZERO,
            cost.numberTotal,
            cost.currency,
            cost.date,
            cost.label,
          );
        }
      } else if (cost instanceof Cost) {
        cost = new CostSpec(
          Decimal.ZERO,
          cost.amount?.value,
          cost.amount?.currency,
          cost.date,
          cost.label,
        );
      }
      return cost;
    } else if (node.name !== "Cost") {
      return null;
    }
    const date = node.getChild("Date");
    const label = node.getChild("String");
    let amount = this.amount(node.getChild("Amount"));
    let el = node.getChild("CostPer");
    if (el) {
      amount = this.amount(el.getChild("Amount"));
      return new CostSpec(
        amount.value,
        null,
        amount.currency,
        date ? parseDate(this.content(date)) : undefined,
        label ? this.content(label) : undefined,
      );
    }

    el = node.getChild("CostTotal");
    if (el) {
      const expr = el.firstChild;
      amount = this.amount(el.getChild("Amount"));
      return new CostSpec(
        expr?.name === "NumberExpr" ? this.numberExpression(expr) : null,
        amount.value,
        amount.currency,
        date ? parseDate(this.content(date)) : undefined,
        label ? this.content(label) : undefined,
      );
    }

    return new Cost(
      amount,
      date ? parseDate(this.content(date)) : undefined,
      label ? this.content(label) : undefined,
    );
  }

  private amount(node: SyntaxNode | null | undefined) {
    if (!node || node.name !== "Amount") {
      return null;
    }
    const numberExpr =
      this.numberExpression(node.getChild("NumberExpr")) || null;
    const currency = node.getChild("Currency");
    return new Amount(numberExpr, currency ? this.content(currency) : null);
  }

  private attributes(node: SyntaxNode | null): Attributes {
    const attributes: Array<Attribute> = [];
    if (!node) {
      return new Attributes();
    }

    if (node.name !== "Metadata") {
      return this.attributes(node.getChild("Metadata"));
    }

    const children = node.getChildren("Attribute") || [];
    for (let i = 0; i < children.length; i++) {
      const attr = children[i];
      const name = attr.getChild("AttributeName");
      if (!name) {
        this.error(attr, "Expected: (AttributeName ':' [MetaValue])");
        return;
      }
      const el = attr.getChild("MetaValue");
      const next = el.nextSibling?.firstChild;
      let value = this.attributeValue(el);
      if (
        next &&
        value instanceof NumberExpression &&
        next.name === "Currency"
      ) {
        value = new Amount(value, this.content(next));
      }
      const attribute = new Attribute(
        this.position(attr),
        this.content(name).replaceAll(/\s*:$/g, ""),
        value,
      );
      this.addComments(attr, attribute);
      attributes.push(attribute);
    }
    if (attributes.length) {
      this.addComments(node, attributes[0]);
    }
    const attrs = new Attributes(attributes);
    return attrs;
  }

  private attributeValue(node: SyntaxNode | null): AttributeValue | undefined {
    if (!node) {
      return undefined;
    }
    if (node.name === "MetaValue") {
      return this.attributeValue(node.firstChild);
    }
    if (node.name === "Number") {
      return parseNumber(this.content(node));
    } else if (node.name === "NumberExpr") {
      return this.numberExpression(node)!;
    } else if (node.name === "Date") {
      return parseDate(this.content(node));
    } else if (node.name === "String") {
      return readString(this.content(node));
    } else if (node.name === "Bool") {
      return ["true", "TRUE"].includes(this.content(node).trim());
    }
    return this.content(node);
  }

  private numberExpression(
    node: SyntaxNode | null | undefined,
  ): NumberExpression | null {
    if (!node) {
      return null;
    }

    const number = node.getChild("Number");
    const op =
      node.getChild("PLUS") ||
      node.getChild("MINUS") ||
      node.getChild("ASTERISK") ||
      node.getChild("Flag") ||
      node.getChild("SLASH");
    const operands = node.getChildren("NumberExpr") || [];
    if (number) {
      return new NumberExpression(this.content(number));
    }
    return new NumberExpression(
      operands.map((it) => this.numberExpression(it)!),
      op ? this.content(op).trim() : "",
    );
  }

  private pushTagDirective(node: SyntaxNodeRef) {
    const tag = node.node.getChild("Tag");
    if (!tag) {
      this.error(node, "Expected: (pushtag #<tag>)");
      return;
    }

    const directive = new PushTagDirective(
      this.position(node),
      new Tag(this.position(tag), this.content(tag)),
      this.attributes(node.node),
    );

    const existing = this.tagStack.filter(
      (it) => it.tag.value === directive.tag.value,
    );
    if (existing.length) {
      this.error(
        node,
        `Pushed tag(${directive.tag}) that is already currently in the stack`,
      );
    }

    this.tagStack.push(directive);
    this.add(this.addComments(node.node, directive));
    return false;
  }

  private pluginDirective(node: SyntaxNodeRef) {
    const type = node.node.getChild("String");
    const option = type?.nextSibling;
    if (!type || (option && !["String", "CodeBlock"].includes(option.name))) {
      this.error(node, "Expected: (plugin <string> <string|code-block>)");
      return;
    }

    const directive = new PluginDirective(
      this.position(node),
      readString(this.content(type)),
      option
        ? option.name === "String"
          ? readString(this.content(option))
          : new CodeBlock(this.position(option), this.content(option))
        : undefined,
      this.attributes(node.node),
    );
    this.add(this.addComments(node.node, directive));
    return false;
  }

  private popTagDirective(node: SyntaxNodeRef) {
    const tag = node.node.getChild("Tag");
    if (!tag) {
      this.error(node, "Expected: (pushtag #<tag>)");
      return;
    }

    const directive = new PopTagDirective(
      this.position(node),
      new Tag(this.position(tag), this.content(tag)),
      this.attributes(node.node),
    );

    const existing = this.tagStack.filter(
      (it) => it.tag.value === directive.tag.value,
    );
    if (!existing.length) {
      this.error(
        node,
        `Popped tag(${directive.tag}) that isn't currently in the stack`,
      );
    }
    existing.forEach((it) => {
      it.popTag = directive;
      this.tagStack = this.tagStack.filter((t) => t.id !== it.id);
    });
    this.add(this.addComments(node.node, directive));
    return false;
  }

  private openDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const account = node.node.getChild("AccountName");

    if (!date || !account) {
      this.error(
        node,
        "Expected: (Date open Account [Curreencies...] [BookingMethod])",
      );
      return;
    }

    const currencies =
      node.node.getChild("Currencies")?.getChildren("Currency") || [];
    const bookingMethod = node.node.getChild("BookingMethod");

    this.add(
      this.addComments(
        node.node,
        new OpenDirective(
          this.position(node),
          parseDate(this.content(date)),
          this.content(account),
          currencies.map((it) => this.content(it)),
          bookingMethod
            ? (this.content(bookingMethod).trim() as BookingMethod)
            : this.options.bookingMethod,
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private closeDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const account = node.node.getChild("AccountName");

    if (!date || !account) {
      this.error(node, "Expected: (Date close Account)");
      return;
    }

    this.add(
      this.addComments(
        node.node,
        new CloseDirective(
          this.position(node),
          parseDate(this.content(date)),
          this.content(account),
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private priceDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const currency = node.node.getChild("Currency");
    const amount = this.amount(node.node.getChild("Amount"));

    if (!date || !currency || !amount) {
      this.error(node, "Expected: (Date price Commodity Amount)");
      return;
    }

    this.add(
      this.addComments(
        node.node,
        new PriceDirective(
          this.position(node),
          parseDate(this.content(date)),
          this.content(currency),
          amount,
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private customDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const name = node.node.getChild("String");
    const args: Array<AttributeValue> = [];

    if (!date || !name) {
      this.error(node, "Expected: (Date price Commodity Amount)");
      return;
    }

    const values = node.node.getChildren("MetaValue") || [];
    for (let i = 0; i < values.length; i++) {
      const value = this.attributeValue(values[i]);
      if (value instanceof NumberExpression) {
        if (i + 1 < values.length) {
          const currency = values[i + 1].getChild("Currency");
          if (currency) {
            args.push(new Amount(value, this.content(currency)));
            i++;
          } else {
            args.push(value);
          }
        } else {
          args.push(value);
        }
      } else if (value !== null && value !== undefined) {
        args.push(value);
      }
    }

    this.add(
      this.addComments(
        node.node,
        new CustomDirective(
          this.position(node),
          parseDate(this.content(date)),
          readString(this.content(name)),
          args,
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private commodityDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const currency = node.node.getChild("Currency");

    if (!date || !currency) {
      this.error(node, "Expected: (Date commodity Currency)");
      return;
    }

    this.add(
      this.addComments(
        node.node,
        new CommodityDirective(
          this.position(node),
          parseDate(this.content(date)),
          this.content(currency),
          this.attributes(node.node),
        ),
      ),
    );

    return false;
  }

  private balanceDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const account = node.node.getChild("AccountName");
    const numberExpr = this.numberExpression(node.node.getChild("NumberExpr"));
    const currency = node.node.getChild("Currency");
    const tolerance = node.node.getChild("Tolerance");

    if (!date || !account || !numberExpr || !currency) {
      this.error(
        node,
        "Expected: (Date balance Account Number [Tolerance] Currency)",
      );
      return;
    }

    this.add(
      this.addComments(
        node.node,
        new BalanceDirective(
          this.position(node),
          parseDate(this.content(date)),
          this.content(account),
          new Amount(numberExpr, this.content(currency)),
          tolerance
            ? this.numberExpression(tolerance.getChild("NumberExpr"))!
            : undefined,
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private padDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const accounts = node.node.getChildren("AccountName") || [];

    if (!date || accounts.length !== 2) {
      this.error(node, "Expected: (Date pad SourceAccount TargetAccount)");
      return;
    }

    this.add(
      this.addComments(
        node.node,
        new PadDirective(
          this.position(node),
          parseDate(this.content(date)),
          this.content(accounts[0]),
          this.content(accounts[1]),
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private noteDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const account = node.node.getChild("AccountName");
    const value = node.node.getChild("String");
    const tags = (node.node.getChildren("Tag") || []).map(
      (it) => new Tag(this.position(it), this.content(it)),
    );
    const links = (node.node.getChildren("Link") || []).map(
      (it) => new Link(this.position(it), this.content(it)),
    );

    if (!date || !account || !value) {
      this.error(node, "Expected: (Date note Account String)");
      return;
    }

    this.add(
      this.addComments(
        node.node,
        new NoteDirective(
          this.position(node),
          parseDate(this.content(date)),
          this.content(account),
          readString(this.content(value)),
          tags,
          links,
          [...this.tagStack],
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private eventDirective(node: SyntaxNodeRef) {
    const date = node.node.getChild("Date");
    const values = node.node.getChildren("String") || [];

    if (!date || values.length !== 2) {
      this.error(node, "Expected: (Date event Type Description)");
      return;
    }

    this.add(
      this.addComments(
        node.node,
        new EventDirective(
          this.position(node),
          parseDate(this.content(date)),
          readString(this.content(values[0])),
          readString(this.content(values[1])),
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private optionDirective(node: SyntaxNodeRef) {
    const values = node.node.getChildren("String") || [];

    if (values.length < 1) {
      this.error(node, "Expected: (option String String)");
      return;
    }

    this.add(
      this.addComments(
        node.node,
        new OptionDirective(
          this.position(node),
          readString(this.content(values[0])),
          readString(this.content(values[1])),
          this.attributes(node.node),
        ),
      ),
    );
    return false;
  }

  private error(node: SyntaxNode | SyntaxNodeRef, message: string) {
    this.errors.push({
      position: new Position(
        node.from,
        node.to,
        this.doc.lineAt(node.from).number,
      ),
      message: message + ` found ${node.toString()}`,
    });
  }

  private addComments<T>(
    node: SyntaxNode,
    directive: T & { comments: Comments },
    lastChild?: SyntaxNode | null,
  ) {
    const comments = this.findComments(node);
    directive.comments.prepend(comments);

    const last = lastChild || node.lastChild;
    this.addInlineComment(last, node, directive);
    this.addInlineComment(node.nextSibling, node, directive);
    node.getChildren("Comment").forEach((comment) => {
      if (directive.comments.inlineComment) {
        return;
      }
      this.addInlineComment(comment, node, directive);
    });
    return directive;
  }

  private addInlineComment(
    comment: SyntaxNode | null | undefined,
    node: SyntaxNode,
    parent: Comments | Directive | { comments: Comments },
  ) {
    if (comment?.name !== "Comment") {
      if (comment?.nextSibling?.name === "Comment") {
        comment = comment.nextSibling;
      } else {
        return;
      }
    }

    if (
      this.doc.lineAt(comment.from).number === this.doc.lineAt(node.from).number
    ) {
      if (parent instanceof Comments) {
        parent.inlineComment = this.comment(comment);
      } else {
        parent.comments.inlineComment = this.comment(comment);
      }
    }
  }

  private findComments(node: SyntaxNode) {
    const comments: Array<LineComment> = [];
    let prev = node.prevSibling;
    if (prev && !this.isComment(prev) && this.isComment(prev.lastChild)) {
      prev = prev.lastChild;
    }
    while (prev && this.isLineComment(prev)) {
      comments.push(this.comment(prev));
      prev = prev.prevSibling;
      if (prev && !this.isComment(prev) && this.isComment(prev.lastChild)) {
        prev = prev.lastChild;
      }
    }
    return comments.reverse();
  }

  private isComment(node: SyntaxNode | null | undefined) {
    if (!node) {
      return false;
    }
    return ["Comment", "DocumentMarkup"].includes(node.name);
  }

  private isLineComment(node: SyntaxNode | null | undefined) {
    if (!node || !this.isComment(node)) {
      return false;
    }

    const prev = node.prevSibling;
    if (!prev) {
      return true;
    }

    const prevLine = this.doc.lineAt(prev.from).number;
    const curLine = this.doc.lineAt(node.from).number;

    if (prevLine < curLine) {
      return true;
    }

    if (prevLine === curLine && prev.name === "Comment") {
      return true;
    }
    return false;
  }

  private comment(node: SyntaxNode) {
    return new LineComment(this.position(node), this.content(node));
  }

  public content(node: { from: number; to: number } | undefined | null) {
    if (!node) {
      return "";
    }
    return this.doc.sliceString(node.from, node.to);
  }
}

export function parseDocument(content: string, options?: ParserOptions) {
  return new BeanCountDocument(content, options);
}
