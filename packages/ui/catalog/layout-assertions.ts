import { expect, waitFor } from "storybook/test";

/** The document and shell stay fixed; only their bounded content may scroll. */
export async function expectContainedShell(canvas: HTMLElement) {
  await canvas.ownerDocument.fonts.ready;
  await waitFor(() => {
    const document = canvas.ownerDocument;
    const frame = document.defaultView!;
    const shell = canvas.querySelector<HTMLElement>(".beancount-shell")!;
    const header = shell.querySelector<HTMLElement>(
      ".beancount-shell__header",
    )!;
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(
      frame.innerHeight + 1,
    );
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      frame.innerWidth + 1,
    );
    expect(shell.scrollHeight).toBeLessThanOrEqual(shell.clientHeight + 1);
    expect(shell.scrollTop).toBe(0);
    expect(header.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
  });
}
