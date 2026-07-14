import { Decimal } from "@beancount-js/parser";
import type { BeancountOptions } from "../core";
import { Amount } from "../core/amount";
import {
  Booking,
  Open,
  Posting,
  Transaction,
  type Currency,
  type Directives,
} from "../core/data";
import {
  AUTOMATIC_META,
  AUTOMATIC_TOLERANCES,
  computeResidual,
  inferTolerances,
  quantizeWithTolerance,
} from "../core/interpolate";
import { Inventory } from "../core/inventory";
import { Cost, CostSpec, Position } from "../core/position";
import { ValidationError } from "../ops/validation";
import { handleAmbiguousMatches } from "./booking_method";

export function book(
  entries: Directives,
  options: BeancountOptions,
  balances: Record<string, Inventory> = {},
): [Directives, Array<ValidationError>, Record<string, Inventory>] {
  const bookingMethods: Record<string, Booking> = {};
  entries.forEach((entry) => {
    if (entry instanceof Open) {
      bookingMethods[entry.account] = entry.booking;
    }
  });

  const errors: Array<ValidationError> = [];
  const newEntries: Directives = [];

  entries.forEach((entry) => {
    if (entry instanceof Transaction) {
      let tx: Transaction = entry;
      const [referGroups, catErrors] = groupByCurrency(tx, balances);
      if (catErrors.length) {
        errors.push(...catErrors);
        return;
      }

      const postingGroups = replaceCurrencies(tx.postings, referGroups);
      // Get the list of tolerances.
      const tolerances = inferTolerances(tx.postings, options);
      const replacedPostings: Array<Posting> = [];
      for (const [currency, groupPostings] of Object.entries(postingGroups)) {
        const [bookedPostings, bookingErrors] = bookReductions(
          tx,
          groupPostings,
          balances,
          bookingMethods,
        );
        // If there were any errors, skip this group of postings.
        if (bookingErrors.length) {
          errors.push(...bookingErrors);
        }
        // Interpolate missing numbers from all postings. This
        // includes partially incomplete CostSpec instances remaining
        // on augmenting postings. After this interpolation, all
        // 'inter_postings' consists entirely of postings holding
        // instances of Cost.
        const [interGroups, interErrors, interpolated] = interpolateGroup(
          bookedPostings,
          balances,
          currency,
          tolerances,
        );

        if (interErrors.length) {
          errors.push(...interErrors);
        }

        replacedPostings.push(...interGroups);
        const meta = { ...tx.meta };
        meta[AUTOMATIC_TOLERANCES] = tolerances;
        tx = tx.copy({ postings: replacedPostings, meta });

        replacedPostings.forEach((posting) => {
          balances[posting.account] ||= new Inventory();
          balances[posting.account].addAmount(
            posting.units,
            posting.cost as Cost | null,
          );
        });
        entry = tx;
      }
    }
    newEntries.push(entry);
  });

  return [newEntries, errors, balances];
}

enum MissingTypes {
  UNITS = 1,
  COST_PER = 2,
  COST_TOTAL = 3,
  PRICE = 4,
}

