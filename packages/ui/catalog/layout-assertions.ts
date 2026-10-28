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
    const root = document.getElementById("storybook-root");
    const rootStyle = root && getComputedStyle(root);
    expect(
      document.documentElement.scrollHeight,
      JSON.stringify({
        viewport: frame.innerHeight,
        canvas: { id: canvas.id, parent: canvas.parentElement?.id },
        root: root && {
          height: root.getBoundingClientRect().height,
          padding: rootStyle?.padding,
          minHeight: rootStyle?.minHeight,
          boxSizing: rootStyle?.boxSizing,
        },
        body: {
          height: document.body.getBoundingClientRect().height,
          padding: getComputedStyle(document.body).padding,
          margin: getComputedStyle(document.body).margin,
        },
        html: {
          padding: getComputedStyle(document.documentElement).padding,
          margin: getComputedStyle(document.documentElement).margin,
          scroll: document.documentElement.scrollHeight,
        },
        children: [...document.body.children]
          .filter((element) => element.getBoundingClientRect().height > 0)
          .map((element) => ({
            tag: element.tagName,
            id: element.id,
            class: element.className,
            rect: element.getBoundingClientRect().toJSON(),
          })),
        shell: shell.getBoundingClientRect().height,
      }),
    ).toBeLessThanOrEqual(frame.innerHeight + 1);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      frame.innerWidth + 1,
    );
    expect(shell.scrollHeight).toBeLessThanOrEqual(shell.clientHeight + 1);
    expect(shell.scrollTop).toBe(0);
    expect(header.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
  });
}
