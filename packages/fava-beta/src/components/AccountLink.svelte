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
  import AccountNavigationLink from "@lapis/ui/navigation/AccountNavigationLink.svelte";

  import { useContext } from "../context";
  import { urlForAccount } from "../helpers";
  import { accountAppearanceStore } from "../lib/account-appearance";
  import { useStudioWorkspace } from "../studio/workspace";

  export let account: string;
  export let label: string | undefined = undefined;
  export let avatarSize: "sm" | "md" | "lg" = "sm";
  export let onclick: ((event: MouseEvent) => void) | undefined = undefined;
  export let onkeydown: ((event: KeyboardEvent) => void) | undefined =
    undefined;

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

<AccountNavigationLink
  {account}
  label={label ?? account}
  href={urlForAccount(account)}
  appearance={appearance
    ? {
        color: appearance.color,
        icon: appearance.icon,
        merchantId: appearance.merchantId,
        merchantLogoUrl,
      }
    : undefined}
  {avatarSize}
  {onclick}
  {onkeydown}
/>