function interpolateGroup(
  postings: Array<Posting>,
  balances: Record<string, Inventory>,
  currency: string,
  tolerances: Record<string, Decimal>,
): [Array<Posting>, Array<ValidationError>, boolean] {
  const errors: Array<ValidationError> = [];
  const incomplete: Array<{ type: MissingTypes; index: number }> = [];
  postings.forEach((posting, index) => {
    let { units, cost, price } = posting;
    // Identify incomplete parts of the Posting components.
    if (!units?.isDefined()) {
      incomplete.push({ type: MissingTypes.UNITS, index });
    }

    if (cost instanceof CostSpec) {
      if (!cost.numberPer) {
        incomplete.push({ type: MissingTypes.COST_PER, index });
      }
      if (!cost.numberTotal) {
        incomplete.push({ type: MissingTypes.COST_TOTAL, index });
      }
    } else if (cost instanceof Cost) {
      if (!cost.amount?.value) {
        errors.push(
          new ValidationError(
            `cost has no number: ${cost}; on postings: ${postings}`,
            { directive: posting, errorType: "InternalError" },
          ),
        );
        return;
      }
    } else if (price && !price.value) {
      incomplete.push({ type: MissingTypes.PRICE, index });
    }
  });

  // The replacement posting for the incomplete posting of this group.
  let newPosting: Posting | null = null;
  let outPostings: Array<Posting> = [];
  if (incomplete.length === 0) {
    outPostings = postings.map(convertCostSpecToCost);
  } else if (incomplete.length > 1) {
    errors.push(
      new ValidationError(
        `Too many missing numbers for currency group '${currency}'` +
          JSON.stringify(incomplete),
        {
          directive: postings[incomplete[0].index],
          errorType: "InterpolationError",
        },
      ),
    );
  } else {
    // If there is a single missing number, calculate it and fill it in here.
    const { type, index } = incomplete[0];
    const incompletePosting = postings[index];
    // Convert augmenting postings' costs from CostSpec to corresponding Cost
    // instances, except for the incomplete posting.
    let newPostings = postings.map((it) => {
      return it === incompletePosting
        ? incompletePosting
        : convertCostSpecToCost(it);
    });
    // Compute the balance of the other postings.
    const residual = computeResidual(
      postings.filter((it) => it !== incompletePosting),
    );
    let weight: Amount = new Amount(0, currency);
    if (!residual.empty) {
      const respos = residual.positions[0];
      if (respos.cost !== null) {
        errors.push(
          new ValidationError(
            "Internal error; cost appears in weight calculation.",
            { directive: incompletePosting },
          ),
        );
      }
      if (respos.units.currency !== currency) {
        if (respos.cost !== null) {
          errors.push(
            new ValidationError(
              `Internal error; residual different than currency group. ${respos.units.currency} != ${currency}`,
              { directive: incompletePosting },
            ),
          );
        }
      }
      weight = respos.units.neg();
    }

    if (type === MissingTypes.UNITS) {
      const cost = incompletePosting.cost;
      const price = incompletePosting.price;
      const units = incompletePosting.units;
      let costTotal: Decimal;
      let unitsNumber!: Amount;
      if (cost) {
        if (cost instanceof CostSpec) {
          if (cost.numberPer === Decimal.ZERO) {
            errors.push(
              new ValidationError(
                `Cannot infer per-unit cost only from total`,
                {
                  directive: incompletePosting,
                  errorType: "InterpolationError",
                },
              ),
            );
          }
          costTotal = cost.numberTotal ?? Decimal.ZERO;
          unitsNumber = weight.minus(costTotal).div(cost.numberPer!);
        }
      } else if (price) {
        if (price.currency !== weight.currency) {
          errors.push(
            new ValidationError(
              `Internal error; residual price currency different than missing currency. ${price.currency} != ${weight.currency}`,
              { directive: incompletePosting },
            ),
          );
        }
        unitsNumber = weight.div(price);
      } else {
        if (units?.currency && units.currency !== weight.currency) {
          errors.push(
            new ValidationError(
              `Internal error; residual units currency different than missing currency. ${units?.currency} != ${weight.currency}`,
              { directive: incompletePosting },
            ),
          );
        }
        unitsNumber = weight;
      }
      // Quantize the interpolated units if necessary.
      unitsNumber = quantizeWithTolerance(tolerances, unitsNumber);

      if (!weight.zero) {
        const pos = cost
          ? new Position(
              unitsNumber,
              new Cost(cost.date, computeCost(cost, unitsNumber), cost.label),
            )
          : new Position(unitsNumber);

        newPosting = incompletePosting.copy({
          units: pos.units,
          cost: pos.cost,
        });
      } else {
        newPosting = null;
      }
    }

    if (newPosting) {
      newPosting.meta[AUTOMATIC_META] = true;
      newPostings[index] = convertCostSpecToCost(newPosting);
    } else {
      newPostings = newPostings.slice(index, 1);
    }
    outPostings = newPostings;
  }

  outPostings.forEach((posting) => {
    const cost = posting.cost;
    if (cost) {
      if (cost instanceof CostSpec) {
        throw new Error("Invalid costspec after interpolation");
      }
    } else {
      return;
    }

    // If there is a cost, we don't allow either a cost value of zero,
    // nor a zero number of units. Note that we allow a price of zero as
    // the only special case allowed (for conversion entries), but never
    // for costs.
    if (posting.units?.zero) {
      errors.push(
        new ValidationError(`Amount is zero: "${posting.units}`, {
          directive: posting,
          errorType: "",
        }),
      );
    }

    const costAmount = cost.amount;
    if (costAmount && costAmount.lt(0)) {
      errors.push(
        new ValidationError(`Cost is negative: "${cost}"`, {
          directive: posting,
          errorType: "",
        }),
      );
    }
  });

  return [outPostings, errors, newPosting !== null];
}

