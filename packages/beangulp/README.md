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
