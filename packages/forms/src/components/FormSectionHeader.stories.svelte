<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import FormSectionHeader from "./FormSectionHeader.svelte";

  const { Story } = defineMeta({
    title: "Forms/Form Section Header",
    component: FormSectionHeader,
  });
</script>

<Story
  name="Editable section"
  args={{ title: "Connection", index: 1, total: 3 }}
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
/>

<Story
  name="First section move boundary"
  args={{ title: "First source", index: 0, total: 3, removable: false }}
/>
