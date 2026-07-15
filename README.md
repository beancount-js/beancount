# beancount-js

A standalone Beancount ledger UI migrated from [obsidian-ledger](https://github.com/stevejuma/obsidian-ledger). The monorepo contains the core accounting engine, parser, filters, CodeMirror language support, and the Fava-style web UI.

## Packages

| Package | Description |
|---------|-------------|
| `@beancount-js/beancount` | Core ledger logic, BQL query engine, ingest helpers |
| `@beancount-js/parser` | Beancount syntax parser and document model |
| `@beancount-js/filters` | Filter query language for reports |
| `@beancount-js/codemirror-lang-beancount` | CodeMirror 6 Beancount grammar |
| `@beancount-js/fava` | Svelte UI (editor, reports, import workflow) |

## Development

Requires [pnpm](https://pnpm.io/) 10.x and Node.js 20+.

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

`pnpm dev` starts the Fava UI dev server. The ledger contents persist in `localStorage` under the key `ledger`.

## Plugin configuration

Plugin declarations follow Beancount's standard three-argument contract: the optional second string is passed to the plugin unchanged as its configuration.

```beancount
plugin "beancount.plugins.forecast" "
  end: (month)-10
"
```

Studio also supports global defaults through `ledger-option`. These seed a declared plugin only when it has no inline configuration; they never enable a plugin on their own.

```beancount
2024-01-01 custom "ledger-option" "plugins" "
  beancount.plugins.forecast:
    end: (month)-10
"

plugin "beancount.plugins.forecast"
```

Inline configuration wins over the global default. The built-in forecast plugin accepts `now` and `end`; the credit-card plugin accepts `{ tag: ... }` as YAML and continues to support its legacy plain tag string. The auto-account, pad, and balance plugins do not accept configuration.

### Useful filters

```bash
pnpm --filter @beancount-js/fava check
pnpm --filter @beancount-js/fava dev
pnpm --filter @beancount-js/beancount test
```

## Routes

| Path | View |
|------|------|
| `/editor` | Beancount source editor |
| `/journal` | Transaction journal grid |
| `/errors` | Parse and validation errors |
| `/income_statement`, `/balance_sheet`, `/trial_balance` | Financial reports with charts |
| `/holdings`, `/statistics` | Query-based reports |
| `/query` | BQL query runner |
| `/accounts`, `/account/:name` | Account detail |
| `/records` | CSV import and categorization |
| `/import/editor` | Import YAML config editor |
| `/directives` | Generated beancount preview |

## Version control

This repository uses [Jujutsu](https://jj-vcs.github.io/jj/latest/) (`jj`) colocated with Git. Use `jj commit -m "..."` after validated slices.
