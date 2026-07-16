import { Amount } from "../core/amount";
import { Posting, Transaction, type Directives } from "../core/data";

type PostingAccumulator = {
  template: Posting;
  units: Amount;
};

function postingKey(posting: Posting): string {
  return [
    posting.account,
    posting.units?.currency ?? "",
    posting.cost?.toString(true) ?? "",
    posting.price?.toString() ?? "",
    posting.flag,
  ].join("\u0000");
}

/**
 * Merge transactions into a single transaction using the supplied transaction
 * as its non-posting prototype. Posting metadata and transaction tags/links
 * are deliberately omitted, matching upstream's import-oriented compression.
 */
export function merge(
  entries: readonly Transaction[],
  prototype: Transaction,
): Transaction {
  const postings = new Map<string, PostingAccumulator>();
  for (const entry of entries) {
    for (const posting of entry.postings) {
      if (!posting.units) continue;
      const key = postingKey(posting);
      const existing = postings.get(key);
      if (existing) {
        existing.units = existing.units.add(posting.units);
      } else {
        postings.set(key, {
          template: new Posting(
            posting.account,
            new Amount(null, posting.units.currency),
            posting.cost,
            posting.price,
            posting.flag,
          ),
          units: new Amount(posting.units),
        });
      }
    }
  }

  const mergedPostings = [...postings.values()]
    .sort((left, right) => {
      const byAccount = left.template.account.localeCompare(
        right.template.account,
      );
      if (byAccount !== 0) return byAccount;
      const byCurrency = (left.template.units?.currency ?? "").localeCompare(
        right.template.units?.currency ?? "",
      );
      return byCurrency !== 0
        ? byCurrency
        : left.units.units.lt(right.units.units)
          ? -1
          : left.units.units.gt(right.units.units)
            ? 1
            : 0;
    })
    .map(
      ({ template, units }) =>
        new Posting(
          template.account,
          units,
          template.cost,
          template.price,
          template.flag,
          template.meta,
        ),
    );

  return new Transaction(
    prototype.date,
    prototype.flag,
    prototype.payee,
    prototype.narration,
    [],
    [],
    mergedPostings,
    prototype.meta,
  );
}

/**
 * Compress consecutive matching transactions. A group receives the date and
 * transaction fields of its final member, as in upstream `ops.compress`.
 */
export function compress(
  entries: Directives,
  predicate: (entry: Transaction) => boolean,
): Directives {
  const response: Directives = [];
  let pending: Transaction[] = [];

  const flush = () => {
    if (pending.length > 0) {
      response.push(merge(pending, pending[pending.length - 1]));
      pending = [];
    }
  };

  for (const entry of entries) {
    if (entry instanceof Transaction && predicate(entry)) {
      pending.push(entry);
    } else {
      flush();
      response.push(entry);
    }
  }
  flush();
  return response;
}
