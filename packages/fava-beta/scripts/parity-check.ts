import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  validateParityManifest,
  type ParityManifest,
} from "../src/parity/manifest";

const manifestPath = fileURLToPath(
  new URL("../src/parity/manifest.json", import.meta.url),
);
const manifest = JSON.parse(
  readFileSync(manifestPath, "utf8"),
) as ParityManifest;
const errors = validateParityManifest(manifest);

if (errors.length > 0) {
  throw new Error(`Fava parity manifest failed:\n- ${errors.join("\n- ")}`);
}

console.info(
  `Fava parity manifest is valid for ${manifest.upstreamCommit} (${manifest.records.length} records).`,
);
