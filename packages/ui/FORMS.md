# Form implementation guide

The normative form and account-identity contract is
[BC-APP-004](../../spec/src/application-ui.md). This guide collects the current
implementation choices for contributors; it does not define a competing
requirement.

## Structured layout

- Use public Design Core forms and Studio controls exported from
  `@beancount-js/ui/forms`.
- Keep one `max-content minmax(0, 1fr)` label/value grid for each form scope,
  with `min-width: 0`, one visible separator, and no initial horizontal scroll.
- Use title-only collapsible headers and a left-rail disclosure. The toolbar
  owns collapse/expand-all, including nested and asynchronously added entries.
- Keep inline editor widgets compact; they are document affordances rather than
  structured form rows.

## Fields and pickers

- Wrap pill/button controls, date pickers, and searchable pickers in
  `FormField as="div" align="center"`. Center text rows when mixed with pills.
- Use `FilterCommandPicker` for searchable choices. Set `fullWidth` in forms and
  sidebars, `multiple` for multi-select, and `allowCustom` for typed values.
  Do not add new `SearchableChoicePicker` uses.
- Use `SegmentedControl` for three or fewer mutually exclusive values and
  `ChoiceMenu` for larger compact choices.
- Use `TagEditor` for tags and chip/list controls for non-tag string lists.
- Use `SearchFilterBar` for filter-query search chrome.

## Editing and evidence

- Use `YamlEditor` or `YamlBackedForm` for YAML. Invalid YAML stays editable and
  shows its parse error without replacing the authoritative draft.
- Textareas autosize and avoid resize handles or ordinary internal scrolling.
- Evidence markers use `[^id]`; duplicate IDs are ambiguous, unresolved stored
  references remain visible, and generated output strips marker text.

## Verification

Add focused unit or Storybook interaction coverage for changed form behavior.
Check expanded/collapsed states, keyboard operation, nested collapse-all,
separator borders, and desktop/mobile containment. Run `pnpm checks:ui` for
every active UI slice.
