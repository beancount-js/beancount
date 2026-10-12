<script lang="ts" module>
  export const sourceFormSections = [
    "source-details",
    "api",
    "query-parameters",
    "mapping",
    "enrichment",
    "provider-category-mappings",
  ] as const;

  export const groupedSourceFormSections = [
    "source-details",
    "api",
    "linked-accounts",
    "query-parameters",
    "mapping",
    "enrichment",
    "provider-category-mappings",
  ] as const;

  export function sourceFormSectionIds(grouped = false) {
    return [...(grouped ? groupedSourceFormSections : sourceFormSections)];
  }
</script>

<script lang="ts">
  import FilterCommandPicker from "../../components/forms/FilterCommandPicker.svelte";

  import { ArrowRight } from "@lucide/svelte";
  import { Copy } from "@lucide/svelte";
  import {
    CollapsibleItemList,
    EntryActions,
    FormField,
    FormSectionHeader,
    StructuredForm,
    type FormValidationIssue,
  } from "@lapismd/design-core/forms";
  import {
    type JsonApiLinkedAccount,
    type ProviderCategoryMapping,
  } from "@beancount-js/beangulp";
  import { untrack } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { useNavigation } from "../router/router";
  import {
    clientConnector,
    isConnectorSource,
    isGroupedSource,
  } from "../ingestion/connectors";
  import { connectorFieldsForm } from "../ingestion/connector-fields";
  import type { EditableIngestionSource } from "../ingestion/source-form";
  import {
    sourceApiForm,
    sourceApiGroupedForm,
    sourceDetailsForm,
    sourceDetailsGroupedForm,
    sourceEnrichmentDetailsForm,
    sourceEnrichmentForm,
    sourceMappingForm,
    sourcePaginationForm,
    type SourceFormContext,
  } from "../ingestion/source-form-config";

  type KeyValue = [string, string];

  let {
    source,
    accounts = [],
    categoryAccounts = [],
    issues = [],
    credentialAvailable,
    merchantCredentialAvailable,
    envKeys = [],
    projectId,
    openSections = [...sourceFormSections],
    onOpenSectionsChange = () => {},
    onChange,
    onDuplicate = () => {},
    onRemove = () => {},
  }: {
    source: EditableIngestionSource;
    accounts?: string[];
    categoryAccounts?: string[];
    issues?: FormValidationIssue[];
    credentialAvailable?: boolean;
    merchantCredentialAvailable?: boolean;
    envKeys?: string[];
    projectId?: string;
    openSections?: string[];
    onOpenSectionsChange?: (sections: string[]) => void;
    onChange: (source: EditableIngestionSource) => void;
    onDuplicate?: () => void;
    onRemove?: () => void;
  } = $props();

  const { router } = useNavigation();

  let queryDraft: KeyValue[] = $state([]);

  const connector = $derived(
    isConnectorSource(source) ? clientConnector(source.kind) : undefined,
  );
  const grouped = $derived(isGroupedSource(source));
  const detailsForm = $derived(
    grouped ? sourceDetailsGroupedForm : sourceDetailsForm,
  );
  const apiForm = $derived(grouped ? sourceApiGroupedForm : sourceApiForm);
  const connectionFieldsForm = $derived(
    connector
      ? connectorFieldsForm(
          connector.connectionFields,
          `${connector.kind}-connection`,
        )
      : undefined,
  );
  const advancedFieldsForm = $derived(
    connector?.advancedFields.length
      ? connectorFieldsForm(
          connector.advancedFields,
          `${connector.kind}-advanced`,
        )
      : undefined,
  );
  const formContext = $derived({
    accounts,
    projectId,
    envKeys,
    credentialAvailable,
    merchantCredentialAvailable,
  } satisfies SourceFormContext);
  const accountItems = $derived(
    accounts.map((account) => ({ label: account, value: account })),
  );
  const categoryAccountItems = $derived(
    categoryAccounts.map((account) => ({ label: account, value: account })),
  );
  const providerCategories = $derived(connector?.providerCategories ?? []);

  const detailsIssues = $derived(augmentCredentialIssues(issues));

  const sourceQueryFingerprint = $derived(
    `${source.id}:${JSON.stringify(source.api?.query ?? {})}`,
  );

  function queryObjectFromDraft(entries: KeyValue[]) {
    return Object.fromEntries(
      entries
        .map(([key, value]) => [key.trim(), value] as KeyValue)
        .filter(([key]) => Boolean(key)),
    );
  }

  // Sync draft from parent when the source identity or persisted query changes
  // (source switch / YAML apply). Blank in-progress rows live only in draft.
  $effect(() => {
    const fingerprint = sourceQueryFingerprint;
    const draftFingerprint = untrack(
      () => `${source.id}:${JSON.stringify(queryObjectFromDraft(queryDraft))}`,
    );
    if (fingerprint !== draftFingerprint) {
      queryDraft = Object.entries(source.api?.query ?? {});
    }
  });

  function augmentCredentialIssues(base: FormValidationIssue[]) {
    const next = [...base];
    if (credentialAvailable === false) {
      next.push({
        fieldId: "api.secretRef",
        message: "Credential is not available in this environment",
        severity: "warning",
      });
    }
    return next;
  }

  function openBrandSettings() {
    router.push("/import/brands");
  }

  function isSectionOpen(section: string) {
    return openSections.includes(section);
  }

  function toggleSection(section: string) {
    onOpenSectionsChange(
      isSectionOpen(section)
        ? openSections.filter((item) => item !== section)
        : [...openSections, section],
    );
  }

  function commitQueryObject(entries: KeyValue[]) {
    const query = queryObjectFromDraft(entries);
    onChange({
      ...source,
      api: {
        secretRef: "",
        ...source.api,
        query: Object.keys(query).length ? query : undefined,
      },
    });
  }

  function addQueryParam() {
    queryDraft = [...queryDraft, ["", ""]];
  }

  function patchQueryDraft(index: number, part: 0 | 1, value: string) {
    const next = [...queryDraft];
    const current = next[index] ?? ["", ""];
    next[index] = part === 0 ? [value, current[1]] : [current[0], value];
    queryDraft = next;
    commitQueryObject(next);
  }

  function moveQuery(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= queryDraft.length) return;
    const next = [...queryDraft];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    queryDraft = next;
    commitQueryObject(next);
  }

  function removeQuery(index: number) {
    const next = queryDraft.filter((_, itemIndex) => itemIndex !== index);
    queryDraft = next;
    commitQueryObject(next);
  }

  function providerCategoryMappings() {
    return source.providerCategoryMappings ?? [];
  }

  function providerCategoryItems(index: number) {
    const current = providerCategoryMappings()[index]?.code;
    const selectedByOtherRows = new Set(
      providerCategoryMappings()
        .map((mapping) => mapping.code)
        .filter((code) => Boolean(code) && code !== current),
    );
    return providerCategories
      .filter((category) => !selectedByOtherRows.has(category.code))
      .map((category) => ({
        value: category.code,
        label: `${category.label} · ${category.code}`,
        keywords: [category.label, category.code],
      }));
  }

  function addProviderCategoryMapping() {
    onChange({
      ...source,
      providerCategoryMappings: [
        ...providerCategoryMappings(),
        { code: "", account: "" },
      ],
    });
  }

  function updateProviderCategoryMapping(
    index: number,
    patch: Partial<ProviderCategoryMapping>,
  ) {
    onChange({
      ...source,
      providerCategoryMappings: providerCategoryMappings().map(
        (mapping, itemIndex) =>
          itemIndex === index ? { ...mapping, ...patch } : mapping,
      ),
    });
  }

  function removeProviderCategoryMapping(index: number) {
    onChange({
      ...source,
      providerCategoryMappings: providerCategoryMappings().filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    });
  }

  function moveProviderCategoryMapping(index: number, direction: -1 | 1) {
    const current = providerCategoryMappings();
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange({ ...source, providerCategoryMappings: next });
  }

  function linkedAccounts() {
    return source.accounts ?? [];
  }

  function updateLinkedAccount(
    index: number,
    patch: Partial<JsonApiLinkedAccount>,
  ) {
    const current = linkedAccounts();
    onChange({
      ...source,
      accounts: current.map((account, itemIndex) =>
        itemIndex === index ? { ...account, ...patch } : account,
      ),
    });
  }

  function removeLinkedAccount(index: number) {
    onChange({
      ...source,
      accounts: linkedAccounts().filter((_, itemIndex) => itemIndex !== index),
    });
  }

  function moveLinkedAccount(index: number, direction: -1 | 1) {
    const current = linkedAccounts();
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange({ ...source, accounts: next });
  }

  function updateSourceName(name: string) {
    onChange({ ...source, name });
  }

  function reconciliationPriority(value: string) {
    const clean = value.trim();
    if (!clean) return undefined;
    const parsed = Number(clean);
    return Number.isInteger(parsed) ? parsed : undefined;
  }
