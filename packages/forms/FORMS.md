# Forms And Shared UI

> Local copy of the CV Studio forms contract for Beancount JS Studio.
> Origin: `~/code/cv/spec/src/30-domain-contracts/forms-and-shared-ui.md`
> Canonical implementation surface in this repo: `@beancount-js/forms`
> (`packages/forms/src`).
>
> Where the origin text refers to `@cvstudio/ui` or `@cvstudio/forms`, use
> `@beancount-js/forms` in this repository. `@beancount-js/ui/forms` is
> part of the paused migration and should remain unchanged unless explicitly resumed.

The shared form and UI contract keeps Studio, applications, docs, and task editors visually and behaviorally consistent.

## Shared form pattern

Use `@beancount-js/forms` primitives before creating new local form controls in
Studio or feature packages. Existing Fava imports remain in place during this
paused state; add new reusable form work to `@beancount-js/forms`.

Default editable forms should be minimal and row-based:

- labels on the left;
- editable values on the right;
- visible row separators;
- proper-case labels and section titles;
- debounced autosave unless a workflow has a special reason to defer writes.

## Sections and repeatable groups

- Use `FormSectionHeader` for top-level editable sections.
- Keep section headers collapsible and expose move/delete actions on hover. When the title is not editable, set `titleToggleable` so the complete title row is a disclosure button; the chevron remains an equivalent left-rail control.
- Disclosure toggles must sit in an absolutely positioned left rail, not in the row grid.
- Use `EntryActions` for repeated entries that can be reordered or removed. Arrays whose order is persisted or shown to the user must expose the shared up/down controls unless their order is explicitly fixed by the domain.
- Use `CollapsibleItemList` for arrays where the header owns collapse state and count.
- Repeated entries that need their own editable title and disclosure use `FormSectionHeader`, rather than a bespoke heading, icon, and border combination.
- Empty arrays render no filler copy; the add affordance is sufficient.
- Repeatable array add actions align to the end of the row, while rendered array items span the full editable row width.
- Newly added blank rows should use field-specific placeholders such as `Add Technology`.
- Optional object groups should use the same add flow as arrays and only render selected/required fields.

## Form implementation checklist

Before shipping an editable Studio form:

1. Prefer `StructuredForm` for schema-shaped data; otherwise compose `FormSectionHeader`, `FormField`, and the shared repeatable-entry primitives.
2. Use one `max-content minmax(0, 1fr)` label/value grid per form scope. Do not introduce arbitrary flex rows for labelled fields.
3. Let `FormSectionHeader` own the single separator below a disclosure header. Wrapper sections and repeated-entry containers provide spacing and indentation only; they must not add an adjacent top or bottom border.
4. Make every non-editable disclosure title-row clickable. Editable-title rows preserve direct title editing and use the left-rail chevron to collapse.
5. Keep add affordances in the section footer, aligned bottom-right; use shared hover actions for remove or reordering.
6. A collapse-all control must operate on every descendant disclosure, including asynchronously loaded entries; newly loaded or added entries inherit the current collapse-all state.
7. Keep the form container `min-width: 0` and verify that its initial desktop state has no horizontal scrollbar. Indentation reserves only enough room for left-rail controls.
8. Add a focused UI test for the expanded and collapsed state, including a title-row click for non-editable disclosures and the nested collapse-all state. Check the rendered layout for duplicate separator borders.

## Inputs

- Textareas should autosize, hide resize handles, and avoid internal scrollbars for ordinary editing.
- Default to single-line autosizing fields unless the field intentionally needs a larger empty writing area.
- Use `SegmentedControl` for three or fewer mutually exclusive values.
- Use `ChoiceMenu` for larger option sets when a compact inline selector is better than a native select.
- Use `FormField align="center"` for pill controls, date pickers, switches, and any control that is not a borderless text input/`output`. Pill triggers sit flush on the row separator when left at the default `align="start"`.
- Popover controls (`FilterCommandPicker`, menus, date popovers) must render inside `FormField as="div" align="center"` — never a bare `<label>` wrapper (nested interactive controls break a11y and skip the centered row padding).
- When a structured form mixes text inputs with pill controls, prefer `align="center"` on the text rows too so label/control baselines stay consistent.
- Keep labelled fields inside one `beancount-structured-form` / `cv-structured-form` scope so subgrid aligns label columns; do not drop a `FormField` between sibling flex stacks outside that grid.
- Use `FilterCommandPicker` for all searchable choice pickers (facet filters, accounts, queries, enum-like choices, env var names). Prefer it over `SearchableChoicePicker` and app-local ComboBox wrappers. Use `fullWidth` for sidebar/form fields; pill triggers are the default. For multi-select, set `multiple` with `values` + `onValuesChange`; single-select uses `value` + `onChange`. For free-text / typed custom values (e.g. project `.env` key names), set `allowCustom={true}` — do not fall back to `SearchableChoicePicker`.
- Use `TagEditor` for tag entry (chips + autocomplete). Prefer `tag-list` fields / `tagListField()` over plain comma-separated text inputs. Use `ChipAutocomplete` / `chip-list` / `string-list` for non-tag string lists. Inside `FormField`, set `showLabel={false}` and `embedded`.
- `SearchableChoicePicker` is legacy; do not use it in new UI.
- Use `SearchFilterBar` for search chrome: auto-expanding filter-query CodeMirror pill (`beancountFilter` highlighting), optional expandable filter slot, clear-search / clear-all, and `filters` / `collapsedFilters` / `actions` snippets. Pass `editorExtensions` for host theme highlighters.

## Evidence references

Evidence story `source_refs` are flat marker links such as `#1` or `#deployments`.

Users create CV references by typing footnote-style markers in CV text:

```text
[^id]
```

The References form resolves CV text markers and Evidence objects with stable ids. It must show the stored ref, resolved JSON Pointer path, label, and excerpt. Duplicate marker ids are ambiguous and must not be silently resolved. Unresolved stored refs remain visible instead of being deleted automatically.

Markers are editor metadata. Generated Markdown, RenderCV YAML, Typst, and HTML preview output must strip marker text.

## YAML editing

Use `YamlEditor` / `YamlBackedForm` for YAML editing. Do not add plain textarea YAML editors.

Document-style editors such as CV, docs notes, application prep, and custom Docs panels such as Practice expose the same toolbar YAML switch. It always edits the authoritative serialized draft file rather than a panel-specific copy. Valid YAML edits update the draft model and autosave; invalid YAML stays editable and surfaces the parse error without discarding draft text.

Collapse/expand-all commands should be tab-aware. In YAML mode, the command folds or unfolds the active CodeMirror editor, including nested child ranges.

## AI review diffs

When an AI proposal changes a form value, review mode renders only the two line-aware unified-diff
versions, rather than duplicate raw Before and After values. The old version marks removed words in
red with strikethrough; the new version marks additions in bold green. The field resumes ordinary
editing when its review is kept or undone. YAML review widgets use the same two-version diff model
so a proposed source edit conveys the same additions, removals, and unchanged context as its form
counterpart.
