import { expect, waitFor } from "storybook/test";

export async function expectHeaderActionsRight(canvas: HTMLElement) {
  await waitFor(() => {
    const toolbar = canvas.querySelector<HTMLElement>(
      '[aria-label="Page toolbar"]',
    )!;
    const leading = toolbar.querySelector<HTMLElement>(
      "[data-page-toolbar-leading]",
    )!;
    const actions = toolbar.querySelector<HTMLElement>(
      "[data-page-toolbar-actions]",
    )!;
    const t = toolbar.getBoundingClientRect();
    const a = actions.getBoundingClientRect();
    const style = getComputedStyle(toolbar);
    expect(
      Math.abs(
        a.right -
          (t.right -
            parseFloat(style.paddingRight) -
            parseFloat(style.borderRightWidth)),
      ),
    ).toBeLessThanOrEqual(1);
    expect(leading.getBoundingClientRect().right).toBeLessThanOrEqual(
      a.left + 1,
    );
    expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth + 1);
  });
}
