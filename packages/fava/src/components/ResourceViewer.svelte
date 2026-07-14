<script lang="ts">
  import { onDestroy } from "svelte";
  import FileWarning from "lucide-svelte/icons/file-warning";
  import ExternalLink from "lucide-svelte/icons/external-link";
  import { Button } from "$lib/components/ui/button";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";

  const { router } = useNavigation();
  const { activeRoute } = router;
  const { snapshot, resourceUrl } = useStudioWorkspace();
  let url = "";
  let text = "";
  let error = "";
  let revoke: (() => void) | undefined;
  let loadedPath = "";

  $: path = $activeRoute.query["path"] ?? "";
  $: resource = $snapshot?.resources.find((item) => item.path === path);
  $: if (path && path !== loadedPath) {
    loadedPath = path;
    void load();
  }

  async function load() {
    revoke?.();
    url = "";
    text = "";
    error = "";
    if (!resource) {
      error = "This resource is not referenced by the active Beancount project.";
      return;
    }
    try {
      const next = await resourceUrl(resource.path);
      url = next.url;
      revoke = next.revoke;
      if (resource.mimeType.startsWith("text/") || /(?:json|yaml|csv)/.test(resource.mimeType)) {
        text = await (await fetch(url)).text();
      }
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    }
  }

  onDestroy(() => revoke?.());
</script>

<section class="flex h-full min-h-0 flex-col gap-3 p-4">
  <div class="flex items-center justify-between gap-3">
    <div class="min-w-0"><p class="text-sm font-medium">{resource?.path ?? "Resource"}</p><p class="text-xs text-muted-foreground">{resource?.mimeType ?? "Unavailable"}</p></div>
    {#if url}<Button variant="outline" size="sm" onclick={() => window.open(url, "_blank", "noopener,noreferrer")}><ExternalLink data-icon="inline-start" /> Open</Button>{/if}
  </div>
  {#if error}
    <div class="flex items-center gap-2 rounded-md border border-destructive/30 p-3 text-sm text-destructive"><FileWarning /> {error}</div>
  {:else if resource?.mimeType.startsWith("image/") && url}
    <div class="min-h-0 flex-1 overflow-auto rounded-md border bg-muted p-3"><img src={url} alt={resource.path} class="mx-auto max-w-full" /></div>
  {:else if resource?.mimeType === "application/pdf" && url}
    <iframe title={resource.path} src={url} class="min-h-0 flex-1 rounded-md border bg-muted"></iframe>
  {:else if text}
    <pre class="min-h-0 flex-1 overflow-auto rounded-md border bg-muted p-3 text-sm">{text}</pre>
  {:else}
    <div class="rounded-md border p-4 text-sm text-muted-foreground">Loading resource…</div>
  {/if}
</section>
