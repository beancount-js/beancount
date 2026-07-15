<script lang="ts" module>
  export const sourceFormSections = [
    "source-details",
    "api",
    "mapping",
    "rules",
    "enrichment",
  ] as const;
</script>

<script lang="ts">
  import {
    FormField as IngestionFormRow,
    FormSectionHeader,
    type FormValidationIssue,
  } from "@beancount-js/forms";
  import type {
    BrandfetchEnrichmentConfig,
    MerchantEnrichmentConfig,
  } from "@beancount-js/server";
  import type { MerchantRule } from "@beancount-js/beangulp";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { Switch } from "$lib/components/ui/switch";
  import type { EditableIngestionSource } from "../ingestion/source-form";

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
  }: {
    source: EditableIngestionSource;
    accounts?: string[];
    issues?: FormValidationIssue[];
    credentialAvailable?: boolean;
    merchantCredentialAvailable?: boolean;
    openSections?: string[];
    onOpenSectionsChange?: (sections: string[]) => void;
    onChange: (source: EditableIngestionSource) => void;
  } = $props();

  const defaultBrandfetch: BrandfetchEnrichmentConfig = {
    enabled: false,
    apiKeySecretRef: "env:BRANDFETCH_API_KEY",
    assetMode: "hotlink",
  };
  const mappingFields = [
    { key: "id", label: "Import ID" },
    { key: "date", label: "Date" },
    { key: "amount", label: "Amount" },
    { key: "currency", label: "Currency" },
    { key: "merchant", label: "Merchant" },
    { key: "payee", label: "Payee" },
    { key: "narration", label: "Narration" },
    { key: "status", label: "Status" },
    { key: "dateFormat", label: "Date format" },
  ] as const;

  function messages(fieldId: string) {
    return issues
      .filter((issue) => issue.fieldId === fieldId)
      .map((issue) => issue.message);
  }

  function invalid(fieldId: string) {
    return messages(fieldId).length > 0;
  }

  function optional(value: string) {
    const next = value.trim();
    return next || undefined;
  }

  function change(next: EditableIngestionSource) {
    onChange(next);
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

  function updateApi(key: string, value: unknown) {
    change({ ...source, api: { ...source.api, [key]: value } });
  }

  function updateMapping(key: string, value: unknown) {
    change({ ...source, mapping: { ...source.mapping, [key]: value } });
  }

  function updateStringList(
    parent: "api" | "source",
    key: string,
    value: string,
  ) {
    const list = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (parent === "api") {
      change({
        ...source,
        api: { ...source.api, [key]: list.length ? list : undefined },
      });
      return;
    }
    change({ ...source, [key]: list.length ? list : undefined });
  }

  function queryEntries(): KeyValue[] {
    return Object.entries(source.api.query ?? {});
  }

  function updateQuery(entries: KeyValue[]) {
    const query = Object.fromEntries(
      entries
        .map(([key, value]) => [key.trim(), value] as KeyValue)
        .filter(([key]) => Boolean(key)),
    );
    updateApi("query", Object.keys(query).length ? query : undefined);
  }

  function patchQuery(index: number, part: 0 | 1, value: string) {
    const entries = queryEntries();
    const current = entries[index] ?? ["", ""];
    entries[index] = part === 0 ? [value, current[1]] : [current[0], value];
    updateQuery(entries);
  }

  function removeQuery(index: number) {
    updateQuery(queryEntries().filter((_, itemIndex) => itemIndex !== index));
  }

  function updatePagination(
    key: "cursorQueryParam" | "nextCursorPath",
    value: string,
  ) {
    const current = source.api.pagination;
    updateApi(
      "pagination",
      current
        ? { ...current, [key]: value }
        : {
            cursorQueryParam: key === "cursorQueryParam" ? value : "",
            nextCursorPath: key === "nextCursorPath" ? value : "",
          },
    );
  }

  function togglePagination(enabled: boolean) {
    updateApi(
      "pagination",
      enabled
        ? { cursorQueryParam: "cursor", nextCursorPath: "next_cursor" }
        : undefined,
    );
  }

  function rules() {
    return source.rules ?? [];
  }

  function updateRules(next: MerchantRule[]) {
    change({ ...source, rules: next });
  }

  function patchRule(index: number, key: keyof MerchantRule, value: string) {
    const next = rules().map((rule, itemIndex) =>
      itemIndex === index ? { ...rule, [key]: optional(value) } : rule,
    );
    updateRules(next);
  }

  function addRule() {
    updateRules([...rules(), { merchant: "", account: "" }]);
  }

  function removeRule(index: number) {
    updateRules(rules().filter((_, itemIndex) => itemIndex !== index));
  }

  function updateEnrichment(next: MerchantEnrichmentConfig | undefined) {
    change({ ...source, merchantEnrichment: next });
  }

  function patchEnrichment(
    key: keyof MerchantEnrichmentConfig,
    value: unknown,
  ) {
    const current = source.merchantEnrichment ?? { enabled: false };
    updateEnrichment({ ...current, [key]: value });
  }

  function toggleEnrichment(enabled: boolean) {
    updateEnrichment(enabled ? { enabled: false } : undefined);
  }

  function updateBrandfetch(next: BrandfetchEnrichmentConfig | undefined) {
    const current = source.merchantEnrichment ?? { enabled: false };
    updateEnrichment({ ...current, brandfetch: next });
  }

  function patchBrandfetch(
    key: keyof BrandfetchEnrichmentConfig,
    value: unknown,
  ) {
    updateBrandfetch({
      ...(source.merchantEnrichment?.brandfetch ?? defaultBrandfetch),
      [key]: value,
    });
  }

  function toggleBrandfetch(enabled: boolean) {
    updateBrandfetch(enabled ? { ...defaultBrandfetch } : undefined);
  }
</script>

<datalist id="ingestion-source-accounts">
  {#each accounts as account}
    <option value={account}></option>
  {/each}
</datalist>

<div class="ingestion-source-sections" data-ingestion-source-form>
  <section class="ingestion-source-section">
    <FormSectionHeader
      title="Source details"
      open={isSectionOpen("source-details")}
      onToggle={() => toggleSection("source-details")}
    />
    {#if isSectionOpen("source-details")}
      <div class="beancount-structured-form ingestion-structured-form">
        <IngestionFormRow
          label="Identifier"
          controlId="ingestion-source-id"
          invalid={invalid("id")}
          messages={messages("id")}
        >
          <Input
            id="ingestion-source-id"
            value={source.id}
            aria-invalid={invalid("id") || undefined}
            oninput={(event) =>
              change({ ...source, id: event.currentTarget.value })}
          />
        </IngestionFormRow>
        <IngestionFormRow
          label="Name"
          controlId="ingestion-source-name"
          invalid={invalid("name")}
          messages={messages("name")}
        >
          <Input
            id="ingestion-source-name"
            value={source.name}
            aria-invalid={invalid("name") || undefined}
            oninput={(event) =>
              change({ ...source, name: event.currentTarget.value })}
          />
        </IngestionFormRow>
        <IngestionFormRow
          label="Source account"
          controlId="ingestion-source-account"
          invalid={invalid("sourceAccount")}
          messages={messages("sourceAccount")}
        >
          <Input
            id="ingestion-source-account"
            list="ingestion-source-accounts"
            value={source.sourceAccount}
            aria-invalid={invalid("sourceAccount") || undefined}
            oninput={(event) =>
              change({ ...source, sourceAccount: event.currentTarget.value })}
          />
        </IngestionFormRow>
        <IngestionFormRow
          label="Destination file"
          controlId="ingestion-destination-path"
        >
          <Input
            id="ingestion-destination-path"
            value={source.destinationPath ?? ""}
            placeholder="Project entry file"
            oninput={(event) =>
              change({
                ...source,
                destinationPath: optional(event.currentTarget.value),
              })}
          />
        </IngestionFormRow>
        <IngestionFormRow
          label="Default currency"
          controlId="ingestion-default-currency"
        >
          <Input
            id="ingestion-default-currency"
            value={source.defaultCurrency ?? ""}
            placeholder="GBP"
            oninput={(event) =>
              change({
                ...source,
                defaultCurrency: optional(
                  event.currentTarget.value,
                )?.toUpperCase(),
              })}
          />
        </IngestionFormRow>
        <IngestionFormRow
          label="Allowed account roots"
          controlId="ingestion-account-roots"
        >
          <Input
            id="ingestion-account-roots"
            value={(source.allowedAccountRoots ?? []).join(", ")}
            placeholder="Expenses, Income"
            oninput={(event) =>
              updateStringList(
                "source",
                "allowedAccountRoots",
                event.currentTarget.value,
              )}
          />
        </IngestionFormRow>
      </div>
    {/if}
  </section>

  <section class="ingestion-source-section">
    <FormSectionHeader
      title="JSON API"
      open={isSectionOpen("api")}
      onToggle={() => toggleSection("api")}
    />
    {#if isSectionOpen("api")}
      <div class="beancount-structured-form ingestion-structured-form">
        <IngestionFormRow
          label="Endpoint"
          controlId="ingestion-api-endpoint"
          invalid={invalid("api.endpoint")}
          messages={messages("api.endpoint")}
        >
          <Input
            id="ingestion-api-endpoint"
            type="url"
            value={source.api.endpoint}
            aria-invalid={invalid("api.endpoint") || undefined}
            placeholder="https://api.example.com/transactions"
            oninput={(event) =>
              updateApi("endpoint", event.currentTarget.value)}
          />
        </IngestionFormRow>
        <IngestionFormRow
          label="Credential reference"
          controlId="ingestion-api-secret-ref"
          invalid={invalid("api.secretRef")}
          messages={messages("api.secretRef")}
        >
          <Input
            id="ingestion-api-secret-ref"
            value={source.api.secretRef}
            aria-invalid={invalid("api.secretRef") || undefined}
            placeholder="env:BANK_API_TOKEN"
            oninput={(event) =>
              updateApi("secretRef", event.currentTarget.value)}
          />
          {#if credentialAvailable !== undefined}
            <p
              class={credentialAvailable
                ? "mt-1.5 text-xs text-emerald-600"
                : "mt-1.5 text-xs text-destructive"}
            >
              {credentialAvailable
                ? "Credential available"
                : "Credential is not available in this environment"}
            </p>
          {/if}
        </IngestionFormRow>
        <IngestionFormRow
          label="Records path"
          controlId="ingestion-api-records-path"
        >
          <Input
            id="ingestion-api-records-path"
            value={source.api.recordsPath ?? ""}
            placeholder="transactions"
            oninput={(event) =>
              updateApi("recordsPath", optional(event.currentTarget.value))}
          />
        </IngestionFormRow>
        <IngestionFormRow
          label="Allowed hosts"
          controlId="ingestion-api-allowed-hosts"
          invalid={invalid("api.allowedHosts")}
          messages={messages("api.allowedHosts")}
        >
          <Input
            id="ingestion-api-allowed-hosts"
            value={(source.api.allowedHosts ?? []).join(", ")}
            placeholder="api.example.com"
            aria-invalid={invalid("api.allowedHosts") || undefined}
            oninput={(event) =>
              updateStringList(
                "api",
                "allowedHosts",
                event.currentTarget.value,
              )}
          />
        </IngestionFormRow>
        <IngestionFormRow label="Cursor pagination" align="center">
          <Switch
            size="sm"
            checked={Boolean(source.api.pagination)}
            aria-label="Configure cursor pagination"
            onCheckedChange={togglePagination}
          />
        </IngestionFormRow>
        {#if source.api.pagination}
          <div
            class="beancount-structured-form ingestion-structured-form nested-form"
          >
            <IngestionFormRow
              label="Cursor parameter"
              controlId="ingestion-pagination-cursor"
            >
              <Input
                id="ingestion-pagination-cursor"
                value={source.api.pagination.cursorQueryParam}
                oninput={(event) =>
                  updatePagination(
                    "cursorQueryParam",
                    event.currentTarget.value,
                  )}
              />
            </IngestionFormRow>
            <IngestionFormRow
              label="Next cursor path"
              controlId="ingestion-pagination-next"
            >
              <Input
                id="ingestion-pagination-next"
                value={source.api.pagination.nextCursorPath}
                oninput={(event) =>
                  updatePagination("nextCursorPath", event.currentTarget.value)}
              />
            </IngestionFormRow>
          </div>
        {/if}
        <div class="border-t py-3">
          <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-medium">Query parameters</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              onclick={() => updateQuery([...queryEntries(), ["", ""]])}
              >Add parameter</Button
            >
          </div>
          {#if queryEntries().length}
            <div class="grid gap-2">
              {#each queryEntries() as [key, value], index (index)}
                <div
                  class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
                >
                  <Input
                    value={key}
                    aria-label={`Query parameter ${index + 1} name`}
                    placeholder="name"
                    oninput={(event) =>
                      patchQuery(index, 0, event.currentTarget.value)}
                  />
                  <Input
                    {value}
                    aria-label={`Query parameter ${index + 1} value`}
                    placeholder="value"
                    oninput={(event) =>
                      patchQuery(index, 1, event.currentTarget.value)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove query parameter ${index + 1}`}
                    onclick={() => removeQuery(index)}>Remove</Button
                  >
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-muted-foreground">
              No static query parameters.
            </p>
          {/if}
        </div>
      </div>
    {/if}
  </section>

  <section class="ingestion-source-section">
    <FormSectionHeader
      title="Record mapping"
      open={isSectionOpen("mapping")}
      onToggle={() => toggleSection("mapping")}
    />
    {#if isSectionOpen("mapping")}
      <div class="beancount-structured-form ingestion-structured-form">
        {#each mappingFields as field (field.key)}
          <IngestionFormRow
            label={field.label}
            controlId={`ingestion-mapping-${field.key}`}
            invalid={invalid(`mapping.${field.key}`)}
            messages={messages(`mapping.${field.key}`)}
          >
            <Input
              id={`ingestion-mapping-${field.key}`}
              value={source.mapping[field.key] ?? ""}
              aria-invalid={invalid(`mapping.${field.key}`) || undefined}
              oninput={(event) =>
                updateMapping(field.key, optional(event.currentTarget.value))}
            />
          </IngestionFormRow>
        {/each}
        <IngestionFormRow label="Amount sign" controlId="ingestion-amount-sign">
          <Select.Root
            type="single"
            value={source.mapping.amountSign ?? "as-is"}
            onValueChange={(value) =>
              updateMapping(
                "amountSign",
                value === "as-is" ? undefined : value,
              )}
          >
            <Select.Trigger id="ingestion-amount-sign" aria-label="Amount sign">
              <span
                >{source.mapping.amountSign === "invert"
                  ? "Invert"
                  : "As-is"}</span
              >
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                <Select.Item value="as-is" label="As-is" />
                <Select.Item value="invert" label="Invert" />
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </IngestionFormRow>
      </div>
    {/if}
  </section>

  <section class="ingestion-source-section">
    <FormSectionHeader
      title="Merchant rules"
      open={isSectionOpen("rules")}
      onToggle={() => toggleSection("rules")}
    />
    {#if isSectionOpen("rules")}
      <div class="flex flex-col gap-3">
        <div class="flex justify-end">
          <Button size="sm" variant="outline" onclick={addRule}>Add rule</Button
          >
        </div>
        {#if rules().length}
          {#each rules() as rule, index (index)}
            <section class="border-b" aria-label={`Merchant rule ${index + 1}`}>
              <div class="flex items-center justify-between gap-3 py-2.5">
                <h3 class="text-sm font-medium">Rule {index + 1}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onclick={() => removeRule(index)}
                >
                  Remove rule
                </Button>
              </div>
              <div
                class="beancount-structured-form ingestion-structured-form nested-form"
              >
                <IngestionFormRow
                  label="Merchant"
                  controlId={`ingestion-rule-${index}-merchant`}
                >
                  <Input
                    id={`ingestion-rule-${index}-merchant`}
                    value={rule.merchant ?? ""}
                    oninput={(event) =>
                      patchRule(index, "merchant", event.currentTarget.value)}
                  />
                </IngestionFormRow>
                <IngestionFormRow
                  label="Merchant ID"
                  controlId={`ingestion-rule-${index}-merchant-id`}
                >
                  <Input
                    id={`ingestion-rule-${index}-merchant-id`}
                    value={rule.merchantId ?? ""}
                    oninput={(event) =>
                      patchRule(index, "merchantId", event.currentTarget.value)}
                  />
                </IngestionFormRow>
                <IngestionFormRow
                  label="Category account"
                  controlId={`ingestion-rule-${index}-account`}
                >
                  <Input
                    id={`ingestion-rule-${index}-account`}
                    list="ingestion-source-accounts"
                    value={rule.account}
                    oninput={(event) =>
                      patchRule(index, "account", event.currentTarget.value)}
                  />
                </IngestionFormRow>
                <IngestionFormRow
                  label="Match source account"
                  controlId={`ingestion-rule-${index}-source-account`}
                >
                  <Input
                    id={`ingestion-rule-${index}-source-account`}
                    list="ingestion-source-accounts"
                    value={rule.sourceAccount ?? ""}
                    oninput={(event) =>
                      patchRule(
                        index,
                        "sourceAccount",
                        event.currentTarget.value,
                      )}
                  />
                </IngestionFormRow>
                <IngestionFormRow
                  label="Direction"
                  controlId={`ingestion-rule-${index}-direction`}
                >
                  <Select.Root
                    type="single"
                    value={rule.direction ?? "any"}
                    onValueChange={(value) =>
                      patchRule(
                        index,
                        "direction",
                        value === "any" ? "" : value,
                      )}
                  >
                    <Select.Trigger
                      id={`ingestion-rule-${index}-direction`}
                      aria-label={`Rule ${index + 1} direction`}
                    >
                      <span>{rule.direction ?? "Any direction"}</span>
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Group>
                        <Select.Item value="any" label="Any direction" />
                        <Select.Item value="debit" label="Debit" />
                        <Select.Item value="credit" label="Credit" />
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                </IngestionFormRow>
              </div>
            </section>
          {/each}
        {:else}
          <div class="flex justify-end border-b py-3">
            <Button size="sm" variant="outline" onclick={addRule}
              >Add rule</Button
            >
          </div>
        {/if}
      </div>
    {/if}
  </section>

  <section class="ingestion-source-section">
    <FormSectionHeader
      title="Categorisation and enrichment"
      open={isSectionOpen("enrichment")}
      onToggle={() => toggleSection("enrichment")}
    />
    {#if isSectionOpen("enrichment")}
      <div class="beancount-structured-form ingestion-structured-form">
        <IngestionFormRow label="AI categorisation" align="center">
          <Switch
            size="sm"
            checked={source.aiEnabled === true}
            aria-label="Enable AI categorisation"
            onCheckedChange={(value) =>
              change({ ...source, aiEnabled: value || undefined })}
          />
        </IngestionFormRow>
        <IngestionFormRow label="Merchant enrichment" align="center">
          <Switch
            size="sm"
            checked={Boolean(source.merchantEnrichment)}
            aria-label="Configure merchant enrichment"
            onCheckedChange={toggleEnrichment}
          />
        </IngestionFormRow>

        {#if source.merchantEnrichment}
          <div
            class="beancount-structured-form ingestion-structured-form nested-form"
          >
            <IngestionFormRow label="Enable enrichment" align="center">
              <Switch
                size="sm"
                checked={source.merchantEnrichment.enabled}
                aria-label="Enable merchant enrichment"
                onCheckedChange={(value) => patchEnrichment("enabled", value)}
              />
            </IngestionFormRow>
            <IngestionFormRow label="Use AI for enrichment" align="center">
              <Switch
                size="sm"
                checked={source.merchantEnrichment.aiEnabled === true}
                aria-label="Enable AI merchant enrichment"
                onCheckedChange={(value) =>
                  patchEnrichment("aiEnabled", value || undefined)}
              />
            </IngestionFormRow>
            <IngestionFormRow
              label="Country code"
              controlId="ingestion-enrichment-country"
              invalid={invalid("merchantEnrichment.countryCode")}
              messages={messages("merchantEnrichment.countryCode")}
            >
              <Input
                id="ingestion-enrichment-country"
                value={source.merchantEnrichment.countryCode ?? ""}
                placeholder="GB"
                aria-invalid={invalid("merchantEnrichment.countryCode") ||
                  undefined}
                oninput={(event) =>
                  patchEnrichment(
                    "countryCode",
                    optional(event.currentTarget.value)?.toUpperCase(),
                  )}
              />
            </IngestionFormRow>
            <IngestionFormRow label="Brandfetch" align="center">
              <Switch
                size="sm"
                checked={Boolean(source.merchantEnrichment.brandfetch)}
                aria-label="Configure Brandfetch"
                onCheckedChange={toggleBrandfetch}
              />
            </IngestionFormRow>

            {#if source.merchantEnrichment.brandfetch}
              <div
                class="beancount-structured-form ingestion-structured-form nested-form"
              >
                <IngestionFormRow label="Enable Brandfetch" align="center">
                  <Switch
                    size="sm"
                    checked={source.merchantEnrichment.brandfetch.enabled}
                    aria-label="Enable Brandfetch"
                    onCheckedChange={(value) =>
                      patchBrandfetch("enabled", value)}
                  />
                </IngestionFormRow>
                <IngestionFormRow label="Allow name search" align="center">
                  <Switch
                    size="sm"
                    checked={source.merchantEnrichment.brandfetch
                      .allowNameSearch === true}
                    aria-label="Allow Brandfetch name search"
                    onCheckedChange={(value) =>
                      patchBrandfetch("allowNameSearch", value || undefined)}
                  />
                </IngestionFormRow>
                <IngestionFormRow
                  label="Allow transaction lookup"
                  align="center"
                >
                  <Switch
                    size="sm"
                    checked={source.merchantEnrichment.brandfetch
                      .allowTransactionLookup === true}
                    aria-label="Allow Brandfetch transaction lookup"
                    onCheckedChange={(value) =>
                      patchBrandfetch(
                        "allowTransactionLookup",
                        value || undefined,
                      )}
                  />
                </IngestionFormRow>
                <IngestionFormRow label="Allow content caching" align="center">
                  <Switch
                    size="sm"
                    checked={source.merchantEnrichment.brandfetch
                      .cacheContentAllowed === true}
                    aria-label="Allow Brandfetch cache content"
                    onCheckedChange={(value) =>
                      patchBrandfetch(
                        "cacheContentAllowed",
                        value || undefined,
                      )}
                  />
                </IngestionFormRow>
                <IngestionFormRow
                  label="API key reference"
                  controlId="ingestion-brandfetch-api-key"
                  invalid={invalid(
                    "merchantEnrichment.brandfetch.apiKeySecretRef",
                  )}
                  messages={messages(
                    "merchantEnrichment.brandfetch.apiKeySecretRef",
                  )}
                >
                  <Input
                    id="ingestion-brandfetch-api-key"
                    value={source.merchantEnrichment.brandfetch.apiKeySecretRef}
                    aria-invalid={invalid(
                      "merchantEnrichment.brandfetch.apiKeySecretRef",
                    ) || undefined}
                    oninput={(event) =>
                      patchBrandfetch(
                        "apiKeySecretRef",
                        event.currentTarget.value,
                      )}
                  />
                  {#if merchantCredentialAvailable !== undefined}
                    <p
                      class={merchantCredentialAvailable
                        ? "mt-1.5 text-xs text-emerald-600"
                        : "mt-1.5 text-xs text-destructive"}
                    >
                      {merchantCredentialAvailable
                        ? "Brandfetch credential available"
                        : "Brandfetch credential is not available"}
                    </p>
                  {/if}
                </IngestionFormRow>
                <IngestionFormRow
                  label="Client ID"
                  controlId="ingestion-brandfetch-client-id"
                >
                  <Input
                    id="ingestion-brandfetch-client-id"
                    value={source.merchantEnrichment.brandfetch.clientId ?? ""}
                    oninput={(event) =>
                      patchBrandfetch(
                        "clientId",
                        optional(event.currentTarget.value),
                      )}
                  />
                </IngestionFormRow>
                <IngestionFormRow
                  label="Asset mode"
                  controlId="ingestion-brandfetch-asset-mode"
                >
                  <Select.Root
                    type="single"
                    value={source.merchantEnrichment.brandfetch.assetMode ??
                      "hotlink"}
                    onValueChange={(value) =>
                      patchBrandfetch("assetMode", value)}
                  >
                    <Select.Trigger
                      id="ingestion-brandfetch-asset-mode"
                      aria-label="Brandfetch asset mode"
                    >
                      <span
                        >{source.merchantEnrichment.brandfetch.assetMode ??
                          "hotlink"}</span
                      >
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Group>
                        <Select.Item value="hotlink" label="Hotlink" />
                        <Select.Item value="cache" label="Cache" />
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                </IngestionFormRow>
                <IngestionFormRow
                  label="Cache TTL (days)"
                  controlId="ingestion-brandfetch-ttl"
                >
                  <Input
                    id="ingestion-brandfetch-ttl"
                    type="number"
                    min="1"
                    max="29"
                    value={source.merchantEnrichment.brandfetch.ttlDays ?? ""}
                    oninput={(event) =>
                      patchBrandfetch(
                        "ttlDays",
                        event.currentTarget.value
                          ? Number(event.currentTarget.value)
                          : undefined,
                      )}
                  />
                </IngestionFormRow>
              </div>
            {/if}
          </div>
        {/if}
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

  .ingestion-source-section > :global(.beancount-structured-form),
  .ingestion-source-section > .flex {
    margin-top: 0.75rem;
    padding-left: 2rem;
  }

  .nested-form {
    margin-left: 1rem;
    padding-left: 1rem;
    border-left: 1px solid var(--border);
  }
</style>