function convertCostSpecToCost(posting: Posting) {
  const cost = posting.cost;

  if (cost instanceof CostSpec) {
    const amount = computeCost(cost, posting.units);
    posting = posting.copy({ cost: new Cost(cost.date, amount, cost.label) });
  }
  return posting;
}

interface Refer {
  index: number;
  unitsCurrency?: Currency | null;
  priceCurrency?: Currency | null;
  costCurrency?: Currency | null;
}

function replaceCurrencies(
  postings: ReadonlyArray<Posting>,
  referGroups: Record<string, Array<Refer>>,
) {
  const newGroups: Record<string, Array<Posting>> = {};
  for (const [currency, refers] of Object.entries(referGroups)) {
    const newPostings: Array<Posting> = [];
    refers
      .sort((a, b) => a.index - b.index)
      .forEach((refer) => {
        let posting = postings[refer.index];
        let units = posting.units;
        if (!units) {
          posting = posting.copy({
            units: new Amount(null, refer.unitsCurrency),
          });
        } else {
          let replace = false;
          let cost = posting.cost;
          let price = posting.price;
          if (units.currency) {
            units = units.copy({ currency: refer.unitsCurrency });
            replace = true;
          }

          if (cost && !cost.currency) {
            cost = cost.copy({ currency: refer.costCurrency });
            replace = true;
          }

          if (price && !price.currency) {
            price = price.copy({ currency: refer.costCurrency });
            replace = true;
          }

          if (replace) {
            posting = posting.copy({ units, cost, price });
          }
        }
        newPostings.push(posting);
      });
    newGroups[currency] = newPostings;
  }
  return newGroups;
}

function getBucketCurrency(refer: Refer) {
  const { unitsCurrency, priceCurrency, costCurrency } = refer;
  return (
    [costCurrency, priceCurrency, unitsCurrency].find((it) => it)?.toString() ||
    ""
  );
}

