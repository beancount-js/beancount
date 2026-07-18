#!/usr/bin/env python3
"""Capture upstream Fava JSON API payloads for parity comparison."""

from __future__ import annotations

import json
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
CONFIG = json.loads((ROOT / "config.json").read_text())
OUT = ROOT / "out" / "fava"


def http_get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_ready(base: str, timeout: float = 30.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(base + "/", timeout=2) as response:
                if response.status in (200, 302):
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f"Fava did not become ready at {base}")


def discover_slug(base: str, preferred: str | None) -> str:
    if preferred:
        try:
            http_get(f"{base}/{preferred}/api/ledger_data")
            return preferred
        except Exception:
            pass
    with urllib.request.urlopen(base + "/", timeout=5) as response:
        final = response.geturl()
    parts = [p for p in urllib.parse.urlparse(final).path.split("/") if p]
    if not parts:
        raise RuntimeError(f"Could not discover ledger slug from {final}")
    return parts[0]


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def resolve_ledger_path(ledger: dict, fava_root: Path) -> Path:
    if ledger.get("root") == "repo":
        return (REPO_ROOT / ledger["path"]).resolve()
    return (fava_root / ledger["path"]).resolve()


def get_or_error(url: str) -> object:
    try:
        return http_get(url)
    except urllib.error.HTTPError as exc:
        return {
            "error": f"HTTP {exc.code}",
            "url": url,
            "body": exc.read().decode("utf-8", errors="replace"),
        }


def capture_ledger(base: str, ledger: dict, ledger_path: Path) -> None:
    slug = discover_slug(base, ledger.get("slug"))
    ledger_id = ledger["id"]
    ledger_out = OUT / ledger_id
    ledger_out.mkdir(parents=True, exist_ok=True)

    meta = {
        "ledgerId": ledger_id,
        "path": ledger["path"],
        "slug": slug,
        "favaCommit": CONFIG["favaCommit"],
        "absolutePath": str(ledger_path),
        "root": ledger.get("root", "fava"),
    }
    write_json(ledger_out / "meta.json", meta)

    ledger_data = http_get(f"{base}/{slug}/api/ledger_data")
    write_json(ledger_out / "ledger_data.json", ledger_data)

    for api in CONFIG.get("reportApis", []):
        write_json(
            ledger_out / "reports" / f"{api}.json",
            get_or_error(f"{base}/{slug}/api/{api}"),
        )

    accounts = CONFIG["accounts"]
    for account in accounts:
        for interval in CONFIG["intervals"]:
            for conversion in CONFIG["conversions"]:
                for report in ("balances", "changes"):
                    params = urllib.parse.urlencode(
                        {
                            "a": account,
                            "r": report,
                            "interval": interval,
                            "conversion": conversion,
                        }
                    )
                    url = f"{base}/{slug}/api/account_report?{params}"
                    payload = get_or_error(url)
                    name = (
                        f"account_report__{account.replace(':', '_')}__"
                        f"{report}__{interval}__{conversion}.json"
                    )
                    write_json(ledger_out / "accounts" / name, payload)

        params = urllib.parse.urlencode({"account": account})
        url = f"{base}/{slug}/api/journal?{params}"
        name = f"journal__{account.replace(':', '_')}.json"
        write_json(ledger_out / "journals" / name, get_or_error(url))

    queries = list(CONFIG["queries"])
    for item in ledger_data.get("data", {}).get("user_queries", []) or []:
        name = item.get("name")
        query_string = item.get("query_string") or item.get("queryString")
        if name and query_string:
            queries.append({"id": f"saved__{name}", "query": query_string})

    for item in queries:
        params = urllib.parse.urlencode({"query_string": item["query"]})
        url = f"{base}/{slug}/api/query?{params}"
        write_json(ledger_out / "queries" / f"{item['id']}.json", get_or_error(url))


def main() -> int:
    fava_root = (ROOT / CONFIG["favaUpstreamPath"]).resolve()
    if not fava_root.exists():
        print(f"Missing Fava upstream at {fava_root}", file=sys.stderr)
        return 1

    host = CONFIG["host"]
    port = CONFIG["port"]
    base = f"http://{host}:{port}"
    OUT.mkdir(parents=True, exist_ok=True)

    for ledger in CONFIG["ledgers"]:
        ledger_path = resolve_ledger_path(ledger, fava_root)
        if not ledger_path.exists():
            print(f"Missing ledger {ledger_path}", file=sys.stderr)
            return 1

        proc = subprocess.Popen(
            [
                "fava",
                "-p",
                str(port),
                "-H",
                host,
                "--read-only",
                str(ledger_path),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            wait_ready(base)
            print(f"Capturing Fava oracle for {ledger['id']}…")
            capture_ledger(base, ledger, ledger_path)
        finally:
            proc.send_signal(signal.SIGTERM)
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)

    print(f"Wrote Fava captures under {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
