<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fireEvent, waitFor, within } from "storybook/test";
  import AccountNavigationLink from "../src/components/navigation/AccountNavigationLink.svelte";
  const { Story } = defineMeta({
    title: "Beancount/Accounts",
    component: AccountNavigationLink,
  });
</script>

<Story
  name="Account avatars"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Assets:Checking:Monzo" });
    const avatar = link.querySelector<HTMLElement>(
      ".beancount-account-avatar",
    )!;
    expect(avatar.getBoundingClientRect().width).toBe(28);
    expect(avatar.getBoundingClientRect().height).toBe(28);
    expect(avatar.textContent?.trim()).toBe("M");
    await expect(link).toHaveAttribute(
      "href",
      "/account/Assets:Checking:Monzo",
    );
    const customized = canvas.getByRole("link", { name: "Savings" });
    expect(
      customized.querySelector(".beancount-account-avatar svg"),
    ).toBeVisible();
  }}
>
  {#snippet template()}<div class="flex flex-col items-start gap-4 p-4">
      <AccountNavigationLink
        account="Assets:Checking:Monzo"
        href="/account/Assets:Checking:Monzo"
        appearance={{}}
      />
      <AccountNavigationLink
        account="Assets:Savings"
        label="Savings"
        href="/account/Assets:Savings"
        appearance={{ color: "#CA8A04", icon: "landmark" }}
      />
    </div>{/snippet}
</Story>

<Story
  name="Merchant logo fallback"
  globals={{ colorMode: "dark" }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Expenses:Coffee" });
    const image = link.querySelector("img");
    if (image) await fireEvent.error(image);
    await waitFor(() => {
      expect(link.querySelector("img")).toBeNull();
      expect(
        link.querySelector(".beancount-account-avatar")?.textContent?.trim(),
      ).toBe("C");
    });
  }}
>
  {#snippet template()}<div class="p-4">
      <AccountNavigationLink
        account="Expenses:Coffee"
        href="/account/Expenses:Coffee"
        appearance={{ merchantLogoUrl: "data:image/png;base64,invalid" }}
      />
    </div>{/snippet}
</Story>
