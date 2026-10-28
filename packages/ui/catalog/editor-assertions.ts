import { expect } from "storybook/test";

/** Keep source and BQL editors on the same loaded Design Core mono face. */
export async function expectEditorTypography(editor: HTMLElement) {
  await editor.ownerDocument.fonts.ready;
  const host = editor.closest<HTMLElement>(".cm-editor")!;
  for (const part of [
    host,
    host.querySelector<HTMLElement>(".cm-scroller")!,
    host.querySelector<HTMLElement>(".cm-line")!,
  ]) {
    const style = getComputedStyle(part);
    expect(style.fontFamily).toContain("Source Code Pro");
    expect(style.fontSize).toBe("13.6px");
  }
  expect(
    [...editor.ownerDocument.fonts].some(
      (face) =>
        face.family.includes("Source Code Pro") && face.status === "loaded",
    ),
  ).toBe(true);
}
