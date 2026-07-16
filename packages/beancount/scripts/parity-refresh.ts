import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { canonicalJson } from "../src/parity/canonical";
import { UPSTREAM_COMMIT } from "../src/parity/manifest";

const source = process.env.BEANCOUNT_ORACLE_INPUT;
const destination = process.env.BEANCOUNT_ORACLE_OUTPUT;

if (!source || !destination) {
  throw new Error(
    "Set BEANCOUNT_ORACLE_INPUT and BEANCOUNT_ORACLE_OUTPUT to refresh a fixture.",
  );
}

const fixture = JSON.parse(readFileSync(source, "utf8")) as {
  upstream?: { commit?: string };
};
if (fixture.upstream?.commit !== UPSTREAM_COMMIT) {
  throw new Error(`Oracle input must be generated from ${UPSTREAM_COMMIT}.`);
}

const output = resolve(destination);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${canonicalJson(fixture)}\n`);
console.info(`Wrote canonical oracle fixture: ${output}`);
