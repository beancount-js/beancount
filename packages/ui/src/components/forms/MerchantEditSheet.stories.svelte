<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import { createFormConfig, textField, textareaField } from "./core";
  import type { FormConfig } from "./types";
  import MerchantEditSheet, {
    type MerchantEditProfile,
  } from "./MerchantEditSheet.svelte";
  import * as Tooltip from "../shadcn/tooltip";

  const { Story } = defineMeta({
    title: "UI Forms/Merchant Edit Sheet",
    component: MerchantEditSheet,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        description: {
          component:
            "A presentational merchant-editing sheet from the shared forms package. The application owns merchant loading, autosave, route state, persistence, logo refresh, and close lifecycle.",
        },
      },
    },
  });

  const detailsForm: FormConfig<MerchantEditProfile> =
    createFormConfig<MerchantEditProfile>({
      id: "migration-merchant-details",
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
        textareaField({
          id: "merchant-description",
          label: "Description",
          ariaLabel: "Merchant description",
          get: (merchant) => merchant.description,
          set: (merchant, description) => ({ ...merchant, description }),
        }),
      ],
    });

  const baseMerchant = {
    canonicalName: "Northstar Cafe",
    domain: "northstar-cafe.com",
    description: "Coffee shop near the station.",
    industry: "Food and beverage",
    countryCode: "US",
    notes: "Trusted recurring merchant.",
    aliases: [
      {
        value: "North Star",
        normalizedValue: "northstar",
        sourceId: "manual",
        confirmedAt: "2025-01-09T00:00:00Z",
      },
    ],
    provenance: [
      {
        source: "manual",
        observedAt: new Date().toISOString(),
      },
    ],
    brand: {
      provider: "brandfetch",
      fetchedAt: "2026-01-01T00:00:00Z",
      expiresAt: "2026-12-31T23:59:59Z",
      asset: {
        filename: "northstar-logo.png",
        mediaType: "image/png",
        size: 120,
      },
    },
    logoUrl:
      "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=120&h=120&q=80",
  };
</script>

<script lang="ts">
  let open = $state(false);
  let merchant = $state<MerchantEditProfile>({
    ...baseMerchant,
    notes: "Trusted recurring merchant.",
  });
  let status = $state("loaded");
  let loading = $state(false);
  let loadError = $state("");
  let refreshingLogo = $state(false);
  let issues = $state(
    [] as {
      message: string;
      fieldId?: string;
      path?: string;
      severity?: "error" | "warning" | "info";
    }[],
  );

  function handleLogoRefresh() {
    refreshingLogo = true;
    setTimeout(() => {
      refreshingLogo = false;
      status = "Refreshed logo metadata";
      setTimeout(() => {
        status = "";
      }, 300);
    }, 100);
  }
</script>

<Story
  name="Renders a merchant profile sheet and supports edits"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Edit merchant" }),
    );
    const dialog = within(document.body).getByRole("dialog");
    await expect(dialog).toBeVisible();
    const industryInput = within(dialog).getByRole("textbox", {
      name: "Merchant industry",
    });
    await userEvent.clear(industryInput);
    await userEvent.type(industryInput, "Hospitality");
    await expect(
      within(dialog).getByText(/Unsaved changes…/),
    ).toHaveTextContent("Unsaved changes…");
  }}
>
  {#snippet template()}
    <Tooltip.Provider delayDuration={0}>
      <div class="space-y-3">
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3"
          onclick={() => {
            issues = [];
            merchant = { ...baseMerchant };
            open = true;
          }}
        >
          Edit merchant
        </button>
        <MerchantEditSheet
          bind:open
          bind:merchant
          {loading}
          {loadError}
          {refreshingLogo}
          {status}
          {detailsForm}
          {issues}
          onChange={(next) => {
            const nextMerchant = next as MerchantEditProfile;
            merchant = { ...nextMerchant, notes: nextMerchant.notes };
            issues = [];
            status = "Unsaved changes…";
          }}
          onRefreshLogo={handleLogoRefresh}
        />
        <output class="text-sm text-muted-foreground">
          Merchant sheet {open ? "open" : "closed"}; {status || "no status"}
        </output>
      </div>
    </Tooltip.Provider>
  {/snippet}
</Story>
