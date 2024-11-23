import { parseQuery, type Filter } from "@beancount-js/filters";

export class FilterState {
  query: string = $state("");
  bqlQuery: string = $state("");

  private predicate: {
    filter?: Filter;
    errors: Array<string>;
  } = $derived.by(() => {
    if (this.query) {
      const [filter, errors] = parseQuery(this.query);
      return { filter, errors };
    }
    return { errors: [] };
  });

  get errors(): Array<string> {
    return this.predicate.errors;
  }

  get filter(): Filter | undefined {
    return this.predicate.filter;
  }
}
