import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins class names and skips falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("lets later Tailwind classes override conflicting ones", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
