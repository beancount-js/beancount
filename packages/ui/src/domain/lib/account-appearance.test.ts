import { expect, it, vi } from "vitest";
import { merchantLogosForController } from "./account-appearance";
import type { BeancountController } from "../../controller";

it("isolates merchant logos between controllers with the same project id", async () => {
  function controller(logoUrl: string) {
    return {
      actions: {
        request: vi.fn(
          async () =>
            new Response(JSON.stringify([{ merchantId: "cafe", logoUrl }])),
        ),
      },
    } as unknown as BeancountController;
  }
  const first = controller("/first.svg");
  const second = controller("/second.svg");
  const firstLogos = await merchantLogosForController(first, "same-project");
  expect(firstLogos.get("cafe")).toBe("/first.svg");
  expect(
    (await merchantLogosForController(second, "same-project")).get("cafe"),
  ).toBe("/second.svg");
  expect(await merchantLogosForController(first, "same-project")).toBe(
    firstLogos,
  );
  expect(first.actions.request).toHaveBeenCalledTimes(1);
});

it("keeps account initials available when merchant metadata is unavailable", async () => {
  const controller = {
    actions: {
      request: vi.fn(async () => new Response("Unavailable", { status: 503 })),
    },
  } as unknown as BeancountController;
  expect(await merchantLogosForController(controller, "project")).toEqual(
    new Map(),
  );
});
