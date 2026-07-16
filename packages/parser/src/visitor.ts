import {
  BalanceDirective,
  CloseDirective,
  CommodityDirective,
  CustomDirective,
  DocumentDirective,
  EventDirective,
  IncludeDirective,
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
  TransactionDirective,
} from "./directives";
import type { Directive } from "./models";

export interface DocumentVisitor<T> {
  visit: (directive: Directive) => T;
}

export abstract class AbstractVisitor<T> implements DocumentVisitor<T> {
  abstract visitOpen: (directive: OpenDirective) => T;
  abstract visitClose: (directive: CloseDirective) => T;
  abstract visitCommodity: (directive: CommodityDirective) => T;
  abstract visitPrice: (directive: PriceDirective) => T;
  abstract visitCustom: (directive: CustomDirective) => T;
  abstract visitPlugin: (directive: PluginDirective) => T;
  abstract visitOption: (directive: OptionDirective) => T;
  abstract visitInclude: (directive: IncludeDirective) => T;
  abstract visitPopTag: (directive: PopTagDirective) => T;
  abstract visitPushTag: (directive: PushTagDirective) => T;
  abstract visitDocument: (directive: DocumentDirective) => T;
  abstract visitTransaction: (directive: TransactionDirective) => T;
  abstract visitQuery: (directive: QueryDirective) => T;
  abstract visitNote: (directive: NoteDirective) => T;
  abstract visitPad: (directive: PadDirective) => T;
  abstract visitBalance: (directive: BalanceDirective) => T;
  abstract visitEvent: (directive: EventDirective) => T;

  visit(directive: Directive): T {
    if (directive instanceof OpenDirective) {
      return this.visitOpen(directive);
    } else if (directive instanceof CloseDirective) {
      return this.visitClose(directive);
    } else if (directive instanceof CommodityDirective) {
      return this.visitCommodity(directive);
    } else if (directive instanceof PriceDirective) {
      return this.visitPrice(directive);
    } else if (directive instanceof CustomDirective) {
      return this.visitCustom(directive);
    } else if (directive instanceof PluginDirective) {
      return this.visitPlugin(directive);
    } else if (directive instanceof OptionDirective) {
      return this.visitOption(directive);
    } else if (directive instanceof IncludeDirective) {
      return this.visitInclude(directive);
    } else if (directive instanceof PushTagDirective) {
      return this.visitPushTag(directive);
    } else if (directive instanceof PopTagDirective) {
      return this.visitPopTag(directive);
    } else if (directive instanceof DocumentDirective) {
      return this.visitDocument(directive);
    } else if (directive instanceof TransactionDirective) {
      return this.visitTransaction(directive);
    } else if (directive instanceof Posting) {
      return this.visitPosting(directive);
    } else if (directive instanceof QueryDirective) {
      return this.visitQuery(directive);
    } else if (directive instanceof NoteDirective) {
      return this.visitNote(directive);
    } else if (directive instanceof PadDirective) {
      return this.visitPad(directive);
    } else if (directive instanceof BalanceDirective) {
      return this.visitBalance(directive);
    } else if (directive instanceof EventDirective) {
      return this.visitEvent(directive);
    }
    throw new Error(`Unsupported directive: ${directive.constructor.name}`);
  }

  abstract visitPosting: (directive: Posting) => T;
}
