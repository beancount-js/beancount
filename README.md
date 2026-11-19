# Beancount JS Studio

A Beancount accounting monorepo with a controller-backed application UI built
on published [Design Core](https://github.com/lapismd/design-core).
The Design Core application in `packages/ui`, hosted by `packages/app`, is the
sole application baseline.

Read the [product specification](spec/src/index.md),
[app status](docs/APP_STATUS.md), and the
[UI package guide](packages/ui/README.md) for ownership, validation and limits.
Review the current application catalog in the
[hosted Storybook](https://beancount-js.github.io/beancount/),
including the canonical specification and public component documentation.

## Packages

| Package                                                     | Role                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `@beancount-js/app`                                         | Executable server/web host for the active application and its `BeancountDataSource` adapters |
| `@beancount-js/ui`                                          | Active application composition, controllers, adapted presentation and sole Storybook catalog |
| `@lapismd/design-core`                                      | Published shell, forms and UI primitives consumed by the application                         |
| `@beancount-js/beancount`, `parser`, `filters`, `beanquery` | Repository-owned accounting, parsing and query logic                                         |
| `@beancount-js/server`, `workspace`, connectors             | Host services and integration boundaries                                                     |
| `@beancount-js/cli`                                         | Command-line launcher for the active `@beancount-js/app` server build                        |

## Development

Use Node.js 22.12+ (Node 24 is used locally), pnpm 10 and Jujutsu.

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

The `beancount-studio` bookmark is the published application line. Pushes to it
build `packages/ui` and deploy the static Storybook to GitHub Pages.

The active application intentionally includes no AI panel, provider route, MCP
process, ingestion enrichment action or rule executor. The optional host-owned
details snippet and the provider-neutral `BeancountDataSource.request` boundary
remain available for a future integration without coupling one into the app.

```sh
pnpm check:baseline
pnpm spec:check
pnpm checks
pnpm checks:ui
pnpm test:storybook
pnpm build-storybook
pnpm --filter @beancount-js/app checks
pnpm test
```

`pnpm spec:check` validates the canonical `BC-*` requirements, their evidence,
spec-first history, mdBook, baseline ownership, and Storybook mirrors.
`pnpm checks` runs that governance lane before the current package graph, active
host, and active UI. The
[status page](docs/APP_STATUS.md) records observed results and outstanding
limits. A passing catalog is not production integration or visual signoff.

## Language extensions and plugin configuration

The canonical distinction between the pinned upstream Beancount baseline and
Studio additions is [BC-LANG-001–005](spec/src/beancount-language.md).
Studio accepts editor conveniences such as lowercase Booleans, unquoted booking
methods, fenced query/plugin bodies, retained document markup, and compatible
`fava-option` / `ledger-option` directives. Output is normalized where the
language contract requires it.

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
