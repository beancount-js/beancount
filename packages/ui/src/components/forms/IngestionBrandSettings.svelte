<script lang="ts">
  import ArrowRight from "lucide-svelte/icons/arrow-right";
  import FileCode2 from "lucide-svelte/icons/file-code-2";
  import StructuredForm from "./StructuredForm.svelte";
  import type { FormConfig, FormValidationIssue } from "./types";
  import BrandSettingsSkeleton from "../feedback/BrandSettingsSkeleton.svelte";
  import * as Alert from "../shadcn/alert";
  import { Button } from "../shadcn/button";

  type EditableIngestionConfig = {
    version?: 1 | 2 | 3;
    brandfetch?: {
      enabled?: boolean;
      highResolution?: boolean;
      cacheUserAgent?: string;
      clientId?: string;
      [key: string]: unknown;
    };
    sources?: readonly unknown[];
    [key: string]: unknown;
  };

  type BrandSettingsContext = {
    accounts: readonly string[];
    envKeys?: readonly string[];
    [key: string]: unknown;
  };

  type BrandSettingsForm = FormConfig<
    EditableIngestionConfig,
    BrandSettingsContext
  >;

  type ConfigChangeHandler = {
    bivarianceHack(next: EditableIngestionConfig): void;
  }["bivarianceHack"];

  type Props = {
    isWeb?: boolean;
    config?: EditableIngestionConfig;
    formContext?: BrandSettingsContext;
    status?: string;
    issues?: readonly FormValidationIssue[];
    brandSettingsForm: BrandSettingsForm | unknown;
    brandSettingsToggleForm: BrandSettingsForm | unknown;
    onConfigChange: ConfigChangeHandler;
    onManageSources?: () => void;
  };

  let {
    isWeb = false,
    config,
    formContext = { accounts: [] },
    status = "",
    issues = [],
    brandSettingsToggleForm,
    brandSettingsForm,
    onConfigChange,
    onManageSources,
  }: Props = $props();

  function updateConfig(next: EditableIngestionConfig) {
    onConfigChange(next);
  }

  function openSources() {
    onManageSources?.();
  }
</script>

<section
  class="h-full overflow-y-auto p-4 sm:p-6"
  data-ingestion-brand-settings
>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
    {#if isWeb}
      <Alert.Root>
        <FileCode2 />
        <Alert.Title>Local server required</Alert.Title>
        <Alert.Description
          >Brand matching settings are available only through the local server.</Alert.Description
        >
      </Alert.Root>
    {:else if !config}
      <BrandSettingsSkeleton />
    {:else}
      <div class="flex min-w-0 flex-col gap-6">
        <p class="text-sm text-muted-foreground">
          Brandfetch Logo API adds logos for merchants with a known domain.
          Stored project assets are served locally; other logos redirect through
          the browser so Brandfetch can validate the originating site.
        </p>

        <article
          class="overflow-hidden rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6"
        >
          <div class="beancount-structured-form">
            <StructuredForm
              value={config}
              config={brandSettingsToggleForm as BrandSettingsForm}
              context={formContext}
              embedded
              onChange={updateConfig}
            />
            {#if config.brandfetch}
              <StructuredForm
                value={config}
                config={brandSettingsForm as BrandSettingsForm}
                context={formContext}
                {issues}
                embedded
                onChange={updateConfig}
              />
            {/if}
          </div>
          <p class="mt-3 text-sm text-muted-foreground">
            High-resolution logos use 120×120 images instead of 40×40 for
            sharper high-DPI displays. Set Cache User-Agent to opt into testing
            server-side cache fills; failed requests still redirect in the
            browser.
          </p>
        </article>

        <div>
          <Button
            type="button"
            variant="link"
            class="h-auto gap-1 px-0 text-sm"
            onclick={openSources}
          >
            Manage sources
            <ArrowRight class="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    {/if}

    {#if status}
      <p class="text-sm text-muted-foreground" role="status">{status}</p>
    {/if}
  </div>
</section>
