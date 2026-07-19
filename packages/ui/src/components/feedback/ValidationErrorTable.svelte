<script lang="ts">
  import * as Table from "../shadcn/table";

  export type ValidationErrorRow = {
    id: string;
    line?: string | number;
    message: string;
    entity?: string;
    href?: string;
  };

  let {
    errors,
    ariaLabel = "Validation errors",
    emptyTitle = "No validation errors",
    emptyDescription = "This ledger has no errors to review.",
    onNavigate,
  }: {
    errors: readonly ValidationErrorRow[];
    ariaLabel?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    onNavigate?: (error: ValidationErrorRow) => void;
  } = $props();

  function navigate(error: ValidationErrorRow, event: MouseEvent) {
    if (onNavigate) event.preventDefault();
    onNavigate?.(error);
  }
</script>

{#if errors.length}
  <div
    class="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm"
  >
    <Table.Root aria-label={ariaLabel} class="min-w-[42rem]">
      <Table.Header>
        <Table.Row class="bg-muted/65 hover:bg-muted/65">
          <Table.Head
            class="w-20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
          >
            Line
          </Table.Head>
          <Table.Head
            class="min-w-72 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
          >
            Message
          </Table.Head>
          <Table.Head
            class="min-w-80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
          >
            Source context
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each errors as error (error.id)}
          <Table.Row>
            <Table.Cell class="px-4 py-3 font-mono text-xs tabular-nums">
              {#if error.href}
                <a
                  href={error.href}
                  class="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onclick={(event) => navigate(error, event)}
                  >{error.line ?? "—"}</a
                >
              {:else}
                {error.line ?? "—"}
              {/if}
            </Table.Cell>
            <Table.Cell class="px-4 py-3 align-top text-sm text-destructive">
              {error.message}
            </Table.Cell>
            <Table.Cell class="px-4 py-3 align-top">
              {#if error.entity}
                <code
                  class="block whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground"
                  >{error.entity}</code
                >
              {:else}
                <span class="text-sm text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{:else}
  <section
    class="rounded-xl border border-dashed border-border/80 bg-card px-5 py-8 text-center shadow-sm"
    aria-label={ariaLabel}
  >
    <h3 class="text-sm font-semibold">{emptyTitle}</h3>
    <p class="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
  </section>
{/if}
