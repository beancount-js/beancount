<script lang="ts">
  import AppShell from "../AppShell.svelte";
  import CollapsibleItemList from "./CollapsibleItemList.svelte";
  import FilterCommandPicker from "./FilterCommandPicker.svelte";
  import FormAddButton from "./FormAddButton.svelte";
  import FormField from "./FormField.svelte";
  import FormSectionHeader from "./FormSectionHeader.svelte";
  import FormToolbar from "./FormToolbar.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import Switch from "./Switch.svelte";
  import YamlBackedForm from "./YamlBackedForm.svelte";

  type Source = {
    id: number;
    label: string;
    endpoint: string;
    mode: string;
    account: string;
    open: boolean;
    rulesOpen: boolean;
    rules: string[];
  };

  const accountOptions = [
    {
      value: "Assets:Cash",
      label: "Assets:Cash",
      description: "Cash on hand",
      accent: "oklch(56% 0.14 160)",
    },
    {
      value: "Assets:Bank:Checking",
      label: "Assets:Bank:Checking",
      description: "Primary checking account",
      accent: "oklch(62% 0.14 250)",
    },
    {
      value: "Expenses:Groceries",
      label: "Expenses:Groceries",
      description: "Food and household shopping",
      accent: "oklch(70% 0.14 75)",
    },
  ];

  let connectionOpen = $state(true);
  let sourceEditingOpen = $state(true);
  let sourcesOpen = $state(true);
  let ledgerName = $state("Northstar household");
  let defaultAccount = $state("Assets:Bank:Checking");
  let syncMode = $state("automatic");
  let enabled = $state(true);
  let yamlMode = $state(false);
  let yamlApplied = $state(false);
  let sourceYaml = $state(`ledger: Northstar household
default_account: Assets:Bank:Checking
sources:
  - id: main-card
    mode: automatic
`);
  let sources = $state<Source[]>([
    {
      id: 1,
      label: "Main card",
      endpoint: "https://api.northstar.example/card",
      mode: "automatic",
      account: "Assets:Bank:Checking",
      open: true,
      rulesOpen: true,
      rules: ["Import settled transactions"],
    },
    {
      id: 2,
      label: "Cash account",
      endpoint: "",
      mode: "manual",
      account: "Assets:Cash",
      open: true,
      rulesOpen: true,
      rules: ["Include cash withdrawals"],
    },
  ]);

  const collapsedAll = $derived(
    !connectionOpen &&
      !sourceEditingOpen &&
      !sourcesOpen &&
      sources.every((source) => !source.open && !source.rulesOpen),
  );
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

  function updateSourceRules(id: number, rules: string[]) {
    updateSource(id, { rules });
  }

  function setAllSections(open: boolean) {
    connectionOpen = open;
    sourceEditingOpen = open;
    sourcesOpen = open;
    sources = sources.map((source) => ({
      ...source,
      open,
      rulesOpen: open,
    }));
  }

  function addSource() {
    const id = Math.max(0, ...sources.map((source) => source.id)) + 1;
    const open = !collapsedAll;
    sources = [
      ...sources,
      {
        id,
        label: "New source",
        endpoint: "",
        mode: "automatic",
        account: "",
        open,
        rulesOpen: open,
        rules: [],
      },
    ];
  }
</script>

