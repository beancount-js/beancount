import {
  codeFolding,
  foldEffect,
  foldState,
  foldedRanges,
  foldable,
  syntaxTree,
  unfoldEffect,
} from "@codemirror/language";
import { RangeSet, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  GutterMarker,
  ViewPlugin,
  gutter,
  type BlockInfo,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import type { NodeIterator } from "@lezer/common";

type FoldKind = "generic" | "metadata" | "posting";

export function useFoldIcon(
  open: boolean,
  kind: FoldKind = "generic",
  active: boolean = false,
) {
  const foldIcon = document.createElement("div");
  foldIcon.className = [
    "collapse-icon",
    `fold-icon-${kind}`,
    open ? "fold-icon-expanded" : "fold-icon-collapsed",
    active ? "fold-icon-active" : "",
  ].join(" ");
  const foldIcon_svg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  const foldIcon_svg_path = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  foldIcon_svg.setAttributeNS(null, "viewBox", "0 0 24 24");
  foldIcon_svg.setAttributeNS(null, "fill", "none");
  foldIcon_svg.setAttributeNS(null, "stroke", "currentColor");
  foldIcon_svg.setAttributeNS(null, "stroke-width", "2");
  foldIcon_svg.setAttributeNS(null, "stroke-linecap", "round");
  foldIcon_svg.setAttributeNS(null, "stroke-linejoin", "round");
  foldIcon_svg.setAttributeNS(null, "class", "svg-icon");
  foldIcon_svg_path.setAttribute("d", "M3 8L12 17L21 8");
  foldIcon_svg.appendChild(foldIcon_svg_path);
  if (!open) {
    foldIcon_svg.setAttribute(
      "style",
      "height: 100%; transform: rotate(-90deg);",
    );
  }
  foldIcon.appendChild(foldIcon_svg);

  return foldIcon;
}

function foldedRangeOnLine(view: EditorView, line: BlockInfo) {
  let result: { from: number; to: number } | null = null;
  foldedRanges(view.state).between(line.from, line.to, (from, to) => {
    if (from <= line.to && to >= line.from) result = { from, to };
  });
  return result;
}

function foldKind(view: EditorView, line: BlockInfo): FoldKind {
  const tree = syntaxTree(view.state);
  if (tree.length < line.to) return "generic";

  for (
    let stack: NodeIterator | null = tree.resolveStack(line.to, 1);
    stack;
    stack = stack.next
  ) {
    const node = stack.node;
    if (view.state.doc.lineAt(node.from).from !== line.from) continue;
    if (node.name === "Metadata") return "metadata";
    if (node.name === "Posting") return "posting";
  }

  return "generic";
}

class FoldMarker extends GutterMarker {
  constructor(
    readonly open: boolean,
    readonly kind: FoldKind,
    readonly active: boolean,
  ) {
    super();
  }

  eq(other: FoldMarker) {
    return (
      this.open === other.open &&
      this.kind === other.kind &&
      this.active === other.active
    );
  }

  toDOM() {
    return useFoldIcon(this.open, this.kind, this.active);
  }
}

function buildMarkers(view: EditorView) {
  const markers = new RangeSetBuilder<GutterMarker>();
  const activeLine = view.state.doc.lineAt(view.state.selection.main.head).from;
  for (const line of view.viewportLineBlocks) {
    const folded = foldedRangeOnLine(view, line);
    const range = folded ?? foldable(view.state, line.from, line.to);
    if (range) {
      markers.add(
        line.from,
        line.from,
        new FoldMarker(!folded, foldKind(view, line), line.from === activeLine),
      );
    }
  }
  return markers.finish();
}

export function foldGutter(): Extension {
  const markers = ViewPlugin.fromClass(
    class {
      markers: ReturnType<typeof buildMarkers>;

      constructor(view: EditorView) {
        this.markers = buildMarkers(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.startState.field(foldState, false) !==
            update.state.field(foldState, false) ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.markers = buildMarkers(update.view);
        }
      }
    },
  );

  return [
    markers,
    gutter({
      class: "cm-foldGutter",
      markers: (view) => view.plugin(markers)?.markers ?? RangeSet.empty,
      initialSpacer: () => new FoldMarker(false, "generic", false),
      domEventHandlers: {
        click: (view, line) => {
          const folded = foldedRangeOnLine(view, line);
          if (folded) {
            view.dispatch({ effects: unfoldEffect.of(folded) });
            return true;
          }
          const range = foldable(view.state, line.from, line.to);
          if (!range) return false;
          view.dispatch({ effects: foldEffect.of(range) });
          return true;
        },
      },
    }),
    codeFolding(),
  ];
}
