# Beancount JS Studio

A Beancount accounting monorepo with a controller-backed application UI built
on published [Design Core](https://github.com/lapismd/design-core).
The Design Core application catalog in `packages/ui` is the active development
baseline as of 28 October 2026.

Read [app status](docs/APP_STATUS.md), the
[baseline specification](spec/src/app-baseline.md), and the
[UI package guide](packages/ui/README.md) for ownership, validation and limits.

## Packages

| Package                                                     | Role                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `@beancount-js/app`                                         | Executable server/web host for the active application and its `BeancountDataSource` adapters |
| `@beancount-js/ui`                                          | Active application composition, controllers, adapted presentation and sole Storybook catalog |
| `@lapismd/design-core`                                      | Published shell, forms and UI primitives consumed by the application                         |
| `@beancount-js/beancount`, `parser`, `filters`, `beanquery` | Repository-owned accounting, parsing and query logic                                         |
| `@beancount-js/server`, `workspace`, connectors             | Host services and integration boundaries                                                     |
| `@beancount-js/fava`                                        | Retained frozen comparison application                                                       |
| `@beancount-js/fava-beta`                                   | Retained legacy integration host/services                                                    |
| `@lapis/ui` (`packages/ui-legacy`), `@beancount-js/forms`   | Compatibility imports for retained hosts; no active catalog                                  |

## Development

Use Node.js 22.12+ (Node 24 is used locally), pnpm 10 and Jujutsu. Catalog
checks need the pinned source/reference commit objects available in this repo.

```sh
pnpm install
pnpm dev
pnpm dev:app
```

`pnpm dev` starts Storybook at `http://127.0.0.1:6006`. The application stories
use disposable in-memory projects and fixture services. `pnpm dev:app` starts
the executable host at `http://127.0.0.1:5173` and defaults to the repository
`sample.beancount`; set `BEANCOUNT_STUDIO_PROJECT_ROOT` and
`BEANCOUNT_STUDIO_ENTRY_FILE` for another project. The host reads and writes
real ledger files through `BeancountDataSource`. Bank and merchant service
routes are integrated in server mode; qualification against external bank
credentials remains separate from route and filesystem coverage.

The active application intentionally includes no AI panel, provider route, MCP
process, ingestion enrichment action or rule executor. The optional host-owned
details snippet and the provider-neutral `BeancountDataSource.request` boundary
remain available for a future integration without coupling one into the app.

```sh
pnpm check:baseline
pnpm checks:ui
pnpm checks:compat
pnpm test:storybook
pnpm build-storybook
pnpm --filter @beancount-js/app checks
pnpm test
```

`pnpm checks` runs the core, active UI and compatibility checks. The
[status page](docs/APP_STATUS.md) records observed results and outstanding
aggregate failures. A passing catalog is not production integration or visual
signoff. Root build/test commands may also exercise retained legacy hosts.

## Preserved previous state

`archive/pre-design-core-baseline-2026-10-28` preserves the previous checkout
at `96936679`, including the pending Visual Delta/macOS changes. The
`beancount-studio` bookmark names the promoted application development baseline.
The repository's separate `main` bookmark is not repurposed by this transition.

```sh
jj --no-pager show archive/pre-design-core-baseline-2026-10-28
```

Both histories are retained by the baseline merge. The selected visual
reference remains Fava at `498bd075`; provenance and comparison details are in
[PARITY_REVIEW.md](packages/ui/PARITY_REVIEW.md). The former extraction ledger,
old catalog and visual tooling remain recoverable through the archive bookmark.

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

## Version control

Use [Jujutsu](https://jj-vcs.github.io/jj/latest/) for local repository work.
Commit small verified slices with `jj commit -m "..."`; preserve unrelated work.
Bookmarks are local unless explicitly published.
