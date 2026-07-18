<script lang="ts">
  import AppShell from "../AppShell.svelte";
  import EntryActions from "./EntryActions.svelte";
  import FormAddButton from "./FormAddButton.svelte";
  import FormField from "./FormField.svelte";
  import FormSectionHeader from "./FormSectionHeader.svelte";
  import FormToolbar from "./FormToolbar.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  type Source = {
    id: number;
    label: string;
    endpoint: string;
    mode: string;
  };

  let connectionOpen = $state(true);
  let sourcesOpen = $state(true);
  let ledgerName = $state("Northstar household");
  let enabled = $state(true);
  let sources = $state<Source[]>([
    {
      id: 1,
      label: "Main card",
      endpoint: "https://api.northstar.example/card",
      mode: "automatic",
    },
    {
      id: 2,
      label: "Cash account",
      endpoint: "",
      mode: "manual",
    },
  ]);

  const collapsedAll = $derived(!connectionOpen && !sourcesOpen);
  const sourceCount = $derived(sources.length);

  function moveSource(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sources.length) return;

    const next = [...sources];
    [next[index], next[target]] = [next[target], next[index]];
    sources = next;
  }

  function updateSource(id: number, patch: Partial<Source>) {
    sources = sources.map((source) =>
      source.id === id ? { ...source, ...patch } : source,
    );
  }

  function addSource() {
    const id = Math.max(0, ...sources.map((source) => source.id)) + 1;
    sources = [
      ...sources,
      { id, label: "New source", endpoint: "", mode: "automatic" },
    ];
  }
</script>

<div class="h-[42rem] overflow-hidden rounded-lg border border-border">
  <AppShell pageTitle="Ledger settings" height="container">
    <svelte:fragment slot="sidebar">
      <aside
        aria-label="Ledger settings navigation"
        class="flex h-full w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground"
      >
        <p class="text-sm font-semibold">Northstar Ledger</p>
        <p class="mt-1 text-xs text-muted-foreground">Settings</p>
        <nav class="mt-5 space-y-1" aria-label="Settings sections">
          <button
            type="button"
            class="w-full rounded-md bg-sidebar-accent px-2 py-1.5 text-left text-sm font-medium"
            >Sources</button
          >
          <button
            type="button"
            class="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground"
            >Notifications</button
          >
        </nav>
      </aside>
    </svelte:fragment>

    <svelte:fragment slot="header-actions">
      <output class="text-xs text-muted-foreground">Changes saved</output>
    </svelte:fragment>

    <section class="h-full overflow-auto p-6" aria-label="Ledger settings form">
      <div class="mx-auto max-w-3xl space-y-6">
        <FormToolbar
          {collapsedAll}
          onToggleCollapse={() => {
            const shouldExpand = collapsedAll;
            connectionOpen = shouldExpand;
            sourcesOpen = shouldExpand;
          }}
        >
          {#snippet leading()}
            <span class="text-sm font-medium">Source configuration</span>
          {/snippet}
          {#snippet actions()}
            <output class="text-xs text-muted-foreground">
              {sourceCount}
              {sourceCount === 1 ? "source" : "sources"}
            </output>
          {/snippet}
        </FormToolbar>

        <section class="space-y-3" aria-label="Connection settings">
          <FormSectionHeader
            title="Connection"
            editable={false}
            titleToggleable
            open={connectionOpen}
            movable={false}
            removable={false}
            onToggle={() => (connectionOpen = !connectionOpen)}
          />

          {#if connectionOpen}
            <div class="pl-4">
              <div class="beancount-structured-form">
                <FormField
                  label="Ledger name"
                  align="center"
                  controlId="ledger-name"
                >
                  {#snippet children()}
                    <input id="ledger-name" bind:value={ledgerName} />
                  {/snippet}
                </FormField>
                <FormField label="Sync mode" as="div" align="center">
                  {#snippet children()}
                    <SegmentedControl
                      value="automatic"
                      options={["automatic", "manual"]}
                      labels={{ automatic: "Automatic", manual: "Manual" }}
                      ariaLabel="Connection sync mode"
                    />
                  {/snippet}
                </FormField>
                <FormField label="Enabled" as="div" align="center">
                  {#snippet children()}
                    <button
                      type="button"
                      aria-pressed={enabled}
                      class="rounded-md border border-border px-2.5 py-1 text-sm"
                      onclick={() => (enabled = !enabled)}
                      >{enabled ? "Enabled" : "Disabled"}</button
                    >
                  {/snippet}
                </FormField>
              </div>
            </div>
          {/if}
        </section>

        <section class="space-y-3" aria-label="Sources settings">
          <FormSectionHeader
            title="Sources"
            editable={false}
            titleToggleable
            open={sourcesOpen}
            movable={false}
            removable={false}
            onToggle={() => (sourcesOpen = !sourcesOpen)}
          />

          {#if sourcesOpen}
            <div class="space-y-4 pl-4">
              {#each sources as source, index (source.id)}
                <EntryActions
                  {index}
                  total={sources.length}
                  removeLabel={`Remove ${source.label}`}
                  onMove={(direction) => moveSource(index, direction)}
                  onRemove={() =>
                    (sources = sources.filter((item) => item.id !== source.id))}
                >
                  {#snippet children()}
                    <div class="beancount-structured-form">
                      <FormField label="Source name" align="center">
                        {#snippet children()}
                          <input
                            aria-label={`${source.label} source name`}
                            value={source.label}
                            oninput={(event) =>
                              updateSource(source.id, {
                                label: event.currentTarget.value,
                              })}
                          />
                        {/snippet}
                      </FormField>
                      <FormField
                        label="Endpoint"
                        align="center"
                        invalid={source.endpoint.length === 0}
                        messages={source.endpoint.length === 0
                          ? ["Enter an endpoint or remove this source."]
                          : []}
                      >
                        {#snippet children()}
                          <input
                            aria-label={`${source.label} endpoint`}
                            placeholder="https://api.example.com"
                            value={source.endpoint}
                            oninput={(event) =>
                              updateSource(source.id, {
                                endpoint: event.currentTarget.value,
                              })}
                          />
                        {/snippet}
                      </FormField>
                      <FormField label="Import mode" as="div" align="center">
                        {#snippet children()}
                          <SegmentedControl
                            value={source.mode}
                            options={["automatic", "manual"]}
                            labels={{
                              automatic: "Automatic",
                              manual: "Manual",
                            }}
                            ariaLabel={`${source.label} import mode`}
                            onChange={(mode) =>
                              updateSource(source.id, { mode })}
                          />
                        {/snippet}
                      </FormField>
                    </div>
                  {/snippet}
                </EntryActions>
              {/each}
              <div class="flex justify-end">
                <FormAddButton label="Add source" onclick={addSource} />
              </div>
            </div>
          {/if}
        </section>
      </div>
    </section>
  </AppShell>
</div>
