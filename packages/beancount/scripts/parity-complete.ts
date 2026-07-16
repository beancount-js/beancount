import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  type ParityManifest,
  validateParityCompletion,
} from "../src/parity/manifest";

const manifestPath = fileURLToPath(
  new URL("../src/parity/manifest.json", import.meta.url),
);
const manifest = JSON.parse(
  readFileSync(manifestPath, "utf8"),
) as ParityManifest;
const errors = validateParityCompletion(manifest);

if (errors.length > 0) {
  throw new Error(`Parity completion audit failed:\n- ${errors.join("\n- ")}`);
}

console.info(
  `Parity completion audit passed for ${manifest.upstreamCommit} (${manifest.records.length} records).`,
);