function groupByCurrency(
  transaction: Transaction,
  balances: Record<string, Inventory>,
): [Record<string, Array<Refer>>, Array<ValidationError>] {
  const errors: Array<ValidationError> = [];
  const groups: Record<string, Array<Refer>> = {};
  const autoPostings: Array<Refer> = [];
  const unknown: Array<Refer> = [];
  const sortDict: Record<string, number> = {};

  transaction.postings.forEach((posting, index) => {
    let { units, cost, price } = posting;

    let unitsCurrency = units?.currency;
    let priceCurrency = price?.currency;
    let costCurrency = cost?.currency;

    if (!costCurrency && priceCurrency) {
      costCurrency = priceCurrency;
    }

    if (!priceCurrency && costCurrency) {
      priceCurrency = costCurrency;
    }

    // First we apply the constraint that cost-currency and price-currency
    // must match, if there is both a cost and a price. This reduces the
    // space of possibilities somewhat.
    // const unitsCurrency =  punits?.currency;
    // const priceCurrency = pprice?.currency || pprice?.currency;
    // const costCurrency = pcost?.currency || pcost?.currency;

    const refer: Refer = {
      index,
      unitsCurrency,
      priceCurrency,
      costCurrency,
    };
    const currency = getBucketCurrency(refer);
    if (!units && priceCurrency === null) {
      // Bucket auto-postings separately from unknown.
      autoPostings.push(refer);
    } else if (currency) {
      // Bucket with what we know so far.
      sortDict[currency] = index;
      groups[currency] ||= [];
      groups[currency].push(refer);
    } else {
      // If we need to infer the currency, store in unknown.
      unknown.push(refer);
    }
  });

  // We look at the remaining postings... if they are all of a single currency,
  // the posting must be in that currency too.
  const groupKeys = Object.keys(groups);
  if (unknown.length == 1 && groupKeys.length == 1) {
    let { index, unitsCurrency, costCurrency, priceCurrency } = unknown.pop()!;
    const otherCurrency = groupKeys[0];

    if (priceCurrency === null && costCurrency === null) {
      unitsCurrency = otherCurrency;
    } else {
      if (!priceCurrency) {
        priceCurrency = otherCurrency;
      }
      if (!costCurrency) {
        costCurrency = otherCurrency;
      }
    }
    const refer: Refer = {
      index,
      unitsCurrency,
      priceCurrency,
      costCurrency,
    };
    const currency = getBucketCurrency(refer);
    if (currency) {
      sortDict[currency] = index;
      groups[currency] ||= [];
      groups[currency].push(refer);
    } else {
      errors.push(
        new ValidationError(`Failed to categorize posting ${index}`, {
          directive: transaction,
        }),
      );
    }
  }

  unknown.forEach((refer) => {
    let { index, unitsCurrency, costCurrency, priceCurrency } = refer;
    const posting = transaction.postings[index];
    const balance = balances[posting.account] || new Inventory();
    if (!unitsCurrency) {
      const balanceCurrencies = balance.currencies;
      if (balanceCurrencies.length == 1) {
        unitsCurrency = balanceCurrencies[0];
      }
    }

    if (!costCurrency || !priceCurrency) {
      const balanceCostCurrencies = balance.costCurrencies;
      if (balanceCostCurrencies.length == 1) {
        costCurrency ||= balanceCostCurrencies[0];
        priceCurrency ||= balanceCostCurrencies[0];
      }
    }

    refer = {
      index,
      unitsCurrency,
      priceCurrency,
      costCurrency,
    };
    const currency = getBucketCurrency(refer);
    if (currency) {
      sortDict[currency] = index;
      groups[currency] ||= [];
      groups[currency].push(refer);
    } else {
      errors.push(
        new ValidationError(`Failed to categorize posting ${index}`, {
          directive: transaction,
        }),
      );
    }
  });

  // Fill in missing units currencies if some remain as missing. This may occur
  // if we used the cost or price to bucket the currency but the units currency
  // was missing.
  for (const [_, refers] of Object.entries(groups)) {
    refers.forEach((refer, index) => {
      if (!refer.unitsCurrency) {
        const posting = transaction.postings[refer.index];
        const balance = balances[posting.account];
        if (!balance) {
          return;
        }
        const balanceCurrencies = balance.currencies;
        if (balanceCurrencies.length == 1) {
          refers[index].unitsCurrency = balanceCurrencies[0];
        }
      }
    });
  }

  // Deal with auto-postings.
  if (autoPostings.length > 1) {
    const refer = autoPostings[autoPostings.length - 1];
    const posting = transaction.postings[refer.index];
    errors.push(
      new ValidationError(
        "You may not have more than one auto-posting per currency",
        { directive: posting },
      ),
    );
  }

  if (autoPostings.length > 0) {
    const refer = autoPostings[0];
    for (const [currency, items] of Object.entries(groups)) {
      sortDict[currency] = refer.index;
      items.push({ index: refer.index, unitsCurrency: currency });
    }
  }

  for (const [_, items] of Object.entries(groups)) {
    items.forEach((refer) => {
      const posting = transaction.postings[refer.index];
      if (refer.unitsCurrency === null) {
        errors.push(
          new ValidationError("Could not resolve units currency", {
            directive: posting,
          }),
        );
      }
      if (refer.costCurrency === null) {
        errors.push(
          new ValidationError("Could not resolve cost currency", {
            directive: posting,
          }),
        );
      }
      if (refer.priceCurrency === null) {
        errors.push(
          new ValidationError("Could not resolve price currency", {
            directive: posting,
          }),
        );
      }
    });
  }

  const sortedGroups: Record<string, Array<Refer>> = {};
  Object.keys(groups)
    .sort((a, b) => sortDict[a] - sortDict[b])
    .forEach((k) => {
      sortedGroups[k] = groups[k];
    });
  return [sortedGroups, errors];
}

