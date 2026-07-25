import { fileURLToPath } from "node:url";

/**
 * Load Visual Delta from the linked source package, not the installed package
 * entry. This mirrors HOME/ui so Storybook manager/preview edits in the
 * reference source are picked up without rebuilding dist.
 */
const addonEntry = (entry: "manager" | "preview") =>
  fileURLToPath(import.meta.resolve(`storybook-addon-visual-delta/${entry}`));

export function previewAnnotations(entry: string[] = []) {
  return [...entry, addonEntry("preview")];
}

export function managerEntries(entry: string[] = []) {
  return [...entry, addonEntry("manager")];
}

export {
  staticDirs,
  viteFinal,
  webpack,
} from "storybook-addon-visual-delta/preset";
