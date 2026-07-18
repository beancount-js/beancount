# Stage 2 form inventory

Stage 2 establishes the visual and behavioural contract before application imports move. The forms package remains the live implementation in this stage; Fava import migration and package removal are explicitly Stage 3 work.

## Canonical shared patterns

These are the reusable patterns agents should choose for new form work. They have a UI-package counterpart or an actively catalogued forms-package implementation, generated Docs, and Storybook examples.

| Pattern                       | Canonical implementation during Stage 2                                                                                    | Decision                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Label/value rows              | `@beancount-js/ui/forms/FormField.svelte`                                                                                  | Shared UI primitive                                            |
| Sections and repeated entries | `FormSectionHeader`, `EntryActions`, `CollapsibleItemList`, `FormAddButton`, and `FormToolbar` in `@beancount-js/ui/forms` | Shared UI primitives                                           |
| Exclusive modes               | `@beancount-js/ui/forms/SegmentedControl.svelte`                                                                           | Shared UI primitive for two or three values                    |
| Boolean values                | `@beancount-js/ui/forms/Switch.svelte`                                                                                     | Shared UI primitive                                            |
| Searchable choices            | `@beancount-js/forms` `FilterCommandPicker`                                                                                | Canonical forms primitive until the Stage 3 import migration   |
| Schema-shaped forms           | `StructuredForm`, `FormFieldRenderer`, and `FormViewRenderer`                                                              | Shared forms runtime; not a generic visual primitive           |
| Source editors                | `YamlBackedForm`, `JsonBackedForm`, and `CodeEditor`                                                                       | Shared forms runtime; YAML is the standard source-editing mode |

## Retained domain components

These components are still documented in Storybook, but are intentionally not promoted to the public UI package. They carry Beancount domain data, filter syntax, or account-appearance rules.

| Component                             | Reason it remains in `@beancount-js/forms`                          |
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
| `ScrollArea` and `ScrollAreaScrollbar` | Fava-local `Shadcn/Layout/Scroll Area`                                           |

## Non-visual exports

`core`, `types`, picker-search helpers, account-appearance helpers, review-diff helpers, and `autosizeTextarea` are support APIs. They do not need standalone visual Stories. Their consuming visual components are the catalog contract.

## Stage 2 completion rule

Every visual export above has a colocated story with its meaningful states and a generated Docs description. New components must be classified here before they are added: promote a deliberately cross-app primitive to `@beancount-js/ui`; otherwise retain it beside its domain implementation and explain the boundary in its Docs description.

After manual Storybook review in both themes, Stage 3 may switch Fava imports to the selected UI-package primitives and remove duplicate forms-package implementations.
