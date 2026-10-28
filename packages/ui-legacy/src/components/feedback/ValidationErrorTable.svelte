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
  <div class="cn-feedback-validationerrortable-34-1">
    <Table.Root
      aria-label={ariaLabel}
      class="cn-feedback-validationerrortable-36-1"
    >
      <Table.Header>
        <Table.Row class="cn-feedback-validationerrortable-38-1">
          <Table.Head class="cn-feedback-validationerrortable-40-1">
            Line
          </Table.Head>
          <Table.Head class="cn-feedback-validationerrortable-45-1">
            Message
          </Table.Head>
          <Table.Head class="cn-feedback-validationerrortable-50-1">
            Source context
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each errors as error (error.id)}
          <Table.Row>
            <Table.Cell class="cn-feedback-validationerrortable-59-1">
              {#if error.href}
                <a
                  href={error.href}
                  class="cn-feedback-validationerrortable-63-1"
                  onclick={(event) => navigate(error, event)}
                  >{error.line ?? "—"}</a
                >
              {:else}
                {error.line ?? "—"}
              {/if}
            </Table.Cell>
            <Table.Cell class="cn-feedback-validationerrortable-71-1">
              {error.message}
            </Table.Cell>
            <Table.Cell class="cn-feedback-validationerrortable-74-1">
              {#if error.entity}
                <code class="cn-feedback-validationerrortable-77-1"
                  >{error.entity}</code
                >
              {:else}
                <span class="cn-feedback-validationerrortable-81-1">—</span>
              {/if}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{:else}
  <section class="cn-feedback-validationerrortable-91-1" aria-label={ariaLabel}>
    <h3 class="cn-feedback-validationerrortable-94-1">{emptyTitle}</h3>
    <p class="cn-feedback-validationerrortable-95-1">{emptyDescription}</p>
  </section>
{/if}
