// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { followingTooltip, positionedTooltip } from "./tooltip";

const svgNamespace = "http://www.w3.org/2000/svg";

afterEach(() => {
  document.body.replaceChildren();
});

describe("chart tooltip actions", () => {
  it("does not create a tooltip merely by mounting and destroying", () => {
    const node = document.createElementNS(svgNamespace, "rect");
    const action = followingTooltip(node, () => [document.createTextNode("A")]);

    action?.destroy?.();

    expect(document.querySelector("[data-chart-tooltip]")).toBeNull();
  });

  it("removes a shared tooltip after the final chart action is destroyed", () => {
    const first = document.createElementNS(svgNamespace, "rect");
    const second = document.createElementNS(svgNamespace, "rect");
    const firstAction = followingTooltip(first, () => [
      document.createTextNode("First"),
    ]);
    const secondAction = followingTooltip(second, () => [
      document.createTextNode("Second"),
    ]);

    first.dispatchEvent(new MouseEvent("mouseenter"));
    const tooltip = document.querySelector<HTMLElement>("[data-chart-tooltip]");
    expect(tooltip?.textContent).toBe("First");
    expect(tooltip?.style.position).toBe("fixed");

    firstAction?.destroy?.();
    expect(document.querySelector("[data-chart-tooltip]")).toBe(tooltip);

    secondAction?.destroy?.();
    expect(document.querySelector("[data-chart-tooltip]")).toBeNull();
  });

  it("removes positioned tooltip listeners and portal on teardown", () => {
    const node = document.createElementNS(svgNamespace, "g");
    Object.defineProperty(node, "getScreenCTM", {
      value: () => ({ e: 0, f: 0 }),
    });
    const action = positionedTooltip(node, () => [
      10,
      20,
      [document.createTextNode("Point")],
    ]);

    node.dispatchEvent(new MouseEvent("mousemove"));
    expect(document.querySelector("[data-chart-tooltip]")).not.toBeNull();

    action?.destroy?.();
    expect(document.querySelector("[data-chart-tooltip]")).toBeNull();
  });
});
