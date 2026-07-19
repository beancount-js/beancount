/** A small, dependency-free diff model for review-only AI proposal surfaces. */
export type UnifiedDiffSegmentType = "equal" | "removed" | "added";
export type UnifiedDiffSegment = { type: UnifiedDiffSegmentType; text: string };
export type UnifiedDiffLine = {
  type: UnifiedDiffSegmentType;
  text: string;
  segments: UnifiedDiffSegment[];
};
export type UnifiedDiffPart = {
  type: "equal" | "changed";
  lines: UnifiedDiffLine[];
};

type DiffInput = string | readonly string[];
type SequencePart = { type: UnifiedDiffSegmentType; values: string[] };
const MAX_DIFF_MATRIX_CELLS = 250_000;

function asLines(value: DiffInput) {
  return typeof value === "string"
    ? value
      ? value.split("\n")
      : []
    : [...value];
}

function pushPart(
  parts: SequencePart[],
  type: UnifiedDiffSegmentType,
  value: string,
) {
  const last = parts.at(-1);
  if (last?.type === type) last.values.push(value);
  else parts.push({ type, values: [value] });
}

function diffSequence(before: readonly string[], after: readonly string[]) {
  if (before.length * after.length > MAX_DIFF_MATRIX_CELLS) {
    const parts: SequencePart[] = [];
    before.forEach((value) => pushPart(parts, "removed", value));
    after.forEach((value) => pushPart(parts, "added", value));
    return parts;
  }
  const table = Array.from({ length: before.length + 1 }, () =>
    Array(after.length + 1).fill(0),
  ) as number[][];
  for (
    let beforeIndex = before.length - 1;
    beforeIndex >= 0;
    beforeIndex -= 1
  ) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      table[beforeIndex][afterIndex] =
        before[beforeIndex] === after[afterIndex]
          ? table[beforeIndex + 1][afterIndex + 1] + 1
          : Math.max(
              table[beforeIndex + 1][afterIndex],
              table[beforeIndex][afterIndex + 1],
            );
    }
  }
  const parts: SequencePart[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < before.length && afterIndex < after.length) {
    if (before[beforeIndex] === after[afterIndex]) {
      pushPart(parts, "equal", after[afterIndex]);
      beforeIndex += 1;
      afterIndex += 1;
    } else if (
      table[beforeIndex + 1][afterIndex] >= table[beforeIndex][afterIndex + 1]
    ) {
      pushPart(parts, "removed", before[beforeIndex++]);
    } else {
      pushPart(parts, "added", after[afterIndex++]);
    }
  }
  while (beforeIndex < before.length)
    pushPart(parts, "removed", before[beforeIndex++]);
  while (afterIndex < after.length)
    pushPart(parts, "added", after[afterIndex++]);
  return parts;
}

function wordSegments(before: string, after: string) {
  const beforeWords = before.match(/\s+|[^\s]+/g) ?? [];
  const afterWords = after.match(/\s+|[^\s]+/g) ?? [];
  return diffSequence(beforeWords, afterWords).map((part) => ({
    type: part.type,
    text: part.values.join(""),
  }));
}

function changedLines(parts: SequencePart[]) {
  const removed = parts
    .filter((part) => part.type === "removed")
    .flatMap((part) => part.values);
  const added = parts
    .filter((part) => part.type === "added")
    .flatMap((part) => part.values);
  const lines: UnifiedDiffLine[] = [];
  const paired = Math.min(removed.length, added.length);
  for (let index = 0; index < paired; index += 1) {
    const segments = wordSegments(removed[index], added[index]);
    lines.push(
      {
        type: "removed",
        text: removed[index],
        segments: segments
          .filter((segment) => segment.type !== "added")
          .map((segment) => ({
            type: segment.type === "equal" ? "equal" : "removed",
            text: segment.text,
          })),
      },
      {
        type: "added",
        text: added[index],
        segments: segments
          .filter((segment) => segment.type !== "removed")
          .map((segment) => ({
            type: segment.type === "equal" ? "equal" : "added",
            text: segment.text,
          })),
      },
    );
  }
  removed.slice(paired).forEach((text) =>
    lines.push({
      type: "removed",
      text,
      segments: [{ type: "removed", text }],
    }),
  );
  added
    .slice(paired)
    .forEach((text) =>
      lines.push({ type: "added", text, segments: [{ type: "added", text }] }),
    );
  return lines;
}

/** Produces a unified, line-aware diff with word-level replacement segments. */
export function unifiedDiff(
  before: DiffInput,
  after: DiffInput,
): UnifiedDiffPart[] {
  const sequence = diffSequence(asLines(before), asLines(after));
  const result: UnifiedDiffPart[] = [];
  let index = 0;
  while (index < sequence.length) {
    const part = sequence[index];
    if (part.type === "equal") {
      result.push({
        type: "equal",
        lines: part.values.map((text) => ({
          type: "equal",
          text,
          segments: [{ type: "equal", text }],
        })),
      });
      index += 1;
      continue;
    }
    const changed: SequencePart[] = [];
    while (index < sequence.length && sequence[index].type !== "equal")
      changed.push(sequence[index++]);
    result.push({ type: "changed", lines: changedLines(changed) });
  }
  return result;
}
