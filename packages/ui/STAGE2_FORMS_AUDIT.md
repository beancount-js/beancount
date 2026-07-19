# Stage 2 form inventory

Stage 2 establishes `@beancount-js/ui/forms` as the complete visual and behavioural contract before application imports move. The original forms package stays untouched for Fava compatibility until its explicit migration stage; new shared form work belongs in the UI package.

## Canonical shared patterns

These are the reusable patterns agents should choose for new form work. They are implemented in the UI package, with generated Docs and colocated Storybook examples.

| Pattern                       | Canonical implementation during Stage 2                                                                                    | Decision                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Label/value rows              | `@beancount-js/ui/forms/FormField.svelte`                                                                                  | Shared UI primitive                                       |
| Sections and repeated entries | `FormSectionHeader`, `EntryActions`, `CollapsibleItemList`, `FormAddButton`, and `FormToolbar` in `@beancount-js/ui/forms` | Shared UI primitives                                      |
| Exclusive modes               | `@beancount-js/ui/forms/SegmentedControl.svelte`                                                                           | Shared UI primitive for two or three values               |
| Boolean values                | `@beancount-js/ui/forms/Switch.svelte`                                                                                     | Shared UI primitive                                       |
| Searchable choices            | `@beancount-js/ui/forms/FilterCommandPicker.svelte`                                                                        | Canonical shared form primitive                           |
| Schema-shaped forms           | `StructuredForm`, `FormFieldRenderer`, and `FormViewRenderer`                                                              | Shared UI forms runtime; not a generic visual primitive   |
| Source editors                | `YamlBackedForm`, `JsonBackedForm`, and `CodeEditor`                                                                       | Shared UI forms runtime; YAML is the standard source mode |

## UI-owned domain form components

These components are part of the public UI forms contract, but remain domain-specific rather than becoming generic low-level primitives. Their implementations, styles, stories, and supporting APIs are all UI-owned.

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

Every visual export above has a colocated story with its meaningful states and a generated Docs description. New components must be classified here before they are added: add every reusable form pattern to `@beancount-js/ui/forms`, then explain any domain-specific boundary in its Docs description.

After manual Storybook review in both themes, the later Fava migration may switch imports to the UI package and remove duplicate forms-package implementations.
