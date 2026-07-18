<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import FormSectionHeader from "./FormSectionHeader.svelte";

  const { Story } = defineMeta({
    title: "Forms/Form Section Header",
    component: FormSectionHeader,
  });
</script>

{#snippet template(args)}
  <div class="form-section-header-story">
    <FormSectionHeader {...args} />
  </div>
{/snippet}

<Story
  name="Editable section"
  args={{ title: "Connection", index: 1, total: 3 }}
  {template}
/>

<Story
  name="Title-toggleable collapsed section"
  args={{
    title: "Advanced options",
    editable: false,
    titleToggleable: true,
    open: false,
    movable: false,
    removable: false,
  }}
  {template}
/>

<Story
  name="First section move boundary"
  args={{ title: "First source", index: 0, total: 3, removable: false }}
  {template}
/>

<style>
  .form-section-header-story {
    min-width: 0;
    padding-inline: 2.5rem;
  }
</style>
