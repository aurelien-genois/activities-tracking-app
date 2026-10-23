import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Pagination } from "./Pagination";

const filters = { q: "été", category: "MANGER" as const, subcategory: "Dîner" };

describe("Pagination", () => {
  it("links to the previous and next pages, preserving filters", () => {
    render(<Pagination page={2} pageCount={3} filters={filters} />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent("Page 2 of 3");
    const previous = screen.getByRole("link", { name: "Previous" });
    const next = screen.getByRole("link", { name: "Next" });
    expect(previous).toHaveAttribute(
      "href",
      "/history?q=%C3%A9t%C3%A9&category=MANGER&subcategory=D%C3%AEner",
    );
    expect(next).toHaveAttribute(
      "href",
      "/history?q=%C3%A9t%C3%A9&category=MANGER&subcategory=D%C3%AEner&page=3",
    );
  });

  it("disables Previous on the first page and Next on the last page", () => {
    const { rerender } = render(<Pagination page={1} pageCount={2} filters={{}} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/history?page=2");

    rerender(<Pagination page={2} pageCount={2} filters={{}} />);
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    rerender(<Pagination page={1} pageCount={1} filters={{}} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });
});