</script>

<div class="ingestion-source-sections" data-ingestion-source-form>
  <section class="ingestion-source-section">
    <FormSectionHeader
      index={0}
      total={1}
      title={source.name ?? ""}
      titleLabel="Name"
      titlePlaceholder="Add Name"
      disclosureTitle={source.name || "source"}
      open={isSectionOpen("source-details")}
      movable={false}
      removable={true}
      removeLabel={`Remove ${source.name || "source"}`}
      onTitleChange={updateSourceName}
      {onRemove}
      onToggle={() => toggleSection("source-details")}
    >
      {#snippet actions()}
        <button
          type="button"
          class="ingestion-source-duplicate"
          aria-label={`Duplicate ${source.name || "source"}`}
          onclick={onDuplicate}
        >
          <Copy />
        </button>
      {/snippet}
    </FormSectionHeader>
    {#if isSectionOpen("source-details")}
      <div class="ingestion-section-body ingestion-source-nested">
        <StructuredForm
          value={source}
          config={detailsForm}
          context={formContext}
          issues={detailsIssues}
          {onChange}
        />

        <section class="ingestion-source-section">
          <FormSectionHeader
            index={0}
            total={1}
            title={connector ? "Connection" : "JSON API"}
            open={isSectionOpen("api")}
            editable={false}
            titleToggleable={true}
            movable={false}
            removable={false}
            onToggle={() => toggleSection("api")}
          />
          {#if isSectionOpen("api")}
            <div class="ingestion-section-body">
              {#if connector && connectionFieldsForm}
                <div class="beancount-structured-form">
                  <StructuredForm
                    value={source}
                    config={connectionFieldsForm}
                    context={formContext}
                    issues={detailsIssues}
                    {onChange}
                  />
                  {#if advancedFieldsForm}
                    <StructuredForm
                      value={source}
                      config={advancedFieldsForm}
                      context={formContext}
                      issues={detailsIssues}
                      {onChange}
                    />
                  {/if}
                </div>
              {:else}
                <div class="beancount-structured-form">
                  <StructuredForm
                    value={source}
                    config={apiForm}
                    context={formContext}
                    issues={detailsIssues}
                    {onChange}
                  />
                  {#if source.api?.pagination}
                    <StructuredForm
                      value={source}
                      config={sourcePaginationForm}
                      context={formContext}
                      issues={detailsIssues}
                      {onChange}
                    />
                  {/if}
                </div>

                <CollapsibleItemList
                  title="Query parameters"
                  addLabel="parameter"
                  count={queryDraft.length}
                  open={isSectionOpen("query-parameters")}
                  onToggle={() => toggleSection("query-parameters")}
                  onAdd={addQueryParam}
                >
                  {#each queryDraft as [key, value], index (index)}
                    <EntryActions
                      {index}
                      total={queryDraft.length}
                      removeLabel={`Remove query parameter ${index + 1}`}
                      onMove={(direction) => moveQuery(index, direction)}
                      onRemove={() => removeQuery(index)}
                    >
                      <div class="beancount-structured-form">
                        <FormField label="Name">
                          <Input
                            id={`query-${index}-name`}
                            value={key}
                            aria-label={`Query parameter ${index + 1} name`}
                            placeholder="Add name"
                            oninput={(event) =>
                              patchQueryDraft(
                                index,
                                0,
                                event.currentTarget.value,
                              )}
                          />
                        </FormField>
                        <FormField label="Value">
                          <Input
                            id={`query-${index}-value`}
                            {value}
                            aria-label={`Query parameter ${index + 1} value`}
                            placeholder="Add value"
                            oninput={(event) =>
                              patchQueryDraft(
                                index,
                                1,
                                event.currentTarget.value,
                              )}
                          />
                        </FormField>
                      </div>
                    </EntryActions>
                  {/each}
                </CollapsibleItemList>
              {/if}
            </div>
          {/if}
        </section>

        {#if grouped}
          <section class="ingestion-source-section">
            <FormSectionHeader
              index={0}
              total={1}
              title="Linked accounts"
              open={isSectionOpen("linked-accounts")}
              editable={false}
              titleToggleable={true}
              movable={false}
              removable={false}
              onToggle={() => toggleSection("linked-accounts")}
            />
            {#if isSectionOpen("linked-accounts")}
              <div class="ingestion-section-body">
                {#each linkedAccounts() as account, index (account.id)}
                  <EntryActions
                    {index}
                    total={linkedAccounts().length}
                    removeLabel={`Remove linked account ${account.name || account.id}`}
                    onMove={(direction) => moveLinkedAccount(index, direction)}
                    onRemove={() => removeLinkedAccount(index)}
                  >
                    <div class="beancount-structured-form">
                      <FormField label="Name" as="div" align="center">
                        <Input
                          id={`linked-account-${index}-name`}
                          value={account.name}
                          aria-label={`Linked account ${index + 1} name`}
                          oninput={(event) =>
                            updateLinkedAccount(index, {
                              name: event.currentTarget.value,
                            })}
                        />
                      </FormField>
                      <FormField label="Id" as="div" align="center">
                        <Input
                          id={`linked-account-${index}-id`}
                          value={account.id}
                          readonly
                          aria-label={`Linked account ${index + 1} id`}
                        />
                      </FormField>
                      <FormField label="Source account" as="div">
                        <FilterCommandPicker
                          fullWidth
                          label="Source account"
                          value={account.sourceAccount ?? ""}
                          options={accountItems}
                          placeholder="Filter accounts…"
                          onChange={(value) =>
                            updateLinkedAccount(index, {
                              sourceAccount: value,
                            })}
                        />
                      </FormField>
                      <FormField
                        label="Reconciliation priority"
                        as="div"
                        align="center"
                      >
                        <Input
                          id={`linked-account-${index}-priority`}
                          type="number"
                          step="1"
                          min="-100"
                          max="100"
                          value={account.reconciliationPriority === undefined
                            ? ""
                            : String(account.reconciliationPriority)}
                          placeholder="0"
                          aria-label={`Linked account ${index + 1} reconciliation priority`}
                          oninput={(event) =>
                            updateLinkedAccount(index, {
                              reconciliationPriority: reconciliationPriority(
                                event.currentTarget.value,
                              ),
                            })}
                        />
                      </FormField>
                    </div>
                  </EntryActions>
                {/each}
              </div>
            {/if}
          </section>
        {/if}

        {#if !connector}
          <section class="ingestion-source-section">
            <FormSectionHeader
              index={0}
              total={1}
              title="Record mapping"
              open={isSectionOpen("mapping")}
              editable={false}
              titleToggleable={true}
              movable={false}
              removable={false}
              onToggle={() => toggleSection("mapping")}
            />
            {#if isSectionOpen("mapping")}
              <div class="ingestion-section-body">
                <StructuredForm
                  value={source}
                  config={sourceMappingForm}
                  context={formContext}
                  issues={detailsIssues}
                  {onChange}
                />
              </div>
            {/if}
          </section>
        {/if}

        <section class="ingestion-source-section">
          <FormSectionHeader
            index={0}
            total={1}
            title="Categorisation and enrichment"
            open={isSectionOpen("enrichment")}
            editable={false}
            titleToggleable={true}
            movable={false}
            removable={false}
            onToggle={() => toggleSection("enrichment")}
          />
          {#if isSectionOpen("enrichment")}
            <div class="ingestion-section-body">
              <div class="beancount-structured-form">
                <StructuredForm
                  value={source}
                  config={sourceEnrichmentForm}
                  context={formContext}
                  issues={detailsIssues}
                  {onChange}
                />
                {#if source.merchantEnrichment}
                  <StructuredForm
                    value={source}
                    config={sourceEnrichmentDetailsForm}
                    context={formContext}
                    issues={detailsIssues}
                    {onChange}
                  />
                {/if}
              </div>
              {#if providerCategories.length}
                <CollapsibleItemList
                  title="Bank category mappings"
                  addLabel="mapping"
                  count={providerCategoryMappings().length}
                  open={isSectionOpen("provider-category-mappings")}
                  onToggle={() => toggleSection("provider-category-mappings")}
                  onAdd={addProviderCategoryMapping}
                >
                  {#each providerCategoryMappings() as mapping, index (`${mapping.code}:${index}`)}
                    <EntryActions
                      {index}
                      total={providerCategoryMappings().length}
                      removeLabel={`Remove bank category mapping ${index + 1}`}
                      onMove={(direction) =>
                        moveProviderCategoryMapping(index, direction)}
                      onRemove={() => removeProviderCategoryMapping(index)}
                    >
                      <div
                        class="beancount-structured-form"
                        data-provider-category-mapping
                      >
                        <FormField
                          label="Bank category"
                          as="div"
                          align="center"
                        >
                          <FilterCommandPicker
                            fullWidth
                            allowCustom={true}
                            label="Bank category"
                            ariaLabel={`Bank category mapping ${index + 1}`}
                            value={mapping.code}
                            options={providerCategoryItems(index)}
                            placeholder="Filter bank categories…"
                            onChange={(code) =>
                              updateProviderCategoryMapping(index, { code })}
                          />
                        </FormField>
                        <FormField
                          label="Ledger account"
                          as="div"
                          align="center"
                        >
                          <FilterCommandPicker
                            fullWidth
                            label="Ledger account"
                            ariaLabel={`Ledger account for bank category mapping ${index + 1}`}
                            value={mapping.account}
                            options={categoryAccountItems}
                            placeholder="Filter accounts…"
                            onChange={(account) =>
                              updateProviderCategoryMapping(index, { account })}
                          />
                        </FormField>
                      </div>
                    </EntryActions>
                  {/each}
                </CollapsibleItemList>
              {/if}
              <Button
                type="button"
                variant="link"
                class="h-auto gap-1 px-0 text-sm"
                onclick={openBrandSettings}
              >
                Manage brand matching
                <ArrowRight class="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          {/if}
        </section>
      </div>
    {/if}
  </section>
</div>

<style>
  .ingestion-source-sections {
    display: grid;
    gap: 1.5rem;
    min-width: 0;
  }

  .ingestion-source-section {
    min-width: 0;
  }

  .ingestion-section-body {
    margin-top: 0.75rem;
    padding-left: 0.5rem;
    min-width: 0;
    display: grid;
    gap: 0.75rem;
  }

  .ingestion-source-nested {
    gap: 1.5rem;
    /* Room for nested disclosure chevrons */
    padding-left: 1.5rem;
  }

  .ingestion-source-duplicate {
    display: grid;
    width: 1.25rem;
    height: 1.25rem;
    place-items: center;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: var(
      --cv-form-muted,
      var(--beancount-form-muted, var(--muted-foreground))
    );
    cursor: pointer;
    padding: 0;
  }

  .ingestion-source-duplicate :global(svg) {
    width: 0.75rem;
    height: 0.75rem;
  }

  .ingestion-source-duplicate:hover,
  .ingestion-source-duplicate:focus-visible {
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    outline: 0;
  }
</style>
