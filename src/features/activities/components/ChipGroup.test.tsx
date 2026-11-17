import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CATEGORY_STYLE } from "../categoryColors";
import { SubcategoryChips } from "./CategoryChips";
import { ChipGroup } from "./ChipGroup";

const OPTIONS = ["MANGER", "TRAVAIL"] as const;
const render2 = (props: Partial<Parameters<typeof ChipGroup<"MANGER" | "TRAVAIL">>[0]> = {}) =>
  render(
    <ChipGroup label="Cat" options={OPTIONS} value="TRAVAIL" onChange={() => {}} {...props} />,
  );

describe("ChipGroup styleFor", () => {
  it("applies chip + hover at rest, without the neutral base classes", () => {
    render2({ styleFor: (o) => CATEGORY_STYLE[o] });
    const rest = screen.getByRole("button", { name: "MANGER" });
    expect(rest).toHaveClass("bg-category-manger-bg", "hover:border-category-manger-fg");
    expect(rest).not.toHaveClass("hover:bg-accent");
    expect(rest).not.toHaveClass("bg-background");
    expect(rest).not.toHaveClass("border-input");
    expect(rest).not.toHaveClass("bg-category-manger-fg");
  });

  it("applies the selected classes when chosen", () => {
    render2({ styleFor: (o) => CATEGORY_STYLE[o] });
    const chosen = screen.getByRole("button", { name: "TRAVAIL" });
    expect(chosen).toHaveAttribute("aria-pressed", "true");
    expect(chosen).toHaveClass("bg-category-travail-fg", "text-category-travail-bg");
    expect(chosen).not.toHaveClass("bg-primary");
  });

  it("lets border-destructive win on an invalid unselected styled chip", () => {
    render2({ invalid: true, styleFor: (o) => CATEGORY_STYLE[o] });
    const rest = screen.getByRole("button", { name: "MANGER" });
    expect(rest).toHaveClass("border-destructive");
    expect(rest).not.toHaveClass("border-category-manger-border");
    expect(rest).not.toHaveClass("hover:border-category-manger-fg");
    expect(screen.getByRole("button", { name: "TRAVAIL" })).not.toHaveClass("border-destructive");
  });

  it("keeps the original neutral classes without styleFor", () => {
    render2();
    expect(screen.getByRole("button", { name: "MANGER" })).toHaveClass(
      "border-input",
      "bg-background",
      "hover:bg-accent",
    );
    expect(screen.getByRole("button", { name: "TRAVAIL" })).toHaveClass("bg-primary");
  });
});

describe("SubcategoryChips unknown category", () => {
  it.each(["__proto__", "toString", "NOPE"])("%s renders neutral and does not crash", (bad) => {
    render(<SubcategoryChips category={bad as never} value="" onChange={() => {}} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("known category tints its subcategories", () => {
    render(<SubcategoryChips category="MANGER" value="" onChange={() => {}} />);
    expect(screen.getAllByRole("button")[0]).toHaveClass("bg-category-manger-bg");
  });
});
