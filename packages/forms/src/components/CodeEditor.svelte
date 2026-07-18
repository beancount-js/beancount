<script lang="ts">
  import {
    autocompletion,
    closeBrackets,
    completionKeymap,
  } from "@codemirror/autocomplete";
  import {
    defaultKeymap,
    history,
    historyKeymap,
    indentWithTab,
  } from "@codemirror/commands";
  import { json } from "@codemirror/lang-json";
  import { yaml } from "@codemirror/lang-yaml";
  import {
    bracketMatching,
    defaultHighlightStyle,
    foldGutter,
    indentOnInput,
    syntaxHighlighting,
  } from "@codemirror/language";
  import { lintGutter, linter } from "@codemirror/lint";
  import { Compartment, EditorState, type Extension } from "@codemirror/state";
  import {
    drawSelection,
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    placeholder as placeholderExtension,
  } from "@codemirror/view";
  import { onMount } from "svelte";
  import { parserDiagnostics } from "../code-editor-syntax";

  let {
    value = $bindable(""),
    language = "json",
    placeholder = "{}",
    minHeight = "24rem",
    ariaLabel = "Code editor",
    syntaxDiagnostics = true,
    extensions = [],
    onChange,
  }: {
    value?: string;
    language?: "json" | "yaml" | string;
    placeholder?: string;
    minHeight?: string;
    ariaLabel?: string;
    syntaxDiagnostics?: boolean;
    extensions?: Extension;
    onChange?: (value: string) => void;
  } = $props();

  let host: HTMLDivElement;
  let editor: EditorView | undefined;
  const languageCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const ariaLabelCompartment = new Compartment();
  const placeholderCompartment = new Compartment();
  const diagnosticsCompartment = new Compartment();
  const extensionsCompartment = new Compartment();

  function languageExtension(): Extension {
    switch (language.trim().toLowerCase()) {
      case "json":
        return json();
      case "yaml":
      case "yml":
        return yaml();
      default:
        return [];
    }
  }

  function editorTheme(): Extension {
    return EditorView.theme({
      "&": {
        minHeight,
        border: "1px solid var(--border)",
        borderRadius: "calc(var(--radius) - 2px)",
        color: "var(--foreground)",
        backgroundColor: "var(--background)",
      },
      "&.cm-focused": {
        outline: "1px solid var(--ring)",
        outlineOffset: "1px",
      },
      ".cm-scroller": {
        minHeight,
        fontFamily:
          "'Source Code Pro Variable', 'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        backgroundColor: "transparent",
      },
      ".cm-content": {
        minHeight,
        padding: "0.75rem 0.875rem",
        fontSize: "0.8125rem",
        lineHeight: "1.55",
      },
      ".cm-gutters": {
        borderRight: "1px solid var(--border)",
        color: "var(--muted-foreground)",
        backgroundColor: "color-mix(in srgb, var(--muted) 62%, transparent)",
      },
      ".cm-activeLine, .cm-activeLineGutter": {
        backgroundColor: "color-mix(in srgb, var(--accent) 75%, transparent)",
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: "color-mix(in srgb, var(--primary) 22%, transparent)",
      },
      ".cm-cursor": { borderLeftColor: "var(--foreground)" },
      ".cm-placeholder": { color: "var(--muted-foreground)" },
      ".cm-tooltip": {
        border: "1px solid var(--border)",
        borderRadius: "calc(var(--radius) - 2px)",
        color: "var(--popover-foreground)",
        backgroundColor: "var(--popover)",
      },
    });
  }

  const setup: Extension = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    highlightActiveLine(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
  ];

  function diagnosticsExtension(): Extension {
    return syntaxDiagnostics
      ? [
          lintGutter(),
          linter((view) => parserDiagnostics(view.state), { delay: 250 }),
        ]
      : [];
  }

  onMount(() => {
    editor = new EditorView({
      doc: value,
      parent: host,
      extensions: [
        setup,
        languageCompartment.of(languageExtension()),
        themeCompartment.of(editorTheme()),
        ariaLabelCompartment.of(
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
        ),
        placeholderCompartment.of(placeholderExtension(placeholder)),
        diagnosticsCompartment.of(diagnosticsExtension()),
        extensionsCompartment.of(extensions),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          value = update.state.doc.toString();
          onChange?.(value);
        }),
      ],
    });

    return () => editor?.destroy();
  });

  $effect(() => {
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== value) {
      editor.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  });

  $effect(() => {
    if (!editor) return;
    editor.dispatch({
      effects: [
        languageCompartment.reconfigure(languageExtension()),
        themeCompartment.reconfigure(editorTheme()),
        ariaLabelCompartment.reconfigure(
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
        ),
        placeholderCompartment.reconfigure(placeholderExtension(placeholder)),
        diagnosticsCompartment.reconfigure(diagnosticsExtension()),
        extensionsCompartment.reconfigure(extensions),
      ],
    });
  });
</script>

<div
  bind:this={host}
  class="beancount-json-code-editor"
  data-code-editor={language}
></div>

<style>
  .beancount-json-code-editor {
    min-width: 0;
    overflow: hidden;
  }

  :global(.beancount-json-code-editor .cm-editor) {
    height: auto;
  }
</style>
