# Beancount UI catalog

Reusable Beancount application components backed by published Design Core 0.3.1. The original Fava application remains the comparison application.

Run `pnpm storybook` from the repository root. The catalog binds to `127.0.0.1:6006`; Fava runs independently on 5173. Stories own deterministic, disposable controller instances and do not access a server or browser storage.

Consumers import `BeancountApplication` from `@beancount-js/ui`, controllers from `@beancount-js/ui/controller`, and `@beancount-js/ui/styles.css` once. Hosts supply a `BeancountController`, initialize it and dispose it when their application is destroyed. The application owns its Design Core shell controller.

Run `pnpm --filter @beancount-js/ui checks` for dependency boundaries, types, unit tests, Storybook interactions/accessibility and the static build. Source provenance is recorded in `UI_PROVENANCE.json`.

Ingestion stories use an isolated service adapter for source configuration, merchant profiles, rule previews/application, sync events and import acceptance. Accepting a fixture import writes balanced postings to the in-memory ledger with file revision protection; it never contacts a bank. API-backed presentation uses the host controller's request adapter. Import and settings state belongs to each controller instance.

The assistant is composed in the Design Core right sidebar. Desktop and mobile controls use the shell controller, and editor selections open that panel. The catalog streams a deterministic title proposal through the same event parser used by production; keep performs a revision-aware file save, undo leaves the file unchanged, and clear resets the project chat. Hosts supply their own AI endpoint through `BeancountDataSource.request`.
