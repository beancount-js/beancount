# beangulp

`@beancount-js/beangulp` is the runtime-neutral ingestion layer for Beancount
Studio. It reads a source, normalizes its records, produces explainable category
suggestions, detects duplicates, and renders explicitly reviewed proposals as
Beancount transactions. It never writes a ledger or persists provider secrets.

The first source plugin is `JsonApiSource`. A Studio server source uses a token
reference rather than a token value:

```json
{
  "id": "bank",
  "name": "My bank",
  "kind": "json-api",
  "sourceAccount": "Assets:Bank:Checking",
  "defaultCurrency": "GBP",
  "api": {
    "endpoint": "https://api.example.com/transactions",
    "allowedHosts": ["api.example.com"],
    "secretRef": "env:BANK_API_TOKEN",
    "recordsPath": "transactions",
    "pagination": {
      "cursorQueryParam": "cursor",
      "nextCursorPath": "next_cursor"
    }
  },
  "mapping": {
    "id": "id",
    "date": "booked_at",
    "amount": "amount.value",
    "currency": "amount.currency",
    "merchant": "merchant.name"
  },
  "rules": [{ "merchant": "Tesco", "account": "Expenses:Food:Groceries" }]
}
```

`JsonApiSource` permits HTTPS endpoints (or localhost HTTP for development),
uses the optional host allowlist, passes the token only as an Authorization
header, follows cursor pagination, retries transient failures, and bounds pages
and records. The Studio server resolves `env:BANK_API_TOKEN` only while a run is
executing; it persists the reference, normalized run, and audit information, not
the token or raw API payload.

Suggestions are ordered by manual choice, merchant rule, ledger history,
recurring-pattern evidence, then optional AI. AI is a `CategorizerPlugin`; it
receives only the normalized transaction, the allowed account list, and the
already-derived evidence. The caller must review a proposal before rendering it
to Beancount.

## Detection rules and AI actions

Detection rules are evaluated in their stored order. During ingestion, later
rules see the transaction changes made by earlier rules; when two rules write a
single-value field such as category, merchant, or narration, the later rule
wins. The same ordering applies to manual bulk runs from **Settings → Rules**.

Manual runs always require a target:

- **Live ledger** is the default and changes the checked-in ledger files.
- **Pending imports** changes only reviewable import proposals.
- **Both** is explicit because those are two independent stores.

Bulk runs plan all selected rules against one snapshot, show unique matching
records separately from rule overlaps, validate the complete prospective ledger
before writing, and write each changed ledger file once. Run history records
the selected target plus queued, processed, and modified counts for each target.

Rules may also use **Auto-categorise transactions with AI** and
**Auto-detect merchants with AI** actions. A preview never invokes an AI
provider. On apply, matching records for one AI action are sent in bounded,
structured batches (up to 25 records per request, with up to two batches in
flight), then validated results are merged into the planned change set. This
keeps AI actions compatible with ingestion batching and avoids one model call
per transaction. Existing source-level AI settings continue to work; adding an
AI rule action scopes rule-driven AI enrichment to that rule's matches.
