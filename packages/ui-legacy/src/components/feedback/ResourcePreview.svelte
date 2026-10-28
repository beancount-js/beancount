<script lang="ts">
  import ExternalLink from "lucide-svelte/icons/external-link";
  import FileWarning from "lucide-svelte/icons/file-warning";
  import { Button } from "../shadcn/button";
  import * as ScrollArea from "../shadcn/scroll-area";
  import ResourceViewerSkeleton from "./ResourceViewerSkeleton.svelte";

  /** A resolved resource ready for presentation in the workspace. */
  export type ResourcePreviewItem = {
    path: string;
    mimeType: string;
    /** Resolved object or remote URL, supplied by the application. */
    url?: string;
    /** Preloaded text for a text-like resource. */
    text?: string;
  };

  /**
   * Presents a resolved workspace resource. Applications own route lookup,
   * URL creation/revocation, text loading, and the external-open action.
   */
  let {
    resource,
    error,
    loading = false,
    ariaLabel,
    unavailableMessage = "This resource is not referenced by the active workspace.",
    onOpen,
  }: {
    resource?: ResourcePreviewItem;
    error?: string;
    loading?: boolean;
    /** Defaults to the current resource path so repeated previews remain distinct landmarks. */
    ariaLabel?: string;
    unavailableMessage?: string;
    onOpen?: (resource: ResourcePreviewItem) => void;
  } = $props();

  const isImage = $derived(Boolean(resource?.mimeType.startsWith("image/")));
  const isPdf = $derived(resource?.mimeType === "application/pdf");
  const isText = $derived(
    Boolean(
      resource &&
        (resource.mimeType.startsWith("text/") ||
          /(?:json|yaml|csv)/.test(resource.mimeType)),
    ),
  );
  const message = $derived(
    error ?? (!resource && !loading ? unavailableMessage : ""),
  );
  const accessibleLabel = $derived(
    ariaLabel ?? resource?.path ?? "Resource preview",
  );
</script>

<section
  class="cn-feedback-resourcepreview-57-1"
  aria-label={accessibleLabel}
  aria-busy={loading}
>
  <div class="cn-feedback-resourcepreview-61-1">
    <div class="cn-feedback-resourcepreview-62-1">
      <p class="cn-feedback-resourcepreview-63-1">
        {resource?.path ?? "Resource"}
      </p>
      <p class="cn-feedback-resourcepreview-64-1">
        {resource?.mimeType ?? "Unavailable"}
      </p>
    </div>
    {#if resource?.url && onOpen}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onclick={() => onOpen(resource!)}
      >
        <ExternalLink
          class="cn-feedback-resourcepreview-75-1"
          aria-hidden="true"
        />
        Open
      </Button>
    {/if}
  </div>

  {#if message}
    <div class="cn-feedback-resourcepreview-83-1" role="alert">
      <FileWarning
        class="cn-feedback-resourcepreview-86-1"
        aria-hidden="true"
      />
      <span>{message}</span>
    </div>
  {:else if loading || !resource || !resource.url}
    <ResourceViewerSkeleton />
  {:else if isImage}
    <ScrollArea.Root class="cn-feedback-resourcepreview-92-1">
      <div class="cn-feedback-resourcepreview-93-1">
        <img
          src={resource.url}
          alt={resource.path}
          class="cn-feedback-resourcepreview-97-1"
        />
      </div>
    </ScrollArea.Root>
  {:else if isPdf}
    <iframe
      title={resource.path}
      src={resource.url}
      class="cn-feedback-resourcepreview-105-1"
    ></iframe>
  {:else if isText && resource.text !== undefined}
    <ScrollArea.Root class="cn-feedback-resourcepreview-108-1">
      <pre class="cn-feedback-resourcepreview-110-1">{resource.text}</pre>
    </ScrollArea.Root>
  {:else}
    <ResourceViewerSkeleton />
  {/if}
</section>
