import { describe, expect, it } from "vitest";
import {
  createProjectId,
  createProjectIdCollisionSuffix,
  isUuidProjectId,
  projectIdIndexFromProjects,
  toProjectIdBase,
} from "@beancount-js/workspace";

describe("project-id", () => {
  it("slugs folder basenames", () => {
    expect(toProjectIdBase("/Users/me/code/My App")).toBe("my-app");
    expect(toProjectIdBase("bean-budget")).toBe("bean-budget");
    expect(toProjectIdBase("api")).toBe("project");
    expect(toProjectIdBase("///")).toBe("project");
  });

  it("detects UUID-shaped ids", () => {
    expect(isUuidProjectId("c755f7de-cb13-45ec-aad2-f9ed8995f8b0")).toBe(true);
    expect(isUuidProjectId("bean-budget")).toBe(false);
  });

  it("reuses an id for the same root and suffixes collisions", () => {
    let n = 0;
    const random = () => {
      n += 1;
      return (n % 36) / 36;
    };
    const first = createProjectId(projectIdIndexFromProjects([]), "/tmp/foo");
    expect(first).toBe("foo");

    const second = createProjectId(
      projectIdIndexFromProjects([{ id: "foo", rootKey: "/tmp/foo" }]),
      "/var/foo",
      { random },
    );
    expect(second).toMatch(/^foo-[a-z0-9]{4}$/);

    const reused = createProjectId(
      projectIdIndexFromProjects([
        { id: "foo", rootKey: "/tmp/foo" },
        { id: second, rootKey: "/var/foo" },
      ]),
      "/tmp/foo",
    );
    expect(reused).toBe("foo");
  });

  it("builds collision suffixes of the requested length", () => {
    expect(createProjectIdCollisionSuffix(4, () => 0)).toHaveLength(4);
  });
});
