import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { UPSTREAM_COMMIT } from "../src/parity/manifest";

const source = process.env.BEANCOUNT_ORACLE_INPUT;
const destination = process.env.BEANCOUNT_ORACLE_OUTPUT;
const checkout = process.env.BEANCOUNT_UPSTREAM_CHECKOUT;
const python = process.env.BEANCOUNT_ORACLE_PYTHON ?? "python3";

if (!source || !destination || !checkout) {
  throw new Error(
    "Set BEANCOUNT_ORACLE_INPUT, BEANCOUNT_ORACLE_OUTPUT, and BEANCOUNT_UPSTREAM_CHECKOUT to refresh a fixture.",
  );
}

const upstreamCheckout = resolve(checkout);
if (!existsSync(upstreamCheckout)) {
  throw new Error(`Upstream checkout does not exist: ${upstreamCheckout}`);
}

const checkoutCommit = execFileSync(
  "jj",
  ["--color=never", "--no-pager", "log", "-r", "@-", "--no-graph", "-T", "commit_id"],
  { cwd: upstreamCheckout, encoding: "utf8" },
).trim();
if (checkoutCommit !== UPSTREAM_COMMIT) {
  throw new Error(
    `Upstream checkout must have ${UPSTREAM_COMMIT} at @-; found ${checkoutCommit || "nothing"}.`,
  );
}

execFileSync(
  python,
  [
    new URL("./upstream-oracle.py", import.meta.url).pathname,
    "--input",
    resolve(source),
    "--output",
    resolve(destination),
    "--commit",
    UPSTREAM_COMMIT,
  ],
  { cwd: upstreamCheckout, stdio: "inherit" },
);
console.info(`Wrote canonical oracle fixture: ${resolve(destination)}`);
