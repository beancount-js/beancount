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
  import { IngestionSourceForm } from "@beancount-js/ui/forms";
  import type { FormValidationIssue } from "@beancount-js/ui/forms";
  import type { MerchantPickerMerchant } from "@beancount-js/ui/forms";
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
  } from "../ingestion/source-form-config";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { useNavigation } from "../router/router";

  type Props = {
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
  };

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
  }: Props = $props();

  const { router } = useNavigation();

  let merchants = $state<readonly MerchantPickerMerchant[]>([]);
  let previousProjectId = $state("");

  async function fetchMerchants(nextProjectId: string) {
    try {
      const listed = await ingestionJson<readonly MerchantPickerMerchant[]>(
        ingestionPath(nextProjectId, "/merchants"),
      );
      if (nextProjectId !== projectId) return;
      merchants = Array.isArray(listed)
        ? listed.slice().sort((left, right) =>
            left.canonicalName.localeCompare(right.canonicalName),
          )
        : [];
    } catch {
      if (nextProjectId !== projectId) return;
      merchants = [];
    }
  }

  $effect(() => {
    if (!projectId) {
      merchants = [];
      previousProjectId = "";
      return;
    }
    if (projectId === previousProjectId) return;
    previousProjectId = projectId;
    void fetchMerchants(projectId);
  });

  const connector = $derived(
    isConnectorSource(source) ? clientConnector(source.kind) : undefined,
  );
  const isConnector = $derived(Boolean(connector));
  const isGrouped = $derived(isGroupedSource(source));
  const detailsForm = $derived(
    isGrouped ? sourceDetailsGroupedForm : sourceDetailsForm,
  );
  const apiForm = $derived(isGrouped ? sourceApiGroupedForm : sourceApiForm);
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
      ? connectorFieldsForm(connector.advancedFields, `${connector.kind}-advanced`)
      : undefined,
  );
  const providerCategories = $derived(connector?.providerCategories ?? []);

  function openBrandSettings() {
    router.push("/import/brands");
  }
</script>

<IngestionSourceForm
  {source}
  {detailsForm}
  {apiForm}
  {sourcePaginationForm}
  {sourceMappingForm}
  {sourceEnrichmentForm}
  {sourceEnrichmentDetailsForm}
  {connectionFieldsForm}
  {advancedFieldsForm}
  providerCategories={providerCategories}
  isConnector={isConnector}
  isGrouped={isGrouped}
  {accounts}
  {categoryAccounts}
  {issues}
  {credentialAvailable}
  {merchantCredentialAvailable}
  {envKeys}
  {projectId}
  {merchants}
  {openSections}
  {onOpenSectionsChange}
  {onChange}
  {onDuplicate}
  {onRemove}
  onOpenBrandSettings={openBrandSettings}
/>
