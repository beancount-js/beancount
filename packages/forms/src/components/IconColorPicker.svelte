<script lang="ts">
  import { Popover } from "bits-ui";
  import Banknote from "lucide-svelte/icons/banknote";
  import Briefcase from "lucide-svelte/icons/briefcase";
  import Building2 from "lucide-svelte/icons/building-2";
  import Car from "lucide-svelte/icons/car";
  import CircleDollarSign from "lucide-svelte/icons/circle-dollar-sign";
  import CircleHelp from "lucide-svelte/icons/circle-help";
  import CreditCard from "lucide-svelte/icons/credit-card";
  import Dumbbell from "lucide-svelte/icons/dumbbell";
  import Film from "lucide-svelte/icons/film";
  import Gamepad2 from "lucide-svelte/icons/gamepad-2";
  import Gift from "lucide-svelte/icons/gift";
  import GraduationCap from "lucide-svelte/icons/graduation-cap";
  import Heart from "lucide-svelte/icons/heart";
  import House from "lucide-svelte/icons/house";
  import Landmark from "lucide-svelte/icons/landmark";
  import Music from "lucide-svelte/icons/music";
  import Pencil from "lucide-svelte/icons/pencil";
  import PiggyBank from "lucide-svelte/icons/piggy-bank";
  import Plane from "lucide-svelte/icons/plane";
  import Receipt from "lucide-svelte/icons/receipt";
  import Shield from "lucide-svelte/icons/shield";
  import ShoppingCart from "lucide-svelte/icons/shopping-cart";
  import Smartphone from "lucide-svelte/icons/smartphone";
  import Store from "lucide-svelte/icons/store";
  import Utensils from "lucide-svelte/icons/utensils";
  import Wallet from "lucide-svelte/icons/wallet";

  const DEFAULT_COLOR = "#7667D9";

  const colors = [
    "#F59E0B",
    "#22C55E",
    "#6366F1",
    "#EF4444",
    "#EC4899",
    "#A855F7",
    "#F97316",
    "#06B6D4",
    "#8B5CF6",
    "#10B981",
    "#F43F5E",
    "#64748B",
  ];

  const iconOptions = [
    { value: "landmark", label: "Bank", icon: Landmark },
    { value: "wallet", label: "Wallet", icon: Wallet },
    { value: "house", label: "Home", icon: House },
    { value: "building-2", label: "Building", icon: Building2 },
    { value: "banknote", label: "Cash", icon: Banknote },
    { value: "credit-card", label: "Credit card", icon: CreditCard },
    { value: "circle-dollar-sign", label: "Money", icon: CircleDollarSign },
    { value: "piggy-bank", label: "Savings", icon: PiggyBank },
    { value: "shopping-cart", label: "Shopping", icon: ShoppingCart },
    { value: "utensils", label: "Dining", icon: Utensils },
    { value: "car", label: "Transport", icon: Car },
    { value: "plane", label: "Travel", icon: Plane },
    { value: "heart", label: "Health", icon: Heart },
    { value: "gift", label: "Gift", icon: Gift },
    { value: "gamepad-2", label: "Games", icon: Gamepad2 },
    { value: "music", label: "Music", icon: Music },
    { value: "film", label: "Entertainment", icon: Film },
    { value: "dumbbell", label: "Fitness", icon: Dumbbell },
    { value: "graduation-cap", label: "Education", icon: GraduationCap },
    { value: "briefcase", label: "Work", icon: Briefcase },
    { value: "receipt", label: "Bills", icon: Receipt },
    { value: "store", label: "Store", icon: Store },
    { value: "smartphone", label: "Phone", icon: Smartphone },
    { value: "shield", label: "Insurance", icon: Shield },
    { value: "circle-help", label: "Other", icon: CircleHelp },
  ] as const;

  let {
    color = "",
    icon = "",
    onChange = () => {},
  }: {
    color?: string;
    icon?: string;
    onChange?: (value: { color: string; icon: string }) => void;
  } = $props();

  let open = $state(false);

  const currentColor = $derived(
    isHexColor(color) ? color.toUpperCase() : DEFAULT_COLOR,
  );
  const selectedIcon = $derived(
    iconOptions.find((option) => option.value === icon) ?? iconOptions[0],
  );
  const SelectedIcon = $derived(selectedIcon.icon);

  function isHexColor(value: string) {
    return /^#[0-9A-F]{6}$/i.test(value);
  }

  function chooseColor(nextColor: string) {
    if (!isHexColor(nextColor)) return;
    onChange({ color: nextColor.toUpperCase(), icon });
  }

  function chooseIcon(nextIcon: string) {
    onChange({ color, icon: nextIcon });
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class="beancount-icon-color-picker__trigger"
        aria-label="Choose account colour and icon"
      >
        <span
          class="beancount-icon-color-picker__preview"
          style={`--appearance-color: ${currentColor}`}
          aria-hidden="true"
        >
          <SelectedIcon class="size-5" strokeWidth={1.9} />
        </span>
        <span class="beancount-icon-color-picker__trigger-label"
          >Colour and icon</span
        >
        <Pencil class="size-3.5" aria-hidden="true" />
      </button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      class="beancount-icon-color-picker__content"
      align="start"
      sideOffset={6}
      aria-label="Choose account appearance"
    >
      <div class="beancount-icon-color-picker__section">
        <p class="beancount-icon-color-picker__heading">Colour</p>
        <div class="beancount-icon-color-picker__colors">
          {#each colors as optionColor (optionColor)}
            <button
              type="button"
              class="beancount-icon-color-picker__color"
              class:selected={currentColor === optionColor}
              style={`--appearance-color: ${optionColor}`}
              aria-label={`Use ${optionColor} colour`}
              aria-pressed={currentColor === optionColor}
              onclick={() => chooseColor(optionColor)}
            ></button>
          {/each}
          <label
            class="beancount-icon-color-picker__color beancount-icon-color-picker__custom-color"
            class:selected={!colors.includes(currentColor)}
            style={`--appearance-color: ${currentColor}`}
          >
            <span class="sr-only">Choose a custom colour</span>
            <input
              type="color"
              value={currentColor}
              aria-label="Choose a custom colour"
              onchange={(event) => chooseColor(event.currentTarget.value)}
            />
          </label>
        </div>
      </div>

      <div class="beancount-icon-color-picker__section">
        <p class="beancount-icon-color-picker__heading">Icon</p>
        <div class="beancount-icon-color-picker__icons">
          {#each iconOptions as option (option.value)}
            {@const Icon = option.icon}
            <button
              type="button"
              class="beancount-icon-color-picker__icon"
              class:selected={icon === option.value}
              aria-label={`Use ${option.label} icon`}
              aria-pressed={icon === option.value}
              onclick={() => chooseIcon(option.value)}
            >
              <Icon class="size-5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          {/each}
        </div>
      </div>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<style>
  .beancount-icon-color-picker__trigger {
    display: inline-flex;
    min-height: 2.4rem;
    align-items: center;
    gap: 0.55rem;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    font: inherit;
    padding: 0.15rem 0.35rem 0.15rem 0;
    text-align: left;
  }

  .beancount-icon-color-picker__trigger:hover,
  .beancount-icon-color-picker__trigger:focus-visible {
    color: var(--primary);
    outline: 0;
  }

  .beancount-icon-color-picker__trigger:focus-visible {
    box-shadow: 0 0 0 2px var(--ring);
  }

  .beancount-icon-color-picker__preview {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: color-mix(in srgb, var(--appearance-color) 16%, transparent);
    color: var(--appearance-color);
  }

  .beancount-icon-color-picker__trigger-label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  :global(.beancount-icon-color-picker__content) {
    z-index: 60;
    width: min(22rem, calc(100vw - 2rem));
    border: 1px solid var(--border);
    border-radius: 0.875rem;
    background: var(--popover, var(--card));
    box-shadow: 0 12px 32px color-mix(in srgb, #080319 18%, transparent);
    color: var(--popover-foreground, var(--foreground));
    padding: 1rem;
  }

  .beancount-icon-color-picker__section
    + .beancount-icon-color-picker__section {
    margin-top: 1rem;
  }

  .beancount-icon-color-picker__heading {
    margin: 0 0 0.6rem;
    color: var(--muted-foreground);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .beancount-icon-color-picker__colors {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .beancount-icon-color-picker__color {
    position: relative;
    display: block;
    width: 1.65rem;
    height: 1.65rem;
    justify-self: center;
    border: 0;
    border-radius: 999px;
    background: var(--appearance-color);
    cursor: pointer;
    padding: 0;
  }

  .beancount-icon-color-picker__color::after,
  .beancount-icon-color-picker__icon::after {
    position: absolute;
    inset: -0.2rem;
    border: 2px solid transparent;
    border-radius: inherit;
    content: "";
    pointer-events: none;
  }

  .beancount-icon-color-picker__color:hover::after,
  .beancount-icon-color-picker__color:focus-visible::after,
  .beancount-icon-color-picker__custom-color:focus-within::after,
  .beancount-icon-color-picker__color.selected::after {
    border-color: var(--ring);
  }

  .beancount-icon-color-picker__color:focus-visible,
  .beancount-icon-color-picker__icon:focus-visible {
    outline: 0;
  }

  .beancount-icon-color-picker__custom-color {
    overflow: hidden;
  }

  .beancount-icon-color-picker__custom-color input {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: transparent;
    cursor: pointer;
    opacity: 0;
  }

  .beancount-icon-color-picker__icons {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.35rem;
  }

  .beancount-icon-color-picker__icon {
    position: relative;
    display: inline-flex;
    width: 2.3rem;
    height: 2.3rem;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 0;
  }

  .beancount-icon-color-picker__icon:hover,
  .beancount-icon-color-picker__icon.selected {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    color: var(--primary);
  }

  .beancount-icon-color-picker__icon:focus-visible::after,
  .beancount-icon-color-picker__icon.selected::after {
    border-color: var(--ring);
  }
</style>
