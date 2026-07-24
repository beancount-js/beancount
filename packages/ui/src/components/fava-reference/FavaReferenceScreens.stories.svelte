<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  const { Story } = defineMeta({
    title: "Migration/Fava Reference/Screens",
    tags: ["fava-reference-visual", "skip-visual", "skip-test"],
    parameters: {
      layout: "fullscreen",
      docs: {
        description: {
          component:
            "Protected captures from the pinned original Fava application. Use these URLs from candidate component stories; refresh them only with the dedicated Fava reference command.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import {
    favaReferenceUrl,
    visualDeltaForFavaReference,
  } from "./fava-reference.js";
</script>

{#snippet reference(id: string, label: string)}
  <figure class="fava-reference">
    <img src={favaReferenceUrl(id)} alt={`${label} in original Fava`} />
    <figcaption>{label} · original Fava reference</figcaption>
  </figure>
{/snippet}

<Story
  name="Editor"
  parameters={{ visualDelta: visualDeltaForFavaReference("editor") }}
>
  {@render reference("editor", "Editor")}
</Story>
<Story
  name="Dashboard"
  parameters={{ visualDelta: visualDeltaForFavaReference("dashboard") }}
>
  {@render reference("dashboard", "Dashboard")}
</Story>
<Story
  name="Journal"
  parameters={{ visualDelta: visualDeltaForFavaReference("journal") }}
>
  {@render reference("journal", "Journal")}
</Story>
<Story
  name="Income statement"
  parameters={{ visualDelta: visualDeltaForFavaReference("income-statement") }}
>
  {@render reference("income-statement", "Income statement")}
</Story>
<Story
  name="Balance sheet"
  parameters={{ visualDelta: visualDeltaForFavaReference("balance-sheet") }}
>
  {@render reference("balance-sheet", "Balance sheet")}
</Story>
<Story
  name="Trial balance"
  parameters={{ visualDelta: visualDeltaForFavaReference("trial-balance") }}
>
  {@render reference("trial-balance", "Trial balance")}
</Story>
<Story
  name="Account detail"
  parameters={{ visualDelta: visualDeltaForFavaReference("account-detail") }}
>
  {@render reference("account-detail", "Account detail")}
</Story>
<Story
  name="Holdings"
  parameters={{ visualDelta: visualDeltaForFavaReference("holdings") }}
>
  {@render reference("holdings", "Holdings")}
</Story>
<Story
  name="Statistics"
  parameters={{ visualDelta: visualDeltaForFavaReference("statistics") }}
>
  {@render reference("statistics", "Statistics")}
</Story>
<Story
  name="Query"
  parameters={{ visualDelta: visualDeltaForFavaReference("query") }}
>
  {@render reference("query", "Query")}
</Story>
<Story
  name="Errors"
  parameters={{ visualDelta: visualDeltaForFavaReference("errors") }}
>
  {@render reference("errors", "Errors")}
</Story>
<Story
  name="Records"
  parameters={{ visualDelta: visualDeltaForFavaReference("records") }}
>
  {@render reference("records", "Records")}
</Story>
<Story
  name="Settings"
  parameters={{ visualDelta: visualDeltaForFavaReference("settings") }}
>
  {@render reference("settings", "Settings")}
</Story>
<Story
  name="Settings accounts"
  parameters={{ visualDelta: visualDeltaForFavaReference("settings-accounts") }}
>
  {@render reference("settings-accounts", "Settings accounts")}
</Story>
<Story
  name="Settings rules"
  parameters={{ visualDelta: visualDeltaForFavaReference("settings-rules") }}
>
  {@render reference("settings-rules", "Settings rules")}
</Story>

<style>
  .fava-reference {
    position: relative;
    width: 1280px;
    height: 900px;
    margin: 0;
    overflow: hidden;
    background: white;
  }

  .fava-reference img {
    display: block;
    width: 1280px;
    height: 900px;
  }

  .fava-reference figcaption {
    position: absolute;
    right: 12px;
    bottom: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgb(0 0 0 / 70%);
    color: white;
    font: 12px/1.4 sans-serif;
  }
</style>
