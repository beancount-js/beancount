import {
  foldEffect,
  foldedRanges,
  foldService,
  unfoldEffect,
} from "@codemirror/language";
import type { EditorState, StateEffect } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export type HeaderFoldRange = { from: number; to: number };

function headerLevel(line: string, maxDepth: number) {
  const match = /^#+/.exec(line) || /^\*+/.exec(line);
  return match?.[0]?.length ?? maxDepth;
}

function headerFoldRange(
  state: EditorState,
  lineNumber: number,
  maxDepth: number,
): HeaderFoldRange | null {
  const startLine = state.doc.line(lineNumber);
  const level = headerLevel(startLine.text, maxDepth);
  if (level === maxDepth) return null;

  let end = startLine.to;
  for (
    let nextLine = lineNumber + 1;
    nextLine <= state.doc.lines;
    nextLine += 1
  ) {
    const line = state.doc.line(nextLine);
    if (headerLevel(line.text, maxDepth) <= level) break;
    end = line.to;
  }

  return end > startLine.to ? { from: startLine.to, to: end } : null;
}

export function headerFoldRanges(state: EditorState, maxDepth: number = 100) {
  const ranges: HeaderFoldRange[] = [];
  for (let line = 1; line <= state.doc.lines; line += 1) {
    const range = headerFoldRange(state, line, maxDepth);
    if (range) ranges.push(range);
  }
  return ranges;
}

function dispatchHeaderEffects(
  view: EditorView,
  effect: typeof foldEffect | typeof unfoldEffect,
  ranges: readonly HeaderFoldRange[],
) {
  const effects: Array<StateEffect<unknown>> = ranges.map((range) =>
    effect.of(range),
  );
  if (effects.length) view.dispatch({ effects });
}

export function collapseHeaders(view: EditorView) {
  dispatchHeaderEffects(view, foldEffect, headerFoldRanges(view.state));
}

export function collapseHeadersExceptLast(view: EditorView) {
  dispatchHeaderEffects(
    view,
    foldEffect,
    headerFoldRanges(view.state).slice(0, -1),
  );
}

export function expandHeaders(view: EditorView) {
  dispatchHeaderEffects(view, unfoldEffect, headerFoldRanges(view.state));
}

export function areAllHeadersCollapsed(state: EditorState) {
  const ranges = headerFoldRanges(state);
  if (!ranges.length) return false;

  return ranges.every((range) => {
    let folded = false;
    foldedRanges(state).between(range.from, range.to, (from, to) => {
      if (from === range.from && to === range.to) folded = true;
    });
    return folded;
  });
}

export function foldHeaders(maxDepth: number = 100) {
  return foldService.of((state, lineStart) => {
    const startLine = state.doc.lineAt(lineStart);
    return headerFoldRange(state, startLine.number, maxDepth);
  });
}
