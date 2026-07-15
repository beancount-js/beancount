<script lang="ts" module>
  export const sourceFormSections = [
    "source-details",
    "api",
    "query-parameters",
    "mapping",
    "rules",
    "enrichment",
  ] as const;

  export const groupedSourceFormSections = [
    "source-details",
    "api",
    "linked-accounts",
    "query-parameters",
    "mapping",
    "rules",
    "enrichment",
  ] as const;

  export function ruleSectionId(index: number) {
    return `rule-${index}`;
  }

  export function sourceFormSectionIds(ruleCount: number, grouped = false) {
    const sections = grouped ? groupedSourceFormSections : sourceFormSections;
    return [
      ...sections,
      ...Array.from({ length: ruleCount }, (_, index) => ruleSectionId(index)),
    ];
  }
</script>

<script lang="ts">
  import {
    CollapsibleItemList,
    EntryActions,
    FormAddButton,
    FormField,
    FormSectionHeader,
    StructuredForm,
    type FormValidationIssue,
  } from "@beancount-js/forms";
  import {
    isGroupedJsonApiSource,
    type JsonApiLinkedAccount,
    type MerchantRule,
  } from "@beancount-js/beangulp";
  import Copy from "lucide-svelte/icons/copy";
  import { untrack } from "svelte";
  import { Input } from "$lib/components/ui/input";
  import type { EditableIngestionSource } from "../ingestion/source-form";
  import {
    createRuleForm,
    sourceApiForm,
    sourceApiGroupedForm,
    sourceBrandfetchForm,
    sourceDetailsForm,
    sourceDetailsGroupedForm,
    sourceEnrichmentDetailsForm,
    sourceEnrichmentForm,
    sourceMappingForm,
    sourcePaginationForm,
    type SourceFormContext,
  } from "../ingestion/source-form-config";
  import ComboBox from "./ComboBox.svelte";

  type KeyValue = [string, string];

  let {
    source,
    accounts = [],
    issues = [],
    credentialAvailable,
    merchantCredentialAvailable,
    openSections = [...sourceFormSections],
    onOpenSectionsChange = () => {},
    onChange,
    onDuplicate = () => {},
    onRemove = () => {},
  }: {
    source: EditableIngestionSource;
    accounts?: string[];
    issues?: FormValidationIssue[];
    credentialAvailable?: boolean;
    merchantCredentialAvailable?: boolean;
    openSections?: string[];
    onOpenSectionsChange?: (sections: string[]) => void;
    onChange: (source: EditableIngestionSource) => void;
    onDuplicate?: () => void;
    onRemove?: () => void;
  } = $props();

  let queryDraft: KeyValue[] = $state([]);

  const grouped = $derived(isGroupedJsonApiSource(source));
  const detailsForm = $derived(
    grouped ? sourceDetailsGroupedForm : sourceDetailsForm,
  );
  const apiForm = $derived(grouped ? sourceApiGroupedForm : sourceApiForm);
  const formContext = $derived({
    accounts,
    credentialAvailable,
    merchantCredentialAvailable,
  } satisfies SourceFormContext);
  const accountItems = $derived(
    accounts.map((account) => ({ label: account, value: account })),
  );

  const detailsIssues = $derived(augmentCredentialIssues(issues));

  const sourceQueryFingerprint = $derived(
    `${source.id}:${JSON.stringify(source.api.query ?? {})}`,
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
      queryDraft = Object.entries(source.api.query ?? {});
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
    if (merchantCredentialAvailable === false) {
      next.push({
        fieldId: "merchantEnrichment.brandfetch.apiKeySecretRef",
        message: "Brandfetch credential is not available",
        severity: "warning",
      });
    }
    return next;
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
      accounts: linkedAccounts().filter(
        (_, itemIndex) => itemIndex !== index,
      ),
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

  function rules() {
    return source.rules ?? [];
  }

  function updateRules(next: MerchantRule[]) {
    onChange({ ...source, rules: next });
  }

  function remapOpenRuleSections(
    mapper: (ruleIndex: number) => number | null,
  ) {
    const next = openSections
      .map((id) => {
        const match = /^rule-(\d+)$/.exec(id);
        if (!match) return id;
        const mapped = mapper(Number(match[1]));
        return mapped === null ? null : ruleSectionId(mapped);
      })
      .filter((id): id is string => id !== null);
    onOpenSectionsChange(next);
  }

  function moveRule(index: number, direction: -1 | 1) {
    const current = rules();
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    updateRules(next);
    remapOpenRuleSections((ruleIndex) => {
      if (ruleIndex === index) return target;
      if (ruleIndex === target) return index;
      return ruleIndex;
    });
  }

  function addRule() {
    const index = rules().length;
    const expected = sourceFormSectionIds(index, grouped);
    const expandedAll =
      openSections.length === expected.length &&
      expected.every((id) => openSections.includes(id));
    updateRules([...rules(), { merchant: "", account: "" }]);
    if (expandedAll) {
      onOpenSectionsChange([...openSections, ruleSectionId(index)]);
    }
  }

  function removeRule(index: number) {
    updateRules(rules().filter((_, itemIndex) => itemIndex !== index));
    remapOpenRuleSections((ruleIndex) => {
      if (ruleIndex === index) return null;
      if (ruleIndex > index) return ruleIndex - 1;
      return ruleIndex;
    });
  }

  function updateRuleMerchant(index: number, merchant: string) {
    const nextMerchant = merchant.trim() || undefined;
    const current = rules();
    updateRules(
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, merchant: nextMerchant } : item,
      ),
    );
  }

  function updateSourceName(name: string) {
    onChange({ ...source, name });
  }
</script>

