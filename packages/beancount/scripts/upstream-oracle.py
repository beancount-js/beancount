#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Steve Juma
"""Generate reviewed canonical fixtures with a pinned Beancount checkout.

This script deliberately has no dependency on the JavaScript implementation.
It executes the installed upstream Python package and serializes only stable,
ledger-visible values. It is invoked by ``parity-refresh.ts``; normal tests
consume its checked-in JSON output and never invoke Python.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime
import decimal
import enum
import json
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from beancount import loader
from beancount.core import prices
from beancount.parser import printer


def canonicalize(value: Any, fixture_root: Path | None = None) -> Any:
    """Convert upstream runtime objects to deterministic JSON-compatible values."""
    if value is None or isinstance(value, (bool, int, float, str)):
        if isinstance(value, str) and fixture_root:
            return value.replace(str(fixture_root), "<fixture>")
        return value
    if isinstance(value, decimal.Decimal):
        return {"$decimal": str(value)}
    if isinstance(value, datetime.date):
        return {"$date": value.isoformat()}
    if isinstance(value, enum.Enum):
        return {"$enum": f"{type(value).__name__}.{value.name}"}
    if isinstance(value, set | frozenset):
        values = [canonicalize(item, fixture_root) for item in value]
        return {"$set": sorted(values, key=canonical_json)}
    if isinstance(value, Mapping):
        items = [
            [canonicalize(key, fixture_root), canonicalize(item, fixture_root)]
            for key, item in value.items()
        ]
        if all(isinstance(key, str) for key, _ in items):
            return {key: item for key, item in sorted(items)}
        return {"$map": sorted(items, key=lambda item: canonical_json(item[0]))}
    if hasattr(value, "_asdict"):
        return {
            "$type": type(value).__name__,
            **canonicalize(value._asdict(), fixture_root),
        }
    if dataclasses.is_dataclass(value):
        return {
            "$type": type(value).__name__,
            **canonicalize(dataclasses.asdict(value), fixture_root),
        }
    if isinstance(value, tuple | list):
        return [canonicalize(item, fixture_root) for item in value]
    return {"$repr": str(value), "$type": type(value).__name__}


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def load_string(scenario: Mapping[str, Any]) -> Mapping[str, Any]:
    entries, errors, options = loader.load_string(scenario["ledger"])
    result = {"entries": entries, "errors": errors}
    if scenario.get("includeOptions"):
        result["options"] = options
    return result


def load_sources(scenario: Mapping[str, Any]) -> tuple[Mapping[str, Any], Path]:
    fixture_root = Path(tempfile.mkdtemp(prefix="beancount-oracle-"))
    for relative_path, content in scenario["sources"].items():
        source = fixture_root / relative_path
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text(content, encoding="utf-8")
    entries, errors, options = loader.load_file(fixture_root / scenario["entryFile"])
    result = {"entries": entries, "errors": errors}
    if scenario.get("includeOptions"):
        result["options"] = options
    return result, fixture_root


def last_price_entries(scenario: Mapping[str, Any]) -> Mapping[str, Any]:
    entries, errors, _ = loader.load_string(scenario["ledger"])
    assertions = []
    for as_of in scenario["asOf"]:
        price_entries = prices.get_last_price_entries(
            entries, datetime.date.fromisoformat(as_of)
        )
        assertions.append(
            {
                "asOf": as_of,
                "prices": [
                    {
                        "date": entry.date.isoformat(),
                        "currency": entry.currency,
                        "units": str(entry.amount.number),
                        "quote": entry.amount.currency,
                    }
                    for entry in price_entries
                ],
            }
        )
    return {"errors": errors, "assertions": assertions}


def format_transaction(scenario: Mapping[str, Any]) -> Mapping[str, Any]:
    entries, errors, options = loader.load_string(scenario["ledger"])
    index = scenario.get("entryIndex", 0)
    return {
        "errors": errors,
        "text": printer.format_entry(
            entries[index], options["dcontext"], scenario.get("renderWeights", False)
        ),
    }


def run_scenario(scenario: Mapping[str, Any]) -> Any:
    operation = scenario.get("operation")
    if operation == "load_string":
        result = canonicalize(load_string(scenario))
    elif operation == "load_sources":
        result, fixture_root = load_sources(scenario)
        result = canonicalize(result, fixture_root)
    elif operation == "last_price_entries":
        result = canonicalize(last_price_entries(scenario))
    elif operation == "format_transaction":
        result = canonicalize(format_transaction(scenario))
    else:
        raise ValueError(f"Unsupported upstream oracle operation: {operation!r}")

    selections = scenario.get("select")
    if selections is None:
        return result
    selected = {}
    for name, path in selections.items():
        if path == ["$open_accounts"]:
            value = [
                entry["account"]
                for entry in result["entries"]
                if entry["$type"] == "Open"
            ]
        else:
            value = result
            for key in path:
                value = value[key]
        selected[name] = value
    return selected


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()

    fixture = json.loads(args.input.read_text(encoding="utf-8"))
    if fixture.get("upstream", {}).get("commit") != args.commit:
        raise ValueError(f"Fixture must name upstream commit {args.commit}")
    if "scenario" not in fixture:
        raise ValueError("Fixture must contain an upstream oracle scenario")

    fixture["oracle"] = run_scenario(fixture["scenario"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fixture, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
