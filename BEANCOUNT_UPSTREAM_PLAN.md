# Beancount Upstream Runtime-Parity Plan

Status: in progress  
Audit date: 2026-07-15  
Implementation started: 2026-07-16  
Licensing decision: GPL-2.0-only port authorized 2026-07-16  
Local package: `@beancount-js/beancount`  
Upstream repository: <https://github.com/beancount/beancount>  
Pinned upstream baseline: [`a3cb3fd9f946d6213dd350fb87709a8ef198301d`](https://github.com/beancount/beancount/tree/a3cb3fd9f946d6213dd350fb87709a8ef198301d/beancount)

## 1. Objective

Bring the JavaScript runtime into behavioral alignment with the pinned upstream
Beancount implementation while retaining idiomatic TypeScript APIs and the
browser/server-neutral architecture of this repository.

The result should parse, book, transform, validate, query, and render the same
ledger semantics as upstream for the runtime surface in scope. Equivalent input
must produce equivalent directives, balances, options, prices, errors, and
plugin effects after normalizing representation differences such as camelCase,
`DateTime`, `Decimal`, `Map`, and `Set`.

This plan deliberately separates behavioral parity from literal source or API
parity. Existing TypeScript names and models remain valid unless a documented
semantic correction requires a change.

## 2. Scope and decisions

### In scope

- Core accounting primitives and helpers under upstream `beancount/core`.
- Parsing, booking, printing, contextual errors, option handling, and loading.
- Runtime operations under `beancount/ops`.
- Official ledger plugins under `beancount/plugins`.
- Browser-safe and server-safe adaptations for includes and document discovery.
- Tests and fixtures needed to demonstrate parity with the pinned commit.
- Integration regression coverage for Fava, Beanquery, and the sample ledger
  where core behavior changes affect them.

### Out of scope

- Python-specific scripts such as `bean-check`, `bean-doctor`, `bean-example`,
  and `bean-format`.
- `beancount/projects`, `beancount/tools`, Python test helpers, parser source
  hashing, pickle caches, encryption, `PYTHONPATH` mutation, and dependency
  inspection.
- Literal reproduction of the upstream C lexer/parser architecture. The current
  Lezer/document parser may remain if its observable behavior matches.
- Beanquery language parity with the separate upstream Beanquery project.
- New Fava features or visual redesigns.
- Snake_case compatibility aliases for upstream Python functions.

### Fixed implementation decisions

- Use behavioral parity and camelCase TypeScript names.
- Pin the audit and fixtures to upstream commit
  `a3cb3fd9f946d6213dd350fb87709a8ef198301d`; do not silently track rolling
  `master`.
- Preserve all existing public APIs where possible. Additive exports are
  preferred to renames or model replacements.
- Keep loading synchronous. Filesystem-like behavior must be supplied through
  bounded capability interfaces rather than direct Node imports in the core
  package.
- Keep normal CI independent of Python and network access. Python is only used
  by an explicit fixture-refresh workflow.

## 3. Licensing precondition

Upstream declares
[`GPL-2.0-only`](https://github.com/beancount/beancount/blob/a3cb3fd9f946d6213dd350fb87709a8ef198301d/pyproject.toml#L28),
while `packages/beancount/package.json` currently declares MIT. A direct
translation of upstream implementation code or tests must not proceed under the
current package metadata without resolving this mismatch.

This implementation treats `@beancount-js/beancount` as a true GPL-2.0-only
port. Owner authorization was received on 2026-07-16. The package must:

1. Add the GPL-2.0-only license text and upstream attribution before
   upstream-derived code or test translations are committed.
2. Mark upstream-derived packages and distributed combinations accurately.
3. Preserve copyright and permissive-license notices for independently created
   or third-party code.
4. Review the license of the final browser/server distribution before release.

If GPL treatment is rejected, stop and replace this plan with a clean-room
compatibility plan. Do not mix a clean-room approach with direct upstream test
or source translation. The
[FSF GPL FAQ](https://www.gnu.org/licenses/old-licenses/gpl-2.0-faq.html) is
general guidance and not legal advice.

## 4. Audit baseline

At the end of the audit:

- `pnpm --filter @beancount-js/beancount test:run` passed.
- The package had 10 passing test files and 68 passing tests.
- The full monorepo test run passed.
- No coverage provider or enforced coverage threshold existed.
- Upstream contained 967 named test methods in the included areas:
  - core: 285;
  - operations: 136;
  - parser/booking: 479;
  - official plugins: 67.

These figures are an inventory, not a requirement to create 967 separate
Vitest blocks. Parameterized tests and canonical fixtures may represent many
upstream scenarios, but every included upstream scenario must be classified in
the parity manifest.

### Local source files without direct tests at audit time

- Core: `account`, `conversion`, `convert`, `data`, `inventory`, `map`,
  `options`, `position`, `prices`, and `realization`.
- Runtime: plugin orchestration, booking, and booking methods.
- Plugins: `autoaccount`, `budget`, `creditcard`, and `forecast`.

The app-specific filter package and Beanquery SQL logic have useful tests, but
they do not substitute for accounting-engine parity tests.

## 5. Gap inventory

### 5.1 Core account and option behavior

Implement or behaviorally cover the following upstream capabilities:

- Account validation: valid root, valid leaf, and complete account names.
- Account manipulation: join, split, parent, leaf, root, remove root,
  component membership, common prefix, parent iteration, tree walking, and
  parent matchers.
- Configurable account roots rather than hard-coded
  `Assets|Liabilities|Equity|Income|Expenses` matching.
- Account-type classification: root, balance-sheet, income-statement, equity,
  inverted-sign, normal balance sign, and stable sort keys.
- All upstream public option defaults and validators.
- Deprecated option aliases must resolve to their canonical option without
  changing ledger meaning.

Correct option differences found during the audit:

- Add `display_precision`, a display context, `tolerance_multiplier`, and
  `use_precise_interpolation`.
- Continue accepting `inferred_tolerance_multiplier` as the deprecated alias.
- Make `account_rounding` nullable and disabled by default.
- Treat `insert_pythonpath` as a parsed boolean compatibility option with no
  runtime effect in JavaScript.
- Match upstream defaults for `title`, `render_commas`, and the unrealized
  gains leaf.
- Preserve repeated list options such as `operating_currency` rather than
  allowing a single string to fail schema validation.

### 5.2 Numbers, amounts, positions, and inventory

Add or complete:

- Automatic quantum inference and quantization helpers.
- Fractional-digit inference, rounding helpers, and same-sign semantics.
- Amount sorting and arithmetic behavior, including currency validation.
- Position parsing/formatting, total-cost detection, negative-at-cost behavior,
  stable sort keys, and constructors from strings or amounts.
- Inventory mixed-sign detection, currency pairs, only-position lookup,
  segregation, splitting, averaging, reductions, parsing/formatting, invariant
  checks, and exact lot matching.
- Clear handling for zero positions, absent numbers, absent currencies, and
  cost specifications versus resolved costs.

Inventory mutation must preserve these invariants:

- No stored zero position.
- A lot key uniquely represents units currency plus resolved cost identity.
- Reductions report whether a lot was created, augmented, reduced, or ignored.
- Copying an inventory cannot share mutable lot keys or balances accidentally.
- Average booking emits merge-marked postings and preserves total cost.

### 5.3 Data model helpers

Complete behavioral equivalents for:

- Metadata creation and source locations.
- Simple posting and costed-posting constructors.
- Runtime type sanity checking.
- Directive and posting sort keys.
- Finding the closest directive by date.
- Account-component searches and posting removal.
- Iterating entry ranges by date.
- Stable directive hashing and entry comparison/inclusion/exclusion.

Existing JS-only directive models for `option`, `include`, `plugin`, and code
blocks may remain. Their loader behavior must normalize to upstream options and
plugin semantics.

### 5.4 Conversion and price behavior

Complete the conversion API with behavioral equivalents of:

- `getUnits`, `getCost`, `getWeight`, and `getValue`.
- `convertPosition` and `convertAmount`, including optional intermediate
  currencies.
- Price-map construction, normalized base/quote input, all-price lookup,
  latest-price lookup, and dated lookup.
- Price projection from one quote currency to another without overwriting an
  explicit same-day price.

Correct known price-map divergences:

- Keep the last declaration on each date while retaining all distinct dates.
- Reconcile explicitly supplied inverse pairs by retaining the direction with
  more observations and synthesizing its inverse.
- Exclude zero rates from generated inverses.
- Return identity for same-currency conversion.
- Return the original amount when a conversion path is unavailable.

### 5.5 Realization and getters

Implement:

- General account extraction, entry-account extraction, tags, links, payees,
  account components, active years, minimum/maximum dates, open/close entries,
  commodity directives, and metadata-value collection.
- Realized account tree construction with optional minimum accounts.
- Depth-first child iteration and account filtering.
- Posting lookup, balance iteration, balance computation, last-active-posting
  lookup, and postings-by-account.
- Stable account-tree ordering for deterministic reports.

Dump/debug helpers may be represented by deterministic strings rather than
Python stream APIs.

### 5.6 Display context and distributions

Add display precision tracking and formatting behavior equivalent to upstream:

- Natural, right, and dot alignment modes.
- Per-currency inferred precision and fixed precision overrides.
- Optional thousands separators.
- Quantization through the display formatter.
- Distribution minimum, maximum, mode, merging, and empty behavior.

The current `Decimal` implementation remains the numeric foundation. Parity
fixtures must compare canonical decimal strings, never binary JavaScript
numbers.

### 5.7 Booking and interpolation

Booking is the highest-risk correction and must be completed before expanding
reports or plugins.

Correct known problems:

- Forward the requested booking method through `handleAmbiguousMatches`.
- Use the account `open` directive's method when present and the global option
  otherwise.
- Decrement the remaining amount during FIFO/LIFO/HIFO lot splitting.
- Attach the matched cost and append every matched lot.
- FIFO chooses oldest lots, LIFO newest lots, and HIFO highest-cost lots.
- Strict-with-size compares requested units with lot units, chooses the oldest
  exact-size lot, and clears the previous ambiguity error on success.
- Implement `AVERAGE` rather than falling back to `STRICT`.

Cover the full booking pipeline:

- Currency categorization and replacement.
- Self-reduction detection.
- Augmentations and reductions with partial cost specifications.
- Per-unit and total-cost interpolation.
- Missing units, costs, totals, currencies, and prices.
- Residual posting insertion and rounding accounts.
- Missing-value elimination after booking.
- Mixed inventory and negative-at-cost validation.
- Initial balances supplied by callers.
- Errors that retain the parent transaction and useful source context.

### 5.8 Parser, printer, options, and loader

Observable parser parity includes:

- Every directive form, metadata value, escaped string, number expression,
  cost form, price annotation, tag, link, pushed metadata, and pushed tag.
- Incomplete posting recognition for the booking stage.
- `parseString`, `parseOne`, and `parseMany` behavior through idiomatic JS
  entry points.
- Stable formatting for entries, postings, flags, metadata, source references,
  and errors.
- Context rendering around an entry or source line.
- Useful filename and line information for recursive includes.

Loader corrections:

- Sort entries before booking and pass the sorted result forward.
- Resolve includes relative to the containing file.
- Detect duplicate files and cycles without loading a file twice.
- Preserve deterministic include and source order.
- Aggregate options from the top-level file while recording all loaded files.
- Apply booking, pre-plugins, declared plugins, auto-plugins, post-plugins, and
  validation in upstream order.
- Preserve declaration order for repeated user plugins.
- Pass inline configuration or configured defaults exactly once.
- Convert unsupported plugins, invalid configurations, and thrown plugin
  exceptions into ledger errors instead of aborting the load.
- Support caller-supplied extra validations.
- Keep `plugin_processing_mode = raw` limited to declared plugins.

Do not add direct filesystem access to `@beancount-js/beancount`.

### 5.9 Operations

Implement the missing runtime operations:

- Basic operations: filter by tag/link, group by link, and common accounts.
- Transaction compression and merge behavior.
- Document discovery and document existence validation through an injected
  document capability.
- Finding currencies at cost, converted, explicitly priced, present in
  balances, and still unpriced.
- Commodity lifetimes, interval compression/trimming, and required daily or
  weekly price dates.
- Summarization `clamp` and `cap` variants.
- Validation of document paths and runtime data types.

Correct summarization so it retains the final historical price for every
base/quote pair from the original entries. Ensure `open`, `close`, `clear`,
`clamp`, `cap`, conversions, transfers, and generated balances preserve the
accounting equation.

### 5.10 Official plugins

Support the upstream module names and behavior for:

- `beancount.plugins.auto` as the auto-accounts plus implicit-prices composite.
- `auto_accounts` and `implicit_prices` individually.
- Average-cost, closing, commodity, drained-account, coherent-cost, leaf-only,
  duplicate, unused-account, one-commodity, sell-gains, and unique-price
  checks.
- Close-tree, commodity attributes, and currency-account transformations.
- The upstream pedantic plugin bundle.

Retain `budget`, `creditcard`, and `forecast` as JS extensions. Keep them out of
the upstream parity count and add focused regression tests for their registry
names, configuration contracts, output, and errors.

## 6. Public interface additions

All additions should be exported from the existing package root and relevant
subsystem indexes. Names remain camelCase.

### Core additions

- Account validation/manipulation functions and complete `AccountTypes`
  predicates.
- Conversion functions listed in section 5.4.
- Price projection and normalized price lookup methods.
- Realization construction, traversal, filtering, and posting helpers.
- Getter, comparison, display-context, and distribution APIs.
- Data construction and date-range helpers.

### Loader capability

Add a synchronous, environment-neutral capability resembling:

```ts
export interface ProjectDocument {
  path: string;
  contents?: string;
}

export interface DocumentStore {
  list(root: string): Iterable<ProjectDocument>;
  exists(path: string): boolean;
}
```

Expose the store through `LoadProps`. Browser callers should adapt the bounded
project source map. Server callers may adapt an allowed workspace directory.
Operations and plugins must not import Node filesystem modules directly.

### Options migration

- Add canonical upstream option fields and keep deprecated aliases accepted at
  the input boundary.
- Store only canonical fields in returned `BeancountOptions`.
- Preserve current JS representations when they are semantically equivalent,
  such as arrays for deterministic serialized sets.
- Do not change persisted ledger text or workspace schemas.

### Error compatibility

Keep the existing `LedgerError` contract. Add stable error codes or subclasses
only where needed to distinguish upstream categories. Every error must retain:

- a stable message;
- its category/code;
- filename and line when known;
- the relevant directive or transaction when known;
- plugin identity for plugin failures.

## 7. Parity manifest and oracle fixtures

Create a machine-readable parity manifest under the Beancount package. Each
record must contain:

```json
{
  "upstreamCommit": "a3cb3fd9f946d6213dd350fb87709a8ef198301d",
  "upstreamModule": "beancount.core.prices",
  "upstreamBehavior": "project",
  "localBehavior": "projectPrices",
  "status": "adapted",
  "tests": ["prices/project/basic", "prices/project/collision"],
  "reason": "Uses PriceMap and DateTime instead of Python tuples"
}
```

Allowed statuses:

- `matched`: the public behavior and representation both correspond closely.
- `adapted`: behavior matches but the JS interface or environment differs.
- `pending`: an in-scope module or behavior has been inventoried but is not yet
  demonstrated as matched or adapted; it must explain the remaining work.
- `excluded`: outside the scope in section 2, with a non-empty reason.

`unknown`, missing records, and included behaviors marked `excluded` must fail
the manifest validation. A completion audit must also fail while any `pending`
records remain; ordinary package checks permit them so incremental slices can
remain green without misrepresenting unimplemented work as parity.

The oracle fixture generator must:

1. Verify that the upstream checkout is at the pinned commit.
2. Run selected ledgers and direct API scenarios under upstream Python.
3. Serialize dates, decimals, sets, maps, directives, options, and errors into a
   stable JSON form.
4. Remove only documented representation noise, such as absolute temporary
   paths or timing output.
5. Write versioned fixtures for normal Vitest consumption.

Fixture refreshes require explicit review. Normal tests must never refresh
snapshots automatically.

The checked-in refresh wrapper requires `BEANCOUNT_UPSTREAM_CHECKOUT` to name a
JJ checkout whose `@-` commit is the pinned baseline. It runs an explicitly
selected Python executable (`BEANCOUNT_ORACLE_PYTHON`, default `python3`) and
only writes the fixture named by `BEANCOUNT_ORACLE_OUTPUT`. A scenario may
select a small set of canonical paths from a full upstream load result, keeping
reviewed fixtures focused on observable assertions instead of incidental option
or source-location noise.

## 8. Implementation sequence

### Phase 0: governance and harness

- Resolve the licensing precondition.
- Add the parity manifest, canonical serializer, fixture generator, and fixture
  comparison helpers.
- Record every in-scope upstream module and test file before implementing new
  behavior.
- Add the Vitest coverage provider and initial measured baseline without
  weakening the final thresholds.

Progress note (2026-07-16): GPL licensing and attribution are committed. The
pinned checkout's 57 in-scope runtime modules and 56 corresponding upstream
test modules are recorded in the manifest. Existing translated behavior is
marked `matched` or `adapted`; the source-aware context renderer, full printer
surface, and parser-build version behavior are explicitly `pending`, while
Python-only test helpers and native-parser source hashing are excluded under
section 2. The package now measures a V8 coverage baseline without thresholds;
thresholds will be added only after the scenario and fixture suite are
represented.

Exit criteria:

- Licensing is confirmed and represented accurately in the repository.
- The pinned upstream commit is machine-readable.
- One core fixture and one end-to-end loader fixture round-trip through the
  oracle and JS comparison.
- Every in-scope module is present in the manifest.

### Phase 1: existing critical paths

- Port/adapt upstream tests for amount, position, inventory, conversion,
  prices, interpolation, booking methods, booking, loader, pad, balance,
  summarize, and validation.
- Fix the known booking, price, sorting, options, and summarization divergences.
- Do not add large missing plugin families until these foundations pass.

Exit criteria:

- All booking modes and interpolation scenarios match oracle fixtures.
- Inventory and price-map invariants pass property and example tests.
- The complete loader pipeline has deterministic output and error ordering.

### Phase 2: remaining core surface

- Complete account, account types, numeric helpers, data helpers, comparisons,
  display context, distributions, getters, conversions, and realization.
- Export the new APIs without removing existing exports.
- Update dependent Beanquery/report code only where corrected semantics require
  it.

Exit criteria:

- All upstream core scenarios are `matched` or `adapted`.
- No in-scope core source file lacks direct tests.
- Existing Fava financial reports render the sample ledger without runtime
  errors.

### Phase 3: parser and operations

- Complete parser/formatter/error-context parity through the current parser
  architecture.
- Add missing basic, compression, document, price-discovery, lifetime,
  summarization, and validation operations.
- Add `DocumentStore` adapters for bounded browser projects and the server
  workspace.

Exit criteria:

- Parser fixtures cover all upstream directive and option scenario families.
- Operation outputs and errors match canonical fixtures.
- Browser builds contain no accidental Node filesystem dependency.

### Phase 4: official plugins

- Implement plugins in dependency order: auto accounts, implicit prices, auto
  composite, validation-only plugins, then transforming plugins.
- Register standard upstream names and pedantic composition.
- Retain and test the JS extension plugins.

Progress note (2026-07-16): The named upstream plugin modules are now ported,
exported, and registered under their standard names: auto accounts, implicit
prices, auto, close-tree, closing, drained-account, commodity declaration and
attribute checks, coherent-cost, leaf-only, duplicate, unused-account,
one-commodity, average-cost, sell-gains, unique-price, currency-account, and
the pedantic bundle. Each implementation has upstream-derived regression
coverage and a parity-manifest record. The loader integration suite now covers
default/raw ordering, duplicate declarations, configuration propagation, and
thrown plugin errors, satisfying the Phase 4 exit criteria.

Exit criteria:

- Every official plugin test family is represented in the manifest.
- Default/raw processing, duplicate declarations, configuration, ordering, and
  plugin exception behavior pass integration tests.

### Phase 5: integration and release readiness

- Run differential fixtures over representative multi-file ledgers.
- Exercise the sample ledger through loading, reports, Beanquery, editing, and
  server/browser workspace adapters.
- Document corrected behaviors and any intentional JS adaptations.
- Complete license and distribution review.

Completion audit (2026-07-16): the 60-record parity manifest is complete, the
package coverage gate passes, and booking, inventory, prices, and loader each
meet the dedicated 95% branch threshold. The root `pnpm test`, `pnpm build`,
and `pnpm test:e2e` commands pass. Root `pnpm checks` stops first on 27
pre-existing Fava formatting violations. When invoked directly, the subsequent
Fava Svelte check reports 209 cross-package type errors and 9 warnings in this
rebased workspace. The plan is therefore not marked fully complete until that
separate application-quality gate is resolved.

Exit criteria are the definition of done in section 11.

## 9. Test plan

### Unit and parameterized tests

Cover at minimum:

- Account syntax, configurable roots, traversal, classification, and signs.
- Decimal precision, quantization, amount arithmetic, and formatting.
- Cost specifications, positions, inventory matching, averaging, and copies.
- Direct, inverse, projected, dated, zero, identity, and missing prices.
- All directive models, metadata types, sort order, filters, and hashes.
- Realization trees, balances, account filtering, getters, and dates.
- Every booking method and all missing/interpolated posting components.
- Every operation and official plugin.
- Option defaults, aliases, invalid values, and repeated options.

### Differential fixtures

Include:

- Minimal ledgers for each directive.
- Multi-currency transactions with costs and prices.
- Ambiguous inventory reductions for every booking method.
- Rounding, residual, padding, and balance failures.
- Historical prices, inverse pairs, projections, and missing conversions.
- Summarization at period boundaries.
- Multi-file includes, duplicate includes, missing files, and cycles.
- Plugin ordering, configuration, generated directives, and failures.
- Documents and commodity lifetimes through injected adapters.

### Property tests

Add deterministic property tests for:

- Inventory plus its negation is empty.
- Splitting then recombining an inventory preserves positions.
- Average booking preserves units and total cost.
- Generated inverse prices multiply to one when the source rate is non-zero.
- Directive sorting is stable and idempotent.
- Formatting and reparsing a complete directive preserves canonical data.
- Generated pad, summarize, transfer, and conversion entries balance.

### Integration tests

- `loadString` with default and raw processing modes.
- `loadProjectSources` with nested relative includes.
- Browser and server document adapters.
- Sample ledger loading with zero unexpected errors.
- Financial statements, holdings, statistics, journal, and account views after
  corrected core semantics.
- Beanquery queries over booked postings and realized balances.

## 10. Quality gates

Add package coverage thresholds for `@beancount-js/beancount`:

- statements: 90%;
- lines: 90%;
- functions: 90%;
- branches: 85%.

Require at least 95% branch coverage for booking, inventory, prices, and loader
transformations. Generated parser artifacts, type declarations, and fixture
generators may be excluded; handwritten runtime code may not be excluded merely
to meet the threshold.

Required validation commands:

```bash
pnpm checks
pnpm test
pnpm build
pnpm test:e2e
```

Also add dedicated commands resembling:

```bash
pnpm --filter @beancount-js/beancount test:coverage
pnpm --filter @beancount-js/beancount parity:check
pnpm --filter @beancount-js/beancount parity:refresh
```

`parity:refresh` is manual and may require Python plus a pinned upstream
checkout. `parity:check` is hermetic and must run in CI.

## 11. Definition of done

The alignment effort is complete only when:

- The license and attribution strategy is approved and implemented.
- The parity manifest contains every in-scope upstream public behavior and test
  scenario family.
- Every in-scope manifest item is `matched` or `adapted`; exclusions correspond
  only to section 2.
- Canonical JS outputs have zero unexplained differences from all committed
  upstream oracle fixtures.
- All booking methods, operations, and official plugins are implemented and
  registered.
- All option defaults, aliases, transformation ordering, and error categories
  match the pinned baseline behavior.
- Coverage gates pass without suppressing handwritten runtime files.
- `pnpm checks`, `pnpm test`, `pnpm build`, and `pnpm test:e2e` pass.
- The sample ledger and representative multi-file ledgers load in browser and
  server modes without unexpected errors.
- Fava and Beanquery regression suites pass with corrected runtime output.
- Documentation identifies the pinned upstream commit, intentional JS
  adaptations, extension plugins, and the process for the next upstream audit.

## 12. Future upstream synchronization

After completing this plan, upstream updates should be deliberate audits rather
than automatic merges:

1. Select and record a new upstream commit.
2. Diff upstream runtime modules and tests against the previous pinned commit.
3. Add new behaviors and tests to the parity manifest as `pending` in an audit
   branch.
4. Classify and implement them before changing the pinned production baseline.
5. Regenerate only affected fixtures and review semantic differences.
6. Record the completed audit date and commit in this document or its successor.

This keeps the JavaScript fork reproducible while allowing intentional progress
with upstream Beancount.
