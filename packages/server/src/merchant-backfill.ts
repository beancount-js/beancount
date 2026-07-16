import {
  Transaction,
  loadProjectSources,
  type DirectiveBase,
} from "@beancount-js/beancount";
import { normalizeMerchant } from "@beancount-js/beangulp";
import type { FilesystemMerchantStore } from "./merchant";
import { hasMerchantCatalogData } from "./merchant-persist";

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

export type MerchantPruneResult = {
  files: LedgerFileSnapshot[];
  removedProfiles: number;
  clearedTransactions: number;
};

type FilePatch = {
  from: number;
  to: number;
  original: string;
  next: string;
};

const MERCHANT_META_KEYS = [
  "merchant_id",
  "merchant_domain",
  "merchant_resolution_method",
] as const;

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
        "A ledger record changed while updating merchants. Reload and retry.",
      );
    }
    next = `${next.slice(0, patch.from)}${patch.next}${next.slice(patch.to)}`;
  }
  return next;
}

function withoutMerchantMeta(meta: Record<string, unknown>) {
  const next = { ...meta };
  for (const key of MERCHANT_META_KEYS) {
    delete next[key];
  }
  return next;
}

function applyFilePatches(
  files: readonly LedgerFileSnapshot[],
  patchesByPath: Map<string, FilePatch[]>,
) {
  return files.map((file) => {
    const patches = patchesByPath.get(file.path);
    if (!patches?.length) return file;
    return {
      path: file.path,
      contents: applyPatches(file.contents, patches),
    };
  });
}

/**
 * Remove merchant profiles that lack domain, description, and brand data,
 * and clear merchant_* metadata from ledger transactions that pointed at them.
 */
export async function pruneThinMerchantsFromCatalog(options: {
  projectId: string;
  entryFile: string;
  files: readonly LedgerFileSnapshot[];
  merchants: FilesystemMerchantStore;
}): Promise<MerchantPruneResult> {
  const { projectId, entryFile, merchants } = options;
  const files = options.files.map((file) => ({ ...file }));
  const listed = await merchants.list(projectId);
  const thinIds = new Set(
    listed
      .filter((merchant) => !hasMerchantCatalogData(merchant))
      .map((merchant) => merchant.merchantId),
  );

  if (!thinIds.size) {
    return { files, removedProfiles: 0, clearedTransactions: 0 };
  }

  const [directives] = loadProjectSources(
    entryFile,
    files.map((file) => ({ path: file.path, contents: file.contents })),
  );

  const patchesByPath = new Map<string, FilePatch[]>();
  let clearedTransactions = 0;

  for (const directive of directives) {
    if (!(directive instanceof Transaction)) continue;
    const merchantId = metaString(directive.meta, "merchant_id");
    if (!merchantId || !thinIds.has(merchantId)) continue;

    const entry = directive.source;
    const path = metaString(directive.meta, "filename");
    if (!entry || !path) continue;

    const rewritten = serializeDirective(
      directive.copy({ meta: withoutMerchantMeta(directive.meta) }),
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
    clearedTransactions += 1;
  }

  for (const merchantId of thinIds) {
    await merchants.delete(projectId, merchantId);
  }

  return {
    files: applyFilePatches(files, patchesByPath),
    removedProfiles: thinIds.size,
    clearedTransactions,
  };
}

/**
 * Stamp merchant_id on imported ledger transactions that match an existing
 * enriched merchant profile (domain, description, or brand). Does not create
 * name-only profiles.
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

  const profileByKey = new Map<string, string | undefined>();
  let createdProfiles = 0;
  let patchedTransactions = 0;
  let skipped = 0;

  async function merchantIdFor(label: string, sourceId: string) {
    const key = `${sourceId}\0${normalizeMerchant(label)}`;
    if (profileByKey.has(key)) return profileByKey.get(key);

    const existing = await merchants.resolve(projectId, sourceId, label);
    if (
      existing?.status === "confirmed" &&
      hasMerchantCatalogData(existing.merchant)
    ) {
      profileByKey.set(key, existing.merchant.merchantId);
      return existing.merchant.merchantId;
    }

    profileByKey.set(key, undefined);
    return undefined;
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
      if (!merchantId) {
        skipped += 1;
        continue;
      }
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

  return {
    files: applyFilePatches(files, patchesByPath),
    createdProfiles,
    patchedTransactions,
    skipped,
  };
}
