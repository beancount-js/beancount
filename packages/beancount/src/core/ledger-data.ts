import { loadString, type Directives, type LoadProps } from "../parser/loader";
import { filterTransactions, type LedgerError } from "../core/data";

export interface LedgerData {
  readonly directives: Directives;
  filter(predicate: (directive: Directives[number]) => boolean): LedgerData;
}

export class SimpleLedgerData implements LedgerData {
  constructor(readonly directives: Directives) {}

  filter(predicate: (directive: Directives[number]) => boolean): LedgerData {
    return new SimpleLedgerData(this.directives.filter(predicate));
  }
}

export class LedgerSource {
  readonly directives: Directives;
  readonly errors: Array<LedgerError>;
  readonly data: LedgerData;

  constructor(contents: string, props: Partial<LoadProps> = {}) {
    const [directives, errors] = loadString(contents, props);
    this.directives = directives;
    this.errors = errors;
    this.data = new SimpleLedgerData(directives);
  }

  get transactions() {
    return filterTransactions(this.directives);
  }

  toString() {
    return this.directives.map((d) => d.toString()).join("\n");
  }
}
