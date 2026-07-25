<script lang="ts">
  import { onDestroy } from "svelte";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import type { ResourcePreviewItem } from "@lapis/ui/feedback/ResourcePreview.svelte";
  import ResourcePreview from "@lapis/ui/feedback/ResourcePreview.svelte";

  const { router } = useNavigation();
  const { activeRoute } = router;
  const { snapshot, resourceUrl } = useStudioWorkspace();
  let url = "";
  let text = "";
  let error = "";
  let revoke: (() => void) | undefined;
  let loadedPath = "";
  let loading = false;

  $: path = $activeRoute.query["path"] ?? "";
  $: resource = $snapshot?.resources.find((item) => item.path === path);
  $: if (path && path !== loadedPath) {
    loadedPath = path;
    void load();
  }
  $: displayResource = resource
    ? ({
        path: resource.path,
        mimeType: resource.mimeType,
        url,
        text,
      }) as ResourcePreviewItem
    : undefined;

  async function load() {
    revoke?.();
    loading = true;
    url = "";
    text = "";
    error = "";
    if (!resource) {
      error =
        "This resource is not referenced by the active Beancount project.";
      loading = false;
      return;
    }
    try {
      const next = await resourceUrl(resource.path);
      url = next.url;
      revoke = next.revoke;
      if (
        resource.mimeType.startsWith("text/") ||
        /(?:json|yaml|csv)/.test(resource.mimeType)
      ) {
        text = await (await fetch(url)).text();
      }
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    } finally {
      loading = false;
    }
  }

  onDestroy(() => revoke?.());

  function openResource(resource: ResourcePreviewItem) {
    if (!resource.url) return;
    window.open(resource.url, "_blank", "noopener,noreferrer");
  }
</script>

<ResourcePreview
  resource={displayResource}
  {error}
  {loading}
  onOpen={openResource}
/>
