import { Booking, FLAG_MERGING, Posting, Transaction } from "../core/data";
import { ValidationError } from "../ops/validation";

import { Cost, CostSpec, type Position } from "../core/position";
import { Amount } from "../core/amount";

function bookingMethodStrictWithSize(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
): [Array<Posting>, Array<Position>, Array<ValidationError>, boolean] {
  let [bookedReductions, bookedMatches, errors, insufficient] =
    bookingMethodStrict(entry, posting, matches);
  // If we couldn't match strictly, attempt to find a match with the same
  // number of units. If there is one or more of these, accept the oldest lot.
  if (errors.length && matches.length > 1) {
    const number = posting.units?.neg();
    if (number) {
      const matchingUnits = matches
        .filter((it) => it.units.eq(number))
        .sort((a, b) => {
          let vala = a.cost?.date?.toMillis() ?? 0;
          let valb = b.cost?.date?.toMillis() ?? 0;
          return vala - valb;
        });
      if (matchingUnits.length) {
        const match = matchingUnits[0];
        bookedReductions.push(
          posting.copy({
            units: match.units.neg(),
            cost: match.cost,
          }),
        );
        bookedMatches.push(match);
        errors = [];
        insufficient = false;
      }
    }
  }
  return [bookedReductions, bookedMatches, errors, insufficient];
}

function bookingMethodFIFO(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
): [Array<Posting>, Array<Position>, Array<ValidationError>, boolean] {
  return bookingMethodxIFO(
    entry,
    posting,
    [...matches].sort((a, b) => {
      let vala = a.cost?.date?.toMillis() ?? 0;
      let valb = b.cost?.date?.toMillis() ?? 0;
      return vala - valb;
    }),
  );
}

function bookingMethodLIFO(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
): [Array<Posting>, Array<Position>, Array<ValidationError>, boolean] {
  return bookingMethodxIFO(
    entry,
    posting,
    [...matches].sort((a, b) => {
      let vala = a.cost?.date?.toMillis() ?? 0;
      let valb = b.cost?.date?.toMillis() ?? 0;
      return valb - vala;
    }),
  );
}

function bookingMethodHIFO(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
): [Array<Posting>, Array<Position>, Array<ValidationError>, boolean] {
  return bookingMethodxIFO(
    entry,
    posting,
    [...matches].sort(
      (a, b) => (b.cost?.amount?.number || 0) - (a.cost?.amount?.number || 0),
    ),
  );
}

function bookingMethodxIFO(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
): [Array<Posting>, Array<Position>, Array<ValidationError>, boolean] {
  const errors: Array<ValidationError> = [];
  const bookedReductions: Array<Posting> = [];
  const bookedMatches: Array<Position> = [];

  let insufficient: boolean = false;
  const units = posting.units!;
  const sign = units.lt(0) ? -1 : 1;
  let remaining = units.abs();
  for (const match of matches) {
    if (remaining.lte(0)) {
      break;
    }

    // If the inventory somehow ended up with mixed lots, skip this one.
    if (match.units.mul(sign).gt(0)) {
      continue;
    }

    const available = match.units.abs();
    const size = remaining.lt(available) ? remaining : available;
    bookedReductions.push(
      posting.copy({
        units: size.mul(sign).copy({ currency: match.units.currency }),
        cost: match.cost,
      }),
    );
    bookedMatches.push(match);
    remaining = remaining.minus(size);
  }

  // If we couldn't eat up all the requested reduction, return an error.
  insufficient = remaining.gt(0);
  return [bookedReductions, bookedMatches, errors, insufficient];
}

function bookingMethodNone(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
): [Array<Posting>, Array<Position>, Array<ValidationError>, boolean] {
  return [[posting], [], [], false];
}

