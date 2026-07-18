<script module lang="ts">
  import { ingestionJson, ingestionPath } from "../ingestion/api";

  type MerchantIdentity = {
    merchantId: string;
    logoUrl?: string;
  };

  const merchantLogoRequests = new Map<string, Promise<Map<string, string>>>();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  async function merchantLogosForProject(projectId: string) {
    const existing = merchantLogoRequests.get(projectId);
    if (existing) return existing;

    const request = ingestionJson<MerchantIdentity[]>(
      ingestionPath(projectId, "/merchants"),
    )
      .then(
        (merchants) =>
          new Map(
            merchants.flatMap((merchant) =>
              merchant.logoUrl
                ? [[merchant.merchantId, merchant.logoUrl] as const]
                : [],
            ),
          ),
      )
      .catch(() => new Map<string, string>());
    merchantLogoRequests.set(projectId, request);
    return request;
  }
</script>

<script lang="ts">
  import { AccountAvatar } from "@beancount-js/forms";

  import { useContext } from "../context";
  import { urlForAccount } from "../helpers";
  import { accountAppearanceStore } from "../lib/account-appearance";
  import { useStudioWorkspace } from "../studio/workspace";

  export let account: string;
  export let label: string | undefined = undefined;
  export let avatarSize: "sm" | "md" | "lg" = "sm";

  const { ledgerData } = useContext();
  const { snapshot } = useStudioWorkspace();
  const appearances = accountAppearanceStore(ledgerData);

  let merchantLogoUrl = "";
  let loadedMerchantKey = "";

  $: appearance = $appearances.get(account);
  $: projectId = $snapshot?.project.id ?? "";
  $: merchantKey =
    !isWeb && projectId && appearance?.merchantId
      ? `${projectId}:${appearance.merchantId}`
      : "";
  $: if (merchantKey !== loadedMerchantKey) {
    loadedMerchantKey = merchantKey;
    merchantLogoUrl = "";
    if (merchantKey) {
      const merchantId = appearance?.merchantId;
      void merchantLogosForProject(projectId).then((logos) => {
        if (loadedMerchantKey === merchantKey && merchantId) {
          merchantLogoUrl = logos.get(merchantId) ?? "";
        }
      });
    }
  }
</script>

<a
  href={urlForAccount(account)}
  class="inline-flex min-w-0 items-center gap-2 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
  data-account-link
  data-merchant-id={appearance?.merchantId}
>
  <AccountAvatar
    {account}
    color={appearance?.color}
    icon={appearance?.icon}
    {merchantLogoUrl}
    size={avatarSize}
  />
  <span class="min-w-0">{label ?? account}</span>
</a>
