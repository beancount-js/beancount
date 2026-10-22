<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { DateTime } from "luxon";
  import { BeancountApplication } from "@beancount-js/ui";
  import { createBeancountController } from "@beancount-js/ui/controller";
  import { createInMemorySource } from "./controller/in-memory-source";
  import { demoLedger, demoProject, NOW } from "./fixtures/project";

  const contents = demoLedger
    .replace(
      "open Assets:Checking GBP",
      'open Assets:Checking GBP\n  color: "#0284C7"\n  icon: "landmark"',
    )
    .replace(
      "open Expenses:Food GBP",
      'open Expenses:Food GBP\n  merchant_id: "cafe"',
    );
  const logoUrl =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0284C7"/></svg>',
    );
  const source = createInMemorySource([
    demoProject("inline-avatars", contents),
  ]);
  const controller = untrack(() =>
    createBeancountController({
      initialRoute: "/editor",
      clock: () => DateTime.fromISO(NOW),
      source: {
        ...source,
        request: (url, init) =>
          new URL(url, "http://fixture.invalid").pathname.endsWith("/merchants")
            ? Promise.resolve(Response.json([{ merchantId: "cafe", logoUrl }]))
            : source.request!(url, init),
      },
    }),
  );
  onDestroy(() => controller.dispose());
</script>

<BeancountApplication {controller} displayMode="desktop" />
