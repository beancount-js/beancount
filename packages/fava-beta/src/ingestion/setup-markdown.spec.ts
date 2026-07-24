import { describe, expect, it } from "vitest";
import { renderSetupMarkdown, setupHost, setupHref } from "./setup-markdown";

describe("renderSetupMarkdown", () => {
  it("renders ordered lists, links, code, and bold", () => {
    const html = renderSetupMarkdown(
      [
        "1. Go to [api.example.com](https://api.example.com) and create an API key.",
        "2. Paste your API key or an `env:` variable name below.",
        "3. Then **connect**.",
      ].join("\n"),
    );
    expect(html).toContain("<ol");
    expect(html).toContain('href="https://api.example.com"');
    expect(html).toContain("<code");
    expect(html).toContain("<strong");
    expect(html).not.toContain("<script");
  });

  it("escapes raw HTML", () => {
    const html = renderSetupMarkdown("Hello <script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("setupHost / setupHref", () => {
  it("accepts optional endpoint URLs", () => {
    expect(setupHost(undefined)).toBe("your provider");
    expect(setupHost("")).toBe("your provider");
    expect(setupHref(undefined)).toBeUndefined();
    expect(setupHref("")).toBeUndefined();
    expect(setupHost("https://lunchflow.app/api/v1")).toBe("lunchflow.app");
    expect(setupHref("https://lunchflow.app/api/v1")).toBe(
      "https://lunchflow.app",
    );
  });
});
