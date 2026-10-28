import { expect, waitFor } from "storybook/test";

export function expectColumnsAligned(
  headers: Element[],
  cells: Element[],
  tolerance = 1,
) {
  expect(headers.length).toBeGreaterThan(1);
  expect(cells).toHaveLength(headers.length);
  headers.forEach((header, index) => {
    const h = header.getBoundingClientRect();
    const c = cells[index]!.getBoundingClientRect();
    expect(Math.abs(h.left - c.left)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(h.right - c.right)).toBeLessThanOrEqual(tolerance);
  });
}

/** Assertions adapted from the immutable Fava e2e suite, without its seed helpers. */
export async function expectStatementGeometry(canvas: HTMLElement) {
  await canvas.ownerDocument.fonts.ready;
  await waitFor(() => {
    const tables = canvas.querySelectorAll<HTMLElement>(
      "[data-statement-summary-tree-table], [data-dashboard-tree-rows]",
    );
    expect(tables.length).toBeGreaterThan(0);
    tables.forEach((table) => {
      const header = table.firstElementChild!;
      const rows = table.querySelectorAll<HTMLElement>(
        "[data-statement-summary-tree-row], [data-dashboard-tree-row]",
      );
      rows.forEach((row) => {
        expectColumnsAligned([...header.children], [...row.children]);
        expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
        expect(getComputedStyle(row).borderTopWidth).toBe("1px");
      });
    });
  });
}

export async function expectGridGeometry(
  table: HTMLElement,
  rowHeight: number,
) {
  await table.ownerDocument.fonts.ready;
  await waitFor(() => {
    const headers = [...table.querySelectorAll(".head p > span")];
    const rows = table.querySelectorAll<HTMLElement>(
      ".virtual-list-inner [data-grid-row]",
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      const cells = [...row.firstElementChild!.children];
      expectColumnsAligned(headers, cells);
      expect(getComputedStyle(row).borderBottomWidth).toBe("1px");
      // A multiline record remains an integral number of base rows.
      expect(
        Math.abs(
          row.getBoundingClientRect().height / rowHeight -
            Math.round(row.getBoundingClientRect().height / rowHeight),
        ),
      ).toBeLessThan(0.01);
      for (const cell of cells)
        expect(getComputedStyle(cell).borderRightWidth).toBe("1px");
    });
  });
}
