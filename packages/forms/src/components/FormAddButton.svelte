<script lang="ts">
  import Plus from "lucide-svelte/icons/plus";

  let {
    label,
    onclick = () => {},
  }: {
    label: string;
    onclick?: () => void;
  } = $props();
</script>

<button type="button" class="beancount-form-add-button" {onclick}>
  <Plus />
  {label}
</button>

<style>
  .beancount-form-add-button {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    width: fit-content;
    border: 0;
    background: transparent;
    color: var(
      --cv-form-muted,
      var(--beancount-form-muted, var(--muted-foreground))
    );
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0;
    margin-top: 0.15rem;
  }

  .beancount-form-add-button :global(svg) {
    width: 0.8rem;
    height: 0.8rem;
  }

  .beancount-form-add-button:hover,
  .beancount-form-add-button:focus-visible {
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    outline: 0;
  }
</style>