<div class="cn-forms-formworkspacedemo-140-1">
  <AppShell pageTitle="Ledger settings" height="container">
    <svelte:fragment slot="header-actions">
      <output class="cn-forms-formworkspacedemo-143-1">Changes saved</output>
    </svelte:fragment>

    <section
      class="cn-forms-formworkspacedemo-146-1"
      aria-label="Ledger settings form"
    >
      <div class="cn-forms-formworkspacedemo-147-1">
        <FormToolbar
          {collapsedAll}
          onToggleCollapse={() => setAllSections(collapsedAll)}
        >
          {#snippet leading()}
            <span class="cn-forms-formworkspacedemo-153-1"
              >Source configuration</span
            >
          {/snippet}
          {#snippet actions()}
            <output class="cn-forms-formworkspacedemo-156-1">
              {sourceCount}
              {sourceCount === 1 ? "source" : "sources"}
            </output>
          {/snippet}
        </FormToolbar>

        <section
          class="cn-forms-formworkspacedemo-163-1"
          aria-label="Connection settings"
        >
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
            <div class="cn-forms-formworkspacedemo-175-1">
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
                <FormField label="Default account" as="div" align="center">
                  {#snippet children()}
                    <FilterCommandPicker
                      label="Default account"
                      value={defaultAccount}
                      options={accountOptions}
                      fullWidth
                      onChange={(account) => {
                        defaultAccount = account;
                      }}
                    />
                  {/snippet}
                </FormField>
                <FormField label="Sync mode" as="div" align="center">
                  {#snippet children()}
                    <SegmentedControl
                      value={syncMode}
                      options={["automatic", "manual"]}
                      labels={{ automatic: "Automatic", manual: "Manual" }}
                      ariaLabel="Connection sync mode"
                      onChange={(mode) => {
                        syncMode = mode;
                      }}
                    />
                  {/snippet}
                </FormField>
                <FormField label="Enabled" as="div" align="center">
                  {#snippet children()}
                    <Switch
                      checked={enabled}
                      aria-label="Enable ledger"
                      onCheckedChange={(checked) => (enabled = checked)}
                    />
                  {/snippet}
                </FormField>
              </div>
            </div>
          {/if}
        </section>

        <section
          class="cn-forms-formworkspacedemo-227-1"
          aria-label="Source editing settings"
        >
          <FormSectionHeader
            title="Source editing"
            editable={false}
            titleToggleable
            open={sourceEditingOpen}
            movable={false}
            removable={false}
            onToggle={() => (sourceEditingOpen = !sourceEditingOpen)}
          />

          {#if sourceEditingOpen}
            <div class="cn-forms-formworkspacedemo-241-1">
              <div class="beancount-structured-form">
                <FormField label="Edit as YAML" as="div" align="center">
                  {#snippet children()}
                    <Switch
                      checked={yamlMode}
                      aria-label="Edit ledger source as YAML"
                      onCheckedChange={(checked) => {
                        yamlMode = checked;
                      }}
                    />
                  {/snippet}
                </FormField>
              </div>

              {#if yamlMode}
                <YamlBackedForm
                  yamlMode
                  bind:yamlText={sourceYaml}
                  yamlLabel="Ledger source YAML"
                  yamlMinHeight="18rem"
                  onYamlApply={() => {
                    yamlApplied = true;
                  }}
                />
                <output class="cn-forms-formworkspacedemo-266-1">
                  {yamlApplied
                    ? "YAML source draft applied"
                    : "YAML source draft not applied"}
                </output>
              {:else}
                <p class="cn-forms-formworkspacedemo-272-1">
                  Use the structured fields for routine edits, or switch to the
                  authoritative YAML source when the whole draft needs editing.
                </p>
              {/if}
            </div>
          {/if}
        </section>

        <section
          class="cn-forms-formworkspacedemo-281-1"
          aria-label="Sources settings"
        >
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
            <div class="cn-forms-formworkspacedemo-293-1">
              {#each sources as source, index (source.id)}
                <section
                  class="cn-forms-formworkspacedemo-296-1"
                  aria-label={`${source.label} source`}
                >
                  <FormSectionHeader
                    title={source.label}
                    disclosureTitle={source.label || "New source"}
                    {index}
                    total={sources.length}
                    open={source.open}
                    removeLabel={`Remove ${source.label || "source"}`}
                    titleLabel={`${source.label || "New source"} source name`}
                    titlePlaceholder="Add source name"
                    onTitleChange={(label) =>
                      updateSource(source.id, { label })}
                    onToggle={() =>
                      updateSource(source.id, { open: !source.open })}
                    onMove={(direction) => moveSource(index, direction)}
                    onRemove={() =>
                      (sources = sources.filter(
                        (item) => item.id !== source.id,
                      ))}
                  />

                  {#if source.open}
                    <div class="cn-forms-formworkspacedemo-320-1">
                      <div class="beancount-structured-form">
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
                              aria-label={`${source.label || "New source"} endpoint`}
                              placeholder="https://api.example.com"
                              value={source.endpoint}
                              oninput={(event) =>
                                updateSource(source.id, {
                                  endpoint: event.currentTarget.value,
                                })}
                            />
                          {/snippet}
                        </FormField>
                        <FormField
                          label="Import account"
                          as="div"
                          align="center"
                        >
                          {#snippet children()}
                            <FilterCommandPicker
                              label={`${source.label || "New source"} import account`}
                              value={source.account}
                              options={accountOptions}
                              fullWidth
                              onChange={(account) =>
                                updateSource(source.id, { account })}
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
                              ariaLabel={`${source.label || "New source"} import mode`}
                              onChange={(mode) =>
                                updateSource(source.id, { mode })}
                            />
                          {/snippet}
                        </FormField>
                      </div>

                      <CollapsibleItemList
                        title="Import rules"
                        addLabel="rule"
                        count={source.rules.length}
                        open={source.rulesOpen}
                        onToggle={() =>
                          updateSource(source.id, {
                            rulesOpen: !source.rulesOpen,
                          })}
                        onAdd={() =>
                          updateSourceRules(source.id, [
                            ...source.rules,
                            `Rule ${source.rules.length + 1}`,
                          ])}
                      >
                        {#snippet children()}
                          {#if source.rules.length}
                            <ul class="cn-forms-formworkspacedemo-392-1">
                              {#each source.rules as rule}
                                <li class="cn-forms-formworkspacedemo-395-1">
                                  {rule}
                                </li>
                              {/each}
                            </ul>
                          {/if}
                        {/snippet}
                      </CollapsibleItemList>
                    </div>
                  {/if}
                </section>
              {/each}
              <div class="cn-forms-formworkspacedemo-408-1">
                <FormAddButton label="Add source" onclick={addSource} />
              </div>
            </div>
          {/if}
        </section>
      </div>
    </section>
  </AppShell>
</div>
