import {
  Transaction,
  loadProjectSources,
  type DirectiveBase,
} from "@beancount-js/beancount";
import {
  normalizeMerchant,
  type MerchantCandidate,
} from "@beancount-js/beangulp";
import type { FilesystemMerchantStore } from "./merchant";

export type LedgerFileSnapshot = {
  path: string;
  contents: string;
};

export type MerchantBackfillResult = {
  files: LedgerFileSnapshot[];
  createdProfiles: number;
  patchedTransactions: number;
  skipped: number;
};

type FilePatch = {
  from: number;
  to: number;
  original: string;
  next: string;
};

function metaString(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function transactionLabel(txn: Transaction) {
  return (
    metaString(txn.meta, "merchant_raw") ||
    txn.payee?.trim() ||
    txn.narration?.trim() ||
    undefined
  );
}

function serializeDirective(directive: DirectiveBase, original: string) {
  let next = directive.toString();
  if (original.endsWith("\n") && !next.endsWith("\n")) {
    next += "\n";
  } else if (!original.endsWith("\n") && next.endsWith("\n")) {
    next = next.slice(0, -1);
  }
  return next;
}

function applyPatches(contents: string, patches: readonly FilePatch[]) {
  const sorted = [...patches].sort((a, b) => b.from - a.from);
  let next = contents;
  for (const patch of sorted) {
    if (next.slice(patch.from, patch.to) !== patch.original) {
      throw new Error(
        "A ledger record changed while backfilling merchants. Reload and retry.",
      );
    }
    next = `${next.slice(0, patch.from)}${patch.next}${next.slice(patch.to)}`;
  }
  return next;
}

/**
 * Create merchant profiles for imported ledger transactions that lack
 * merchant_id, and patch those transactions with the new ids.
 */
export async function backfillMerchantsFromLedger(options: {
  projectId: string;
  entryFile: string;
  files: readonly LedgerFileSnapshot[];
  merchants: FilesystemMerchantStore;
}): Promise<MerchantBackfillResult> {
  const { projectId, entryFile, merchants } = options;
  const files = options.files.map((file) => ({ ...file }));
  const [directives] = loadProjectSources(
    entryFile,
    files.map((file) => ({ path: file.path, contents: file.contents })),
  );

  const profileByKey = new Map<string, string>();
  let createdProfiles = 0;
  let patchedTransactions = 0;
  let skipped = 0;

  async function merchantIdFor(label: string, sourceId: string) {
    const key = `${sourceId}\0${normalizeMerchant(label)}`;
    const cached = profileByKey.get(key);
    if (cached) return cached;

    const existing = await merchants.resolve(projectId, sourceId, label);
    if (existing?.status === "confirmed") {
      profileByKey.set(key, existing.merchant.merchantId);
      return existing.merchant.merchantId;
    }

    const candidate: MerchantCandidate = {
      id: `backfill:${normalizeMerchant(label)}`,
      canonicalName: label,
      explanation: "Merchant profile backfilled from an imported ledger entry.",
      provenance: [
        { source: "manual", observedAt: new Date().toISOString() },
      ],
    };
    const merchant = await merchants.confirm(projectId, {
      sourceId,
      rawLabel: label,
      candidate,
    });
    createdProfiles += 1;
    profileByKey.set(key, merchant.merchantId);
    return merchant.merchantId;
  }

  const patchesByPath = new Map<string, FilePatch[]>();

  for (const directive of directives) {
    if (!(directive instanceof Transaction)) continue;
    const importId = metaString(directive.meta, "import_id");
    if (!importId) continue;
    if (metaString(directive.meta, "merchant_id")) continue;

    const label = transactionLabel(directive);
    const entry = directive.source;
    const path = metaString(directive.meta, "filename");
    if (!label || !entry || !path) {
      skipped += 1;
      continue;
    }

    try {
      const sourceId =
        metaString(directive.meta, "import_source") || "import";
      const merchantId = await merchantIdFor(label, sourceId);
      const nextMeta = {
        ...directive.meta,
        merchant_id: merchantId,
        merchant_resolution_method:
          metaString(directive.meta, "merchant_resolution_method") || "manual",
      };
      const rewritten = serializeDirective(
        directive.copy({ meta: nextMeta }),
        entry.content,
      );
      const list = patchesByPath.get(path) ?? [];
      list.push({
        from: entry.position.from,
        to: entry.position.to,
        original: entry.content,
        next: rewritten,
      });
      patchesByPath.set(path, list);
      patchedTransactions += 1;
    } catch {
      skipped += 1;
    }
  }

  const nextFiles = files.map((file) => {
    const patches = patchesByPath.get(file.path);
    if (!patches?.length) return file;
    return {
      path: file.path,
      contents: applyPatches(file.contents, patches),
    };
  });

  return {
    files: nextFiles,
    createdProfiles,
    patchedTransactions,
    skipped,
  };
}
