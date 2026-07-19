# Stage 2 form inventory

Stage 2 established the visual and behavioural contract before application
imports move. `@beancount-js/ui/forms` is now the canonical implementation;
this package remains a compatibility implementation for unchanged Fava
consumers until the explicit application migration.

## Canonical shared patterns

These are the reusable patterns agents should choose for new form work. They
live in the UI package with generated Docs and Storybook examples. Do not add
new reusable visual form work to this compatibility package.

| Pattern                       | Canonical implementation during Stage 2                                                                                    | Decision                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Label/value rows              | `@beancount-js/ui/forms/FormField.svelte`                                                                                  | Shared UI primitive                                            |
| Sections and repeated entries | `FormSectionHeader`, `EntryActions`, `CollapsibleItemList`, `FormAddButton`, and `FormToolbar` in `@beancount-js/ui/forms` | Shared UI primitives                                           |
| Exclusive modes               | `@beancount-js/ui/forms/SegmentedControl.svelte`                                                                           | Shared UI primitive for two or three values                    |
| Boolean values                | `@beancount-js/ui/forms/Switch.svelte`                                                                                     | Shared UI primitive                                            |
| Searchable choices            | `@beancount-js/ui/forms` `FilterCommandPicker`                                                                             | Canonical shared form primitive                                |
| Schema-shaped forms           | `StructuredForm`, `FormFieldRenderer`, and `FormViewRenderer`                                                              | Shared forms runtime; not a generic visual primitive           |
| Source editors                | `YamlBackedForm`, `JsonBackedForm`, and `CodeEditor`                                                                       | Shared forms runtime; YAML is the standard source-editing mode |

## UI-owned domain components

These components remain domain-specific, but their visual implementations,
styles, stories, and supporting APIs are UI-owned. Applications supply their
display-ready data and persistence behaviour.

| Component                             | UI-package boundary                                                 |
| ------------------------------------- | ------------------------------------------------------------------- |
| `SearchFilterBar`                     | Beancount filter-query syntax and application-specific filter slots |
| `ChipAutocomplete` and `TagEditor`    | Multi-value editing behaviour used by journal and rules workflows   |
| `AccountAvatar` and `IconColorPicker` | Account appearance, merchant logos, and contrast-correction rules   |

## Deprecated compatibility components

Keep these working for existing callers, but do not select them for new work. Their Storybook Docs state the replacement.

| Component                              | Use instead                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `SearchableChoicePicker`               | `FilterCommandPicker`                                                            |
| `AutocompleteInput`                    | `FilterCommandPicker` for searchable selections; a standard input for plain text |
| `ScrollArea` and `ScrollAreaScrollbar` | UI-owned `Shadcn/Layout/Scroll Area`                                             |

## Non-visual exports

`core`, `types`, picker-search helpers, account-appearance helpers, review-diff helpers, and `autosizeTextarea` are support APIs. They do not need standalone visual Stories. Their consuming visual components are the catalog contract.

## Stage 2 completion rule

Every visual export above has a copied UI implementation, colocated story with
its meaningful states, and a generated Docs description. New reusable form
components must be added to `@beancount-js/ui/forms` and classified in
`packages/ui/STAGE2_FORMS_AUDIT.md`; keep this package unchanged except for
compatibility fixes to existing consumers.

After manual Storybook review in both themes, the application migration may
switch Fava imports to the UI-package primitives and remove duplicate
forms-package implementations.