<div class="ingestion-source-sections" data-ingestion-source-form>
  <section class="ingestion-source-section">
    <FormSectionHeader
      title={source.name ?? ""}
      titleLabel="Name"
      titlePlaceholder="Add Name"
      disclosureTitle={source.name || "source"}
      open={isSectionOpen("source-details")}
      movable={false}
      removable={true}
      removeLabel={`Remove ${source.name || "source"}`}
      onTitleChange={updateSourceName}
      onRemove={onRemove}
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
          onChange={onChange}
        />

        <section class="ingestion-source-section">
          <FormSectionHeader
            title="JSON API"
            open={isSectionOpen("api")}
            editable={false}
            titleToggleable={true}
            movable={false}
            removable={false}
            onToggle={() => toggleSection("api")}
          />
          {#if isSectionOpen("api")}
            <div class="ingestion-section-body">
              <div class="beancount-structured-form">
                <StructuredForm
                  value={source}
                  config={apiForm}
                  context={formContext}
                  issues={detailsIssues}
                  embedded
                  onChange={onChange}
                />
                {#if source.api.pagination}
                  <StructuredForm
                    value={source}
                    config={sourcePaginationForm}
                    context={formContext}
                    issues={detailsIssues}
                    embedded
                    onChange={onChange}
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
                      <FormField label="Name" controlId={`query-${index}-name`}>
                        <Input
                          id={`query-${index}-name`}
                          value={key}
                          aria-label={`Query parameter ${index + 1} name`}
                          placeholder="Add name"
                          oninput={(event) =>
                            patchQueryDraft(index, 0, event.currentTarget.value)}
                        />
                      </FormField>
                      <FormField
                        label="Value"
                        controlId={`query-${index}-value`}
                      >
                        <Input
                          id={`query-${index}-value`}
                          {value}
                          aria-label={`Query parameter ${index + 1} value`}
                          placeholder="Add value"
                          oninput={(event) =>
                            patchQueryDraft(index, 1, event.currentTarget.value)}
                        />
                      </FormField>
                    </div>
                  </EntryActions>
                {/each}
              </CollapsibleItemList>
            </div>
          {/if}
        </section>

        {#if grouped}
          <section class="ingestion-source-section">
            <FormSectionHeader
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
                      <FormField
                        label="Name"
                        controlId={`linked-account-${index}-name`}
                      >
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
                      <FormField
                        label="Id"
                        controlId={`linked-account-${index}-id`}
                      >
                        <Input
                          id={`linked-account-${index}-id`}
                          value={account.id}
                          readonly
                          aria-label={`Linked account ${index + 1} id`}
                        />
                      </FormField>
                      <FormField
                        label="Source account"
                        controlId={`linked-account-${index}-source`}
                        as="div"
                      >
                        <ComboBox
                          items={accountItems}
                          value={account.sourceAccount ?? ""}
                          placeholder="Select account"
                          onValueChange={(value) =>
                            updateLinkedAccount(index, {
                              sourceAccount: value,
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

        <section class="ingestion-source-section">
          <FormSectionHeader
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
                onChange={onChange}
              />
            </div>
          {/if}
        </section>

        <section class="ingestion-source-section">
          <FormSectionHeader
            title="Merchant rules"
            open={isSectionOpen("rules")}
            editable={false}
            titleToggleable={true}
            movable={false}
            removable={false}
            onToggle={() => toggleSection("rules")}
          />
          {#if isSectionOpen("rules")}
            <div class="ingestion-section-body">
              {#each rules() as rule, index (index)}
                <div
                  class="ingestion-rule"
                  aria-label={`Merchant rule ${index + 1}`}
                >
                  <FormSectionHeader
                    title={rule.merchant ?? ""}
                    titleLabel="Merchant"
                    titlePlaceholder="Add Merchant"
                    {index}
                    total={rules().length}
                    open={isSectionOpen(ruleSectionId(index))}
                    removeLabel={`Remove rule ${index + 1}`}
                    onTitleChange={(value) => updateRuleMerchant(index, value)}
                    onMove={(direction) => moveRule(index, direction)}
                    onRemove={() => removeRule(index)}
                    onToggle={() => toggleSection(ruleSectionId(index))}
                  />
                  {#if isSectionOpen(ruleSectionId(index))}
                    <div class="ingestion-rule-body">
                      <StructuredForm
                        value={rule}
                        config={createRuleForm(index)}
                        context={formContext}
                        onChange={(next) => {
                          const current = rules();
                          updateRules(
                            current.map((item, itemIndex) =>
                              itemIndex === index ? next : item,
                            ),
                          );
                        }}
                      />
                    </div>
                  {/if}
                </div>
              {/each}
              <div class="ingestion-array-footer">
                <FormAddButton label="Add rule" onclick={addRule} />
              </div>
            </div>
          {/if}
        </section>

        <section class="ingestion-source-section">
          <FormSectionHeader
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
                  embedded
                  onChange={onChange}
                />
                {#if source.merchantEnrichment}
                  <StructuredForm
                    value={source}
                    config={sourceEnrichmentDetailsForm}
                    context={formContext}
                    issues={detailsIssues}
                    embedded
                    onChange={onChange}
                  />
                  {#if source.merchantEnrichment.brandfetch}
                    <StructuredForm
                      value={source}
                      config={sourceBrandfetchForm}
                      context={formContext}
                      issues={detailsIssues}
                      embedded
                      onChange={onChange}
                    />
                  {/if}
                {/if}
              </div>
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

  .ingestion-array-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
  }

  .ingestion-rule {
    min-width: 0;
    display: grid;
    gap: 0.75rem;
  }

  .ingestion-rule-body {
    padding-left: 0.5rem;
    min-width: 0;
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
