import { describe, expect, test } from "vitest";
import {
  checkboxSelectionState,
  pruneReviewSelection,
  updateReviewSelection,
} from "./review-selection";

describe("review selection", () => {
  test("reports checked and indeterminate checkbox states", () => {
    expect(checkboxSelectionState(new Set(), ["a", "b"])).toEqual({
      checked: false,
      indeterminate: false,
      selectedCount: 0,
    });
    expect(checkboxSelectionState(new Set(["a"]), ["a", "b"])).toEqual({
      checked: false,
      indeterminate: true,
      selectedCount: 1,
    });
    expect(checkboxSelectionState(new Set(["a", "b"]), ["a", "b"])).toEqual({
      checked: true,
      indeterminate: false,
      selectedCount: 2,
    });
    expect(checkboxSelectionState(new Set(), [])).toEqual({
      checked: false,
      indeterminate: false,
      selectedCount: 0,
    });
  });

  test("updates a group without mutating the current selection", () => {
    const current = new Set(["existing", "remove"]);
    const selected = updateReviewSelection(current, ["a", "b"], true);
    const cleared = updateReviewSelection(
      current,
      ["remove", "missing"],
      false,
    );

    expect([...current]).toEqual(["existing", "remove"]);
    expect([...selected]).toEqual(["existing", "remove", "a", "b"]);
    expect([...cleared]).toEqual(["existing"]);
  });

  test("prunes rows that are no longer actionable", () => {
    expect([
      ...pruneReviewSelection(new Set(["a", "b", "c"]), new Set(["a", "c"])),
    ]).toEqual(["a", "c"]);
  });
});