function bookReductions(
  entry: Transaction,
  groupPostings: Array<Posting>,
  balances: Record<string, Inventory>,
  bookingMethods: Record<string, Booking>,
): [Array<Posting>, Array<ValidationError>] {
  const errors: Array<ValidationError> = [];
  const empty = new Inventory();
  const localBalances: Record<string, Inventory> = {};
  const bookedPostings: Array<Posting> = [];
  groupPostings.forEach((posting) => {
    let { units, cost, account } = posting;
    if (!localBalances[account]) {
      const previousBalance = balances[account] || empty;
      localBalances[account] = previousBalance.copy();
    }
    const balance = localBalances[account];

    if (cost === null || units === null) {
      bookedPostings.push(posting);
    } else {
      const method = bookingMethods[account];
      if (method != Booking.NONE && balance && balance.isReducedBy(units)) {
        const costNumber = computeCost(cost, units);
        const matches: Array<Position> = [];
        balance.positions.forEach((position) => {
          if (
            units.currency &&
            position.units.currency?.toString() !== units.currency.toString()
          ) {
            return;
          }

          if (position.cost === null) {
            return;
          }

          if (
            costNumber &&
            position.cost?.amount?.toString() !== costNumber.toString()
          ) {
            return;
          }

          if (
            cost.currency &&
            cost.currency?.toString() !== position.cost?.currency?.toString()
          ) {
            return;
          }

          if (
            cost.date &&
            cost.date.toString() !== position.cost?.date?.toString()
          ) {
            return;
          }

          if (cost.label && cost.label !== position.cost?.label) {
            return;
          }

          matches.push(position);
        });

        if (matches.length == 0) {
          errors.push(
            new ValidationError(
              `No position matches "${posting}" against balance ${balance}`,
              { directive: entry },
            ),
          );
          return [[], errors];
        }

        const [reductionPostings, matchedPostings, matchErrors] =
          handleAmbiguousMatches(entry, posting, matches, method);
        if (matchErrors.length) {
          return [[], matchErrors];
        }

        // Add the reductions to the resulting list of booked postings.
        bookedPostings.push(...reductionPostings);
        // Update the local balance in order to avoid matching against
        // the same postings twice when processing multiple postings in
        // the same transaction. Note that we only do this for postings
        // held at cost because the other postings may need interpolation
        // in order to be resolved properly.
        reductionPostings.forEach((it) => balance.addAmount(it.units));
      } else {
        // This posting is an augmentation.
        //
        // Note that we do not convert the CostSpec instances to Cost
        // instances, because we want to let the subsequent interpolation
        // process able to interpolate either the cost per-unit or the
        // total cost, separately.
        //
        // Put in the date of the parent Transaction if there is no
        // explicit date specified on the spec.
        if (!cost.date) {
          posting = posting.copy({ cost: cost.copy({ date: entry.date }) });
        }
        bookedPostings.push(posting);
      }
    }
  });
  return [bookedPostings, errors];
}

function computeCost(cost: Cost | CostSpec | null, units: Amount | null) {
  if (cost instanceof Cost) {
    return cost.amount;
  }

  if (!(cost instanceof CostSpec)) {
    return null;
  }

  if (!(units instanceof Amount)) {
    return null;
  }

  if (!cost.numberPer || !cost.numberTotal) {
    return null;
  }

  let currency = cost.currency || units.currency;

  if (cost.numberTotal !== null) {
    let costTotal = new Amount(cost.numberTotal);
    if (cost.numberPer) {
      costTotal = costTotal.add(units.abs().mul(cost.numberPer));
    }
    return costTotal.div(units.abs()).copy({ currency: currency });
  } else {
    return new Amount(cost.numberPer, currency);
  }
}
