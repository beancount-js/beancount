import { writable } from "svelte/store";

export interface TableTypography {
  font: string;
  letterSpacing: number;
}
export const defaultTableTypography: TableTypography = {
  font: "12px monospace",
  letterSpacing: 0,
};

/** Measure the rendered table, including delayed fonts and inherited theme changes. */
export function createTableTypography() {
  const style = writable(defaultTableTypography);
  function measure(node: HTMLElement) {
    const document = node.ownerDocument;
    const view = document.defaultView!;
    let alive = true;
    let frame = 0;
    function update() {
      frame = 0;
      if (!alive) return;
      const computed = view.getComputedStyle(node);
      const font = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
      style.set({
        font,
        letterSpacing: parseFloat(computed.letterSpacing) || 0,
      });
      node.dataset.tableFont = font;
    }
    function schedule() {
      if (!frame) frame = view.requestAnimationFrame(update);
    }
    update();
    void document.fonts.ready.then(schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(node);
    const theme = new MutationObserver(schedule);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-ui-theme"],
    });
    theme.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "data-ui-theme"],
    });
    view.addEventListener("resize", schedule);
    return {
      destroy() {
        alive = false;
        view.cancelAnimationFrame(frame);
        resize.disconnect();
        theme.disconnect();
        document.fonts.removeEventListener("loadingdone", schedule);
        view.removeEventListener("resize", schedule);
      },
    };
  }
  return { style, measure };
}

export function textWidth(
  context: CanvasRenderingContext2D | null,
  text: string,
  typography: TableTypography,
) {
  if (context) context.font = typography.font;
  return Math.max(
    0,
    ...text
      .split("\n")
      .map(
        (line) =>
          (context?.measureText(line).width ?? line.length * 8) +
          Math.max(0, line.length - 1) * typography.letterSpacing,
      ),
  );
}
