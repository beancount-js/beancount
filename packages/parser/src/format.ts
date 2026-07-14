// A typescript of https://github.com/beancount/beancount/blob/master/beancount/scripts/format.py

export interface FormatOptions {
  prefixWidth?: number;
  numWidth?: number;
  currencyColumn?: number;
  fixedCJKWidth?: boolean;
}

interface MatchPair {
  prefix: string;
  number?: string;
  rest?: string;
}

interface FilteredPair {
  prefix: string;
  number: string;
}

const ACCOUNT_RE =
  /^([ \t]+)((?:[\p{Lu}][\p{L}\p{Nd}-]*)(?::[\p{Lu}\p{Nd}][\p{L}\p{Nd}-]*))$/gu;
const CURRENCY_RE =
  /^(\d[^";]*?|\s+(?:[\p{Lu}][\p{L}\p{Nd}-]*)(?::[\p{Lu}][\p{L}\p{Nd}-]*)+)\s+(\([-+]?\s*[\d,]+(?:\.\d*)?\s*[-+*/]\s*[-+]?\s*[\d,]+(?:\.\d*)?\)|[-+]?\s*[\d,]+(?:\.\d*)?)\s+([A-Z][A-Z0-9'._-]{0,22}[A-Z0-9]\b.*)$/gu;

const WIDE_CHARS = [
  // Classifications: W - Wide
  "\u1100-\u11F9",
  "\u3000-\u303F",
  "\u3041-\u3094",
  "\u3099-\u309E",
  "\u30A1-\u30FE",
  "\u3131-\u318E",
  "\u3190-\u319F",
  "\u3200-\u321C",
  "\u3220-\u3243",
  "\u3260-\u32B0",
  "\u32C0-\u3376",
  "\u337B-\u33DD",
  "\u33E0-\u33FE",
  "\u4E00-\u9FA5",
  "\uAC00-\uD7A3",
  "\uE000-\uE757",
  "\uF900-\uFA2D",
  // Classifications: F - FullWidth
  "\uFE30-\uFE44",
  "\uFE49-\uFE52",
  "\uFE54-\uFE6B",
  "\uFF01-\uFF5E",
  "\uFFE0-\uFFE6",
];

/**
 * Compute the frequencies of the given elements and return the most frequent.
 *
 * @param iterable A collection of hashable elements.
 * @returns The most frequent element. If there are no elements in the iterable,
 *   return None.
 */
function computeMostFrequent(iterable: Array<number>): number {
  const frequencies = iterable.reduce<Map<string, number>>((prev, current) => {
    const key = current.toString();
    const count = prev.get(key);
    prev.set(key, count ? count + 1 : 1);
    return prev;
  }, new Map<string, number>());

  let max = 0;
  let frequent = "";
  frequencies.forEach((v, k) => {
    if (v > max) {
      max = v;
      frequent = k;
    }
  });
  return parseInt(frequent);
}

/**
 * Normalize whitespace before lines that has some indent and an account name.
 *
 * @param match_pairs A list of (prefix, number, rest) tuples.
 * @returns Another list of (prefix, number, rest) tuples, where prefix may have
 *   been adjusted with a different whitespace prefix.
 */
function normalizeIndentWhitespace(
  matchPairs: Array<MatchPair>,
): Array<MatchPair> {
  const widthArr = Array<number>();
  for (const matchPair of matchPairs) {
    const prefix = matchPair.prefix;
    if (prefix) {
      const m = prefix.matchAll(ACCOUNT_RE);
      const match = [...m];
      if (match.length > 0) {
        widthArr.push(match[0][1].length);
      }
    }
  }
  const width = computeMostFrequent(widthArr);

  const normFormat = " ".repeat(width) + "{}";

  // Make the necessary adjustments.
  const adjustedPairs = Array<MatchPair>();
  for (let matchPair of matchPairs) {
    const { prefix, number, rest } = matchPair;
    const m = prefix.matchAll(ACCOUNT_RE);
    const match = [...m];
    if (match.length > 0) {
      matchPair = {
        prefix: normFormat.replace("{}", match[0][2]),
        number,
        rest,
      };
    }
    adjustedPairs.push(matchPair);
  }
  return adjustedPairs;
}

function findMatches(line: string, ...patterns: RegExp[]) {
  for (const p of patterns) {
    const match = [...line.matchAll(p)];
    if (match.length) {
      return match;
    }
  }
  return [];
}

/**
 * Reformat Beancount input to align all the numbers at the same column.
 *
 * @param contents A string, Beancount input syntax to reformat.
 * @param prefixWidth An integer, the width in characters to render the account
 *   name to. If this is not specified, a good value is selected automatically
 *   from the contents of the file.
 * @param numWidth An integer, the width to render each number. If this is not
 *   specified, a good value is selected automatically from the contents of the
 *   file.
 * @param currencyColumn An integer, the column at which to align the
 *   currencies. If given, this overrides the other options.
 * @param fixedCJKWidth Whether to treat CJK aka East Asian characters as two
 *   letters width on alignment.
 * @returns A string, reformatted Beancount input with all the number aligned.
 *   No other changes than whitespace changes should be present between that
 *   return value and the input contents.
 */
function alignBeancount(
  contents: string,
  prefixWidth?: number,
  numWidth?: number,
  currencyColumn?: number,
  fixedCJKWidth?: boolean,
): string {
  // Find all lines that have a number in them and calculate the maximum length
  // of the stripped prefix and the number.
  const matchPairs = Array<MatchPair>();
  for (const line of contents.split("\n")) {
    const match = findMatches(line, CURRENCY_RE);
    if (match.length > 0) {
      const [, prefix, number, rest] = match[0];
      matchPairs.push({ prefix, number, rest });
    } else {
      matchPairs.push({ prefix: line });
    }
  }

  // Normalize whitespace before lines that has some indent and an account
  // name.
  const normMatchPairs = normalizeIndentWhitespace(matchPairs);

  if (currencyColumn) {
    let output = "";
    for (const { prefix, number, rest } of normMatchPairs) {
      if (!number) {
        output += prefix;
      } else {
        let numOfSpaces =
          currencyColumn -
          getPrefixWidth(prefix, fixedCJKWidth) -
          number.length -
          4;
        if (numOfSpaces < 0) {
          numOfSpaces = 0;
        }
        const spaces = " ".repeat(numOfSpaces);
        output += prefix + spaces + "  " + number + " " + rest;
      }
      output += "\n";
    }
    return output;
  }

  const filteredPairs = new Array<FilteredPair>();
  for (const { prefix, number } of matchPairs) {
    if (number) {
      filteredPairs.push({ prefix, number });
    }
  }

  let maxPrefixWidth = 0;
  let maxNumWidth = 0;
  if (filteredPairs.length > 0) {
    maxPrefixWidth = Math.max(
      ...filteredPairs.map((p) => getPrefixWidth(p.prefix, fixedCJKWidth)),
    );
    maxNumWidth = Math.max(...filteredPairs.map((p) => p.number.length));
  }

  // Use user-supplied overrides, if available
  if (prefixWidth) {
    maxPrefixWidth = prefixWidth;
  }
  if (numWidth) {
    maxNumWidth = numWidth;
  }

  let output = "";
  for (const { prefix, number, rest } of normMatchPairs) {
    if (!number) {
      output += prefix;
    } else {
      output += padPrefix(prefix, maxPrefixWidth, fixedCJKWidth);
      output += "  ";
      output += number.padStart(maxNumWidth, " ");
      output += " " + rest;
    }
    output += "\n";
  }

  const formattedContents = output;

  // Ensure that the file before and after have only whitespace differences.
  // This is a sanity check, to make really sure we never change anything but whitespace,
  // so it's safe.
  const oldStripped = contents.trimRight().replace(/[ \t\n]+/gm, " ");
  const newStripped = formattedContents.trimRight().replace(/[ \t\n]+/gm, " ");
  if (oldStripped !== newStripped) {
    throw new Error("sanity check error");
  }

  return formattedContents;
}

/**
 * MIT License From Lencerf/vscode-beancount
 * https://github.com/Lencerf/vscode-beancount/master/src/formatter.ts#L117
 *
 * @param prefix Prefix content
 * @param fixedCJKWidth Whether to treat CJK aka East Asian characters as two
 *   letters width
 * @returns Prefix width
 */
function getPrefixWidth(prefix: string, fixedCJKWidth?: boolean): number {
  if (!fixedCJKWidth) {
    return prefix.length;
  }
  // eslint-disable-next-line  no-misleading-character-class
  const charsRegex = new RegExp(`[${WIDE_CHARS.join("")}]`, "g");
  // One CJK length = Two alphabet length
  return prefix.replace(charsRegex, "..").length;
}

/**
 * PadEnd prefix with blank space
 *
 * @param prefix Prefix to pad
 * @param maxPrefixWidth Max prefix width
 * @param fixedCJKWidth Whether to treat CJK aka East Asian characters as two
 *   letters width
 * @returns Pad prefix
 */
function padPrefix(
  prefix: string,
  maxPrefixWidth: number,
  fixedCJKWidth?: boolean,
): string {
  if (!fixedCJKWidth) {
    return prefix.trimEnd().padEnd(maxPrefixWidth, " ");
  }
  const prefixWidth = getPrefixWidth(prefix, fixedCJKWidth);
  if (prefixWidth === prefix.length) {
    return prefix.trimEnd().padEnd(maxPrefixWidth, " ");
  }
  return prefix
    .trimEnd()
    .padEnd(maxPrefixWidth + prefix.length - prefixWidth, " ");
}

/**
 * Format contents.
 *
 * @param contents Contents waiting to be formatted.
 * @param config Format argument
 */
export function format(contents: string, opts?: FormatOptions): string {
  // Align the contents.
  const formated = alignBeancount(
    contents,
    opts?.prefixWidth,
    opts?.numWidth,
    opts?.currencyColumn,
    opts?.fixedCJKWidth,
  );
  return formated.replace(/\n$/, "");
}
