<script lang="ts">
  import { untrack } from "svelte";
  import {
    StructuredForm,
    FormToolbar,
    createFormController,
    defineFormConfig,
  } from "@lapismd/design-core/forms";
  import { Button } from "@lapismd/design-core/shadcn/button";
  export type AccountProfile = {
    account: string;
    description: string;
    color: string;
    tags: string[];
    hidden: boolean;
  };
  let {
    value,
    onSave,
  }: {
    value: AccountProfile;
    onSave: (value: AccountProfile) => Promise<void>;
  } = $props();
  let draft = $state(untrack(() => ({ ...value, tags: [...value.tags] })));
  const form = createFormController({
    defaultValues: untrack(() => ({ ...value, tags: [...value.tags] })),
    validationMode: "onChange",
  });
  const config = defineFormConfig<AccountProfile>()({
    id: "account-profile",
    groups: {
      account: { title: "Account", collapsible: true },
      appearance: { title: "Appearance", collapsible: true },
    },
    fields: {
      account: {
        kind: "text",
        label: "Account",
        group: "account",
        align: "center",
        validate: (value) =>
          /^[A-Z][A-Za-z]+(?::[A-Z][A-Za-z0-9-]+)+$/.test(value)
            ? null
            : "Use a Beancount account such as Assets:Bank.",
      },
      description: {
        kind: "text",
        label: "Description",
        group: "account",
        align: "center",
      },
      tags: {
        kind: "tag-list",
        label: "Tags",
        group: "account",
        align: "center",
        as: "div",
        suggestions: ["bank", "cash", "savings"],
      },
      color: {
        kind: "color",
        label: "Colour",
        group: "appearance",
        align: "center",
        as: "div",
      },
      hidden: {
        kind: "boolean",
        label: "Hidden",
        group: "appearance",
        align: "center",
        as: "div",
      },
    },
  });
  let saving = $state(false);
  let message = $state("");
  async function save() {
    if (!(await form.validate())) return;
    saving = true;
    message = "";
    try {
      await onSave(structuredClone($state.snapshot(draft)));
      form.reset($state.snapshot(draft));
      message = "Account saved";
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      saving = false;
    }
  }
</script>

<div class="min-w-0 p-6" data-testid="account-profile-form">
  <FormToolbar
    collapsedAll={form.allDisclosuresCollapsed()}
    onToggleCollapse={() =>
      form.allDisclosuresCollapsed() ? form.expandAll() : form.collapseAll()}
  >
    {#snippet actions()}<Button
        disabled={!form.isDirty || saving}
        onclick={save}>{saving ? "Saving…" : "Save account"}</Button
      >{/snippet}
  </FormToolbar>
  {#each form.issues as issue}<p role="alert">{issue.message}</p>{/each}
  <StructuredForm
    value={draft}
    {config}
    controller={form}
    onChange={(value) => {
      draft = value;
      message = "";
    }}
  />
  <p role="status">{message}</p>
</div>
