<script lang="ts">
  import AccountAvatar from "../src/components/forms/AccountAvatar.svelte";
  import IconColorPicker from "../src/components/forms/IconColorPicker.svelte";

  let appearance = $state({ color: "#CA8A04", icon: "landmark" });
</script>

<div class="flex items-center gap-4 p-4">
  <IconColorPicker
    color={appearance.color}
    icon={appearance.icon}
    onChange={(next) => (appearance = next)}
  />
  <AccountAvatar
    account="Assets:Savings"
    color={appearance.color}
    icon={appearance.icon}
  />
  <output data-testid="account-avatar-color">{appearance.color}</output>
  <output class="sr-only" data-testid="account-avatar-value"
    >{appearance.icon}</output
  >
</div>
