import { expect, waitFor } from "storybook/test";

/** Check the painted state as well as the accessible/controlled state. */
export async function expectVisibleToggleSelection(
  group: HTMLElement,
  values: string[],
) {
  await waitFor(() => {
    const items = [
      ...group.querySelectorAll<HTMLElement>(
        '[data-ui-part="toggle-group-item"]',
      ),
    ];
    expect(items.length).toBeGreaterThan(1);
    if (group.dataset.beancountToggle === "segmented") {
      for (const item of items) {
        const style = getComputedStyle(item);
        for (const radius of [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomLeftRadius,
          style.borderBottomRightRadius,
        ])
          expect(parseFloat(radius)).toBeGreaterThan(0);
      }
    }
    const selected = items.filter(
      (item) => item.getAttribute("data-state") === "on",
    );
    expect(
      selected.map((item) => item.getAttribute("data-value")).sort(),
    ).toEqual([...values].sort());
    for (const item of selected) {
      expect(item).toHaveAttribute(
        item.getAttribute("role") === "radio" ? "aria-checked" : "aria-pressed",
        "true",
      );
      const fill = getComputedStyle(item).backgroundColor;
      expect(fill).not.toBe("rgba(0, 0, 0, 0)");
      // An on-item must not disappear into its muted track.
      expect(fill).not.toBe(getComputedStyle(group).backgroundColor);
      for (const inactive of items.filter((other) => !selected.includes(other)))
        expect(fill).not.toBe(getComputedStyle(inactive).backgroundColor);
    }
  });
}
