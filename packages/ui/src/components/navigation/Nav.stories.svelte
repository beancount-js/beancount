<script module lang="ts">
  import { BookOpen, House, LayoutDashboard } from "lucide-svelte";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import Nav from "./Nav.svelte";

  const { Story } = defineMeta({
    title: "Navigation/Nav",
    component: Nav,
    parameters: {
      docs: {
        description: {
          component:
            "A reusable application navigation surface using external active-state and callbacks.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let selected = $state("");
</script>

<Story
  name="Switches selection on click"
  play={async ({ canvas }) => {
    const dashboard = canvas.getByRole("link", { name: "Dashboard 6" });
    await userEvent.click(dashboard);
    await expect(canvas.getByTestId("selected-path")).toHaveTextContent(
      "/dashboard",
    );
    const reports = canvas.getByRole("link", { name: "Reports" });
    await userEvent.click(reports);
    await expect(canvas.getByTestId("selected-path")).toHaveTextContent(
      "/reports",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-sm rounded-xl border bg-card p-3">
      <Nav
        items={[
          {
            name: "Dashboard",
            path: "/dashboard",
            badge: "6",
            icon: LayoutDashboard,
          },
          {
            name: "Reports",
            path: "/reports",
            icon: BookOpen,
          },
          {
            name: "Accounts",
            path: "/accounts",
            icon: House,
          },
        ]}
        activeHref={selected || "/dashboard"}
        onNavigate={(path) => {
          selected = path;
        }}
      />
      <output class="sr-only" aria-live="polite" data-testid="selected-path"
        >{selected}</output
      >
    </div>
  {/snippet}
</Story>

<Story name="Renders multiple items">
  {#snippet template()}
    <div class="max-w-sm rounded-xl border bg-card p-3">
      <Nav
        items={[
          {
            name: "Home",
            path: "/",
            icon: House,
          },
          {
            name: "Coming soon",
            path: "/coming-soon",
            icon: BookOpen,
          },
        ]}
        activeHref="/"
      />
    </div>
  {/snippet}
</Story>
