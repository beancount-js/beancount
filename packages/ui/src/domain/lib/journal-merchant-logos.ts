import { Transaction, type DirectiveBase } from "@beancount-js/beancount";
import { normalizeMerchant } from "@beancount-js/beangulp";

export type JournalMerchantLogo = {
  merchantId: string;
  canonicalName: string;
  domain?: string;
  logoUrl?: string;
  aliases?: { normalizedValue: string }[];
};

export type JournalMerchantLogoMaps = {
  byId: Map<string, string>;
  byNormalizedName: Map<string, string>;
};

/**
 * The subset of merchant-review data Journal needs to resolve a suggested
 * merchant's logo before it has been confirmed as a merchant identity.
 */
export type JournalMerchantReviewCluster = {
  id: string;
  displayName: string;
  logoUrl?: string;
  members: { normalizedLabel: string }[];
};

export function journalMerchantLogoFromReviewCluster(
  cluster: JournalMerchantReviewCluster,
): JournalMerchantLogo | undefined {
  const logoUrl = cluster.logoUrl?.trim();
  if (!logoUrl) return undefined;

  return {
    merchantId: `review:${cluster.id}`,
    canonicalName: cluster.displayName,
    logoUrl,
    aliases: cluster.members.map((member) => ({
      normalizedValue: member.normalizedLabel,
    })),
  };
}

export function buildJournalMerchantLogoMaps(
  merchants: readonly JournalMerchantLogo[],
): JournalMerchantLogoMaps {
  const byId = new Map<string, string>();
  const byNormalizedName = new Map<string, string>();
  for (const merchant of merchants) {
    if (!merchant.logoUrl) continue;
    byId.set(merchant.merchantId, merchant.logoUrl);
    const nameKey = normalizeMerchant(merchant.canonicalName);
    if (nameKey && !byNormalizedName.has(nameKey)) {
      byNormalizedName.set(nameKey, merchant.logoUrl);
    }
    for (const alias of merchant.aliases ?? []) {
      const aliasKey = alias.normalizedValue.trim();
      if (aliasKey && !byNormalizedName.has(aliasKey)) {
        byNormalizedName.set(aliasKey, merchant.logoUrl);
      }
    }
  }
  return { byId, byNormalizedName };
}

export function merchantIdFromDirective(
  directive: DirectiveBase,
): string | undefined {
  const value = directive.meta["merchant_id"];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function resolveJournalMerchantLogo(
  directive: DirectiveBase,
  maps: JournalMerchantLogoMaps,
): string | undefined {
  const merchantId = merchantIdFromDirective(directive);
  if (merchantId) {
    const byId = maps.byId.get(merchantId);
    if (byId) return byId;
  }
  if (!(directive instanceof Transaction)) return undefined;
  const label = directive.payee || directive.narration;
  const key = normalizeMerchant(label);
  if (!key) return undefined;
  return maps.byNormalizedName.get(key);
}
