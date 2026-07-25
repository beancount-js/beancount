import {
  createFormConfig,
  textField,
  textareaField,
  type FormConfig,
  type FormValidationIssue,
} from "@lapis/ui/forms";
import type {
  MerchantAlias,
  MerchantBrandData,
  MerchantProvenance,
} from "@beancount-js/beangulp";
import type { MerchantProfileDetails } from "@beancount-js/server";

export type EditableMerchantProfile = {
  merchantId: string;
  canonicalName: string;
  domain: string;
  description: string;
  industry: string;
  countryCode: string;
  notes: string;
  aliases: readonly MerchantAlias[];
  provenance: readonly MerchantProvenance[];
  brand?: MerchantBrandData;
  logoUrl?: string;
  logoDelivery?: "local-cache" | "server-proxy";
};

export type MerchantProfileResponse = MerchantProfileDetails & {
  logoUrl?: string;
  logoDelivery?: "local-cache" | "server-proxy";
};

export function editableMerchantFromDetails(
  details: MerchantProfileResponse,
): EditableMerchantProfile {
  return {
    merchantId: details.merchantId,
    canonicalName: details.canonicalName,
    domain: details.domain ?? "",
    description: details.description ?? "",
    industry: details.industry ?? "",
    countryCode: details.countryCode ?? "",
    notes: details.notes ?? "",
    aliases: details.aliases,
    provenance: details.provenance,
    brand: details.brand,
    logoUrl: details.logoUrl,
    logoDelivery: details.logoDelivery,
  };
}

export function validateEditableMerchant(
  merchant: EditableMerchantProfile,
): FormValidationIssue[] {
  const issues: FormValidationIssue[] = [];
  if (!merchant.canonicalName.trim()) {
    issues.push({
      fieldId: "merchant-canonical-name",
      message: "A merchant name is required.",
      severity: "error",
    });
  }
  const domain = merchant.domain.trim();
  if (domain && /[/:?#\s]/.test(domain)) {
    issues.push({
      fieldId: "merchant-domain",
      message: "Enter a hostname without protocol or path.",
      severity: "error",
    });
  }
  return issues;
}

export const merchantDetailsForm: FormConfig<EditableMerchantProfile> =
  createFormConfig({
    id: "merchant-profile-details",
    fields: [
      textField({
        id: "merchant-canonical-name",
        label: "Name",
        ariaLabel: "Merchant name",
        get: (merchant) => merchant.canonicalName,
        set: (merchant, canonicalName) => ({ ...merchant, canonicalName }),
      }),
      textField({
        id: "merchant-domain",
        label: "Domain",
        ariaLabel: "Merchant domain",
        get: (merchant) => merchant.domain,
        set: (merchant, domain) => ({ ...merchant, domain }),
      }),
      textField({
        id: "merchant-industry",
        label: "Industry",
        ariaLabel: "Merchant industry",
        get: (merchant) => merchant.industry,
        set: (merchant, industry) => ({ ...merchant, industry }),
      }),
      textField({
        id: "merchant-country",
        label: "Country",
        ariaLabel: "Merchant country code",
        get: (merchant) => merchant.countryCode,
        set: (merchant, countryCode) => ({ ...merchant, countryCode }),
      }),
      textareaField({
        id: "merchant-description",
        label: "Description",
        ariaLabel: "Merchant description",
        get: (merchant) => merchant.description,
        set: (merchant, description) => ({ ...merchant, description }),
      }),
      textareaField({
        id: "merchant-notes",
        label: "Notes",
        ariaLabel: "Merchant notes",
        get: (merchant) => merchant.notes,
        set: (merchant, notes) => ({ ...merchant, notes }),
      }),
    ],
  });
