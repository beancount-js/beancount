<script lang="ts">
  import { derived } from "svelte/store";
  import { BeancountFilter, ValidationError } from "@beancount-js/beancount";
  import { DateTime } from "luxon";
  import { useContext } from "../../context";
  import { Custom, isDirective } from "@beancount-js/beancount";
  import ValidationErrorTable, {
    type ValidationErrorRow,
  } from "@beancount-js/ui/feedback/ValidationErrorTable.svelte";

  const { ledgerData, predicate } = useContext();
  const filterVisitor = new BeancountFilter();

  function matchesPredicate(
    predicate: NonNullable<(typeof $predicate)["predicate"]>,
    entity: Parameters<BeancountFilter["accept"]>[1],
  ) {
    return predicate.accept(filterVisitor, entity, { op: ":" });
  }

  function getEntity(error: unknown) {
    if (error instanceof ValidationError) {
      return error.context.directive?.toString() ?? "-";
    }
    const record = error as {
      position?: { toString: () => string };
      context?: { toString?: () => string };
    };
    return (
      record.position?.toString() ??
      record.context?.toString?.() ??
      "-"
    );
  }

  function getLine(error: unknown) {
    if (typeof error === "string") return "-";
    const errorRecord = error as {
      line?: number | string;
      source?: { lineno?: number | string };
      context?: {
        directive?: { toString: () => string; meta?: { lineno?: number | string } };
        lineno?: number | string;
      };
    };
    return (
      errorRecord.line ??
      errorRecord.source?.lineno ??
      errorRecord.context?.directive?.meta?.lineno ??
      errorRecord.context?.lineno ??
      "-"
    );
  }

  const rows = derived([ledgerData, predicate], ([$ledgerData, $predicate]) => {
    const epoch = DateTime.fromMillis(0, { zone: "utc" });
    const currentPredicate = $predicate.predicate;
    const filtered = $ledgerData.errors.filter((error) => {
      if (error instanceof ValidationError) {
        const directive = error.context.directive;
        if (isDirective(directive)) {
          return currentPredicate
            ? matchesPredicate(currentPredicate, directive)
            : true;
        }
      }
      if (typeof error === "string") {
        return currentPredicate
          ? matchesPredicate(currentPredicate, new Custom(epoch, "error", [error]))
          : true;
      }
      const message = (error as { message?: string })?.message ?? "Validation error";
      return currentPredicate
        ? matchesPredicate(
            currentPredicate,
            new Custom(epoch, "error", [message], { ...(error as object) }),
          )
        : true;
    });

    return filtered.map((error, index): ValidationErrorRow => {
      const line = getLine(error);
      const message =
        typeof error === "string"
          ? error
          : (error as { message?: string }).message ??
            "Unknown validation error";
      return {
        id: `${line}-${index}`,
        line,
        message,
        entity: getEntity(error),
        href: line === "-" ? undefined : `/editor?line=${String(line)}`,
      };
    });
  });
</script>

<ValidationErrorTable errors={$rows} />
