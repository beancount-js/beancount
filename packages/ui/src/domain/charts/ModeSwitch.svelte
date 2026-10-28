<script lang="ts" generics="T extends string">
  import type { ValueStore as LocalStoreSyncedStore } from "../stores/chart";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";

  /** The store to show a switch for. */
  export let store: LocalStoreSyncedStore<string>;

  function handleChange(value: string | undefined) {
    if (value) {
      store.set(value);
    }
  }
</script>

<Tabs.Root value={$store} onValueChange={handleChange}>
  <Tabs.List>
    {#each store.values() as [option, name]}
      <Tabs.Trigger value={option}>{name}</Tabs.Trigger>
    {/each}
  </Tabs.List>
</Tabs.Root>