function bookingMethodAverage(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
): [Array<Posting>, Array<Position>, Array<ValidationError>, boolean] {
  if (!posting.units || matches.length === 0) return [[], [], [], true];

  const hasExplicitCost =
    posting.cost instanceof CostSpec &&
    (posting.cost.numberPer !== null || posting.cost.numberTotal !== null);
  if (matches.length === 1 && !hasExplicitCost) {
    return bookingMethodStrict(entry, posting, matches);
  }

  const unitCurrency = matches[0].units.currency;
  const costCurrency = matches[0].cost?.amount?.currency;
  if (
    !unitCurrency ||
    !costCurrency ||
    matches.some(
      (match) =>
        match.units.currency !== unitCurrency ||
        match.cost?.amount?.currency !== costCurrency,
    )
  ) {
    return [
      [],
      [],
      [
        new ValidationError("Cannot merge positions in multiple currencies", {
          directive: entry,
          errorType: "AmbiguousMatchError",
        }),
      ],
      false,
    ];
  }
  if (hasExplicitCost) {
    return [
      [],
      [],
      [
        new ValidationError("Explicit cost reductions are not supported", {
          directive: entry,
          errorType: "AmbiguousMatchError",
        }),
      ],
      false,
    ];
  }

  const units = matches.reduce(
    (total, match) => total.plus(match.units),
    new Amount(0, unitCurrency),
  );
  const totalCost = matches.reduce(
    (total, match) =>
      total.plus(match.cost!.amount!.value.mul(match.units.value)),
    new Amount(0, costCurrency).value,
  );
  const cost = new Cost(
    matches[0].cost?.date ?? null,
    new Amount(totalCost.div(units.value), costCurrency),
  );
  return [
    [
      ...matches.map((match) =>
        posting.copy({
          units: match.units.neg(),
          cost: match.cost,
          flag: FLAG_MERGING,
        }),
      ),
      posting.copy({
        units,
        cost,
        flag: FLAG_MERGING,
      }),
      posting.copy({ cost }),
    ],
    matches,
    [],
    units.abs().lt(posting.units.abs()),
  ];
}

function bookingMethodStrict(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
): [Array<Posting>, Array<Position>, Array<ValidationError>, boolean] {
  const errors: Array<ValidationError> = [];
  const bookedReductions: Array<Posting> = [];
  const bookedMatches: Array<Position> = [];

  let insufficient: boolean = false;
  // In strict mode, we require at most a single matching posting.
  if (matches.length > 1) {
    const sumMatches = matches.reduce(
      (acc, cur) => {
        return acc.plus(cur.units);
      },
      new Amount(0, matches[0].units.currency),
    );
    if (sumMatches.eq(posting.units?.neg())) {
      matches.forEach((match) => {
        bookedReductions.push(
          posting.copy({ units: match.units.neg(), cost: match.cost }),
        );
      });
    } else {
      errors.push(
        new ValidationError(
          `Ambiguous matches for "${posting.toString()}": ${matches.toString()}`,
          { directive: entry, errorType: "AmbiguousMatchError" },
        ),
      );
    }
  } else if (matches.length == 1) {
    const match = matches[0];
    const postingUnits = posting.units;
    if (postingUnits) {
      let number: Amount = match.units.abs().lt(postingUnits.abs())
        ? match.units.abs()
        : postingUnits.abs();
      const matchUnits = number.neg().copy({ currency: match.units.currency });
      bookedReductions.push(
        posting.copy({ units: matchUnits, cost: match.cost }),
      );
      bookedMatches.push(match);
      insufficient = !matchUnits.eq(postingUnits);
    } else {
      errors.push(
        new ValidationError(
          `Missing units for posting: "${posting.units}": ${matches.toString()}`,
          { directive: entry, errorType: "AmbiguousMatchError" },
        ),
      );
    }
  }
  return [bookedReductions, bookedMatches, errors, insufficient];
}

function resolveBookings(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
  booking: Booking = Booking.STRICT,
): [Array<Posting>, Array<Position>, Array<ValidationError>, boolean] {
  if (booking === Booking.STRICT) {
    return bookingMethodStrict(entry, posting, matches);
  } else if (booking === Booking.NONE) {
    return bookingMethodNone(entry, posting, matches);
  } else if (booking === Booking.FIFO) {
    return bookingMethodFIFO(entry, posting, matches);
  } else if (booking === Booking.LIFO) {
    return bookingMethodLIFO(entry, posting, matches);
  } else if (booking === Booking.HIFO) {
    return bookingMethodHIFO(entry, posting, matches);
  } else if (booking === Booking.STRICT_WITH_SIZE) {
    return bookingMethodStrictWithSize(entry, posting, matches);
  } else if (booking === Booking.AVERAGE) {
    return bookingMethodAverage(entry, posting, matches);
  }
  return bookingMethodStrict(entry, posting, matches);
}

export function handleAmbiguousMatches(
  entry: Transaction,
  posting: Posting,
  matches: Array<Position>,
  booking: Booking = Booking.STRICT,
): [Array<Posting>, Array<Position>, Array<ValidationError>] {
  const [bookedReductions, bookedMatches, errors, insufficient] =
    resolveBookings(entry, posting, matches, booking);
  if (insufficient) {
    errors.push(
      new ValidationError(
        `Not enough lots to reduce "${posting.units}": ${matches}`,
        { directive: entry, errorType: `AmbiguousMatchError` },
      ),
    );
  }

  return [bookedReductions, bookedMatches, errors];
}
