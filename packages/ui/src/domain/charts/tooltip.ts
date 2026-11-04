import { pointer } from "d3-selection";
import type { Action } from "svelte/action";

/** The shared tooltip div, lazily created while a chart action owns it. */
let tooltipElement: HTMLDivElement | null = null;
let tooltipOwners = 0;

const tooltip = (): HTMLDivElement => {
  if (tooltipElement === null) {
    tooltipElement = document.createElement("div");
    tooltipElement.className = "tooltip font-mono";
    tooltipElement.dataset.chartTooltip = "";
    tooltipElement.style.position = "fixed";
    tooltipElement.style.pointerEvents = "none";
    document.body.appendChild(tooltipElement);
  }
  return tooltipElement;
};

const retainTooltip = (): (() => void) => {
  tooltipOwners += 1;
  return () => {
    tooltipOwners -= 1;
    if (tooltipOwners === 0) {
      tooltipElement?.remove();
      tooltipElement = null;
    }
  };
};

/** Hide the tooltip. */
const hide = (): void => {
  if (tooltipElement) {
    tooltipElement.style.opacity = "0";
    tooltipElement.style.visibility = "hidden";
  }
};

/** Some small utilities to create tooltip contents. */
export const domHelpers = {
  /** Create a <br> element. */
  br: (): HTMLBRElement => document.createElement("br"),
  /** Create a <em> element with the given content. */
  em: (content: string): HTMLElement => {
    const em = document.createElement("span");
    em.className = "opacity-50";
    em.textContent = content;
    return em;
  },
  /** Create a text node for the given text. */
  t: (text: string): Text => document.createTextNode(text),
  /** Create a <pre> element with the given content. */
  pre: (content: string): HTMLPreElement => {
    const pre = document.createElement("pre");
    pre.textContent = content;
    return pre;
  },
};

export type TooltipContent = (HTMLElement | Text)[];

/**
 * Svelte action to have the given element act on mouse to show a tooltip.
 *
 * The tooltip will be positioned at the cursor and is given a tooltip getter
 * per <g> element.
 */
export const followingTooltip: Action<SVGElement, () => TooltipContent> = (
  node,
  text,
) => {
  let getter = text as () => TooltipContent;
  const releaseTooltip = retainTooltip();
  /** Event listener to have the tooltip follow the mouse. */
  function followMouse(event: MouseEvent) {
    const t = tooltip();
    t.style.opacity = "1";
    t.style.visibility = "visible";
    t.style.left = `${event.clientX.toString()}px`;
    t.style.top = `${(event.clientY - t.offsetHeight).toString()}px`;
  }
  const showTooltip = () => {
    const t = tooltip();
    t.replaceChildren(...getter());
  };
  node.addEventListener("mouseenter", showTooltip);
  node.addEventListener("mousemove", followMouse);
  node.addEventListener("mouseleave", hide);

  return {
    destroy() {
      node.removeEventListener("mouseenter", showTooltip);
      node.removeEventListener("mousemove", followMouse);
      node.removeEventListener("mouseleave", hide);
      hide();
      releaseTooltip();
    },
    update(t) {
      getter = t;
    },
  };
};

/** A function to find the closest node and the content to show in the tooltip. */
export type TooltipFindNode = (
  x: number,
  y: number,
) => [number, number, TooltipContent] | undefined;

/**
 * Svelte action to have the given <g> element act on mouse to show a tooltip.
 *
 * The parameter to the tooltip is a function that takes a position (relative to
 * the container) as input and should return the position of the tooltip, i.e.,
 * the found node, again relative to the container and the desired content of
 * the tooltip.
 */
export const positionedTooltip: Action<SVGGElement, TooltipFindNode> = (
  node,
  find,
) => {
  const releaseTooltip = retainTooltip();
  function mousemove(event: MouseEvent) {
    const [xPointer, yPointer] = pointer(event);
    const res = find(xPointer, yPointer);
    const matrix = node.getScreenCTM();
    if (res && matrix) {
      const [x, y, content] = res;
      const t = tooltip();
      t.style.opacity = "1";
      t.style.visibility = "visible";
      t.replaceChildren(...content);
      t.style.left = `${(x + matrix.e).toString()}px`;
      t.style.top = `${(y + matrix.f - 15).toString()}px`;
    } else {
      hide();
    }
  }
  node.addEventListener("mousemove", mousemove);
  node.addEventListener("mouseleave", hide);

  return {
    destroy() {
      node.removeEventListener("mousemove", mousemove);
      node.removeEventListener("mouseleave", hide);
      hide();
      releaseTooltip();
    },
  };
};
