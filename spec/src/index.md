# Beancount Studio specification

This book is the canonical product specification for Beancount Studio. It
defines the supported Beancount language extensions, accounting behavior,
application experience, ingestion services, hosts, catalog, and the governance
that keeps implementation and requirements aligned.

The specification covers active product behavior rather than every exported
API. Requirements use stable `BC-*` identifiers. Their implementation status
and concrete source or test evidence live in [Verification](verification.md).

## Reading this specification

- [Application baseline](app-baseline.md) defines package and runtime ownership.
- [Beancount language](beancount-language.md) separates upstream-compatible
  behavior from Studio additions.
- Product chapters define user-visible accounting, UI, ingestion, and host
  behavior.
- [Specification governance](spec-governance.md) defines how changes remain
  spec-first and enforced.

The published Storybook mirrors these Markdown chapters. The files under
`spec/src` remain authoritative.
