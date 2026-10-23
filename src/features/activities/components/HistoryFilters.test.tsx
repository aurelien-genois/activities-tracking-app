import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { HistoryFilters, type HistoryFiltersProps } from "./HistoryFilters";

function renderFilters(filters: HistoryFiltersProps["filters"] = {}) {
  const user = userEvent.setup();
  render(<HistoryFilters filters={filters} />);
  return { user };
}

const group = (name: string) => screen.getByRole("group", { name });
const chip = (groupName: string, name: string) =>
  within(group(groupName)).getByRole("button", { name });

describe("HistoryFilters", () => {
  beforeEach(() => push.mockReset());

  it("renders the search form and category chips without filters", () => {
    renderFilters();
    expect(screen.getByRole("search", { name: "Filter activities" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search notes")).toHaveValue("");
    expect(within(group("Category")).getAllByRole("button")).toHaveLength(7);
    expect(chip("Category", "All")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("group", { name: "Subcategory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("submits the trimmed notes search, keeping the filters and resetting the page", async () => {
    const { user } = renderFilters({ category: "MANGER", subcategory: "Dîner" });
    await user.type(screen.getByLabelText("Search notes"), "  Café {Enter}");
    expect(push).toHaveBeenCalledWith(
      "/history?q=Caf%C3%A9&category=MANGER&subcategory=D%C3%AEner",
    );
    push.mockReset();
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("selecting a category navigates and resets the subcategory", async () => {
    const { user } = renderFilters({ q: "x", category: "MANGER", subcategory: "Dîner" });
    expect(chip("Category", "MANGER")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Subcategory", "Dîner")).toHaveAttribute("aria-pressed", "true");
    expect(within(group("Subcategory")).getAllByRole("button")).toHaveLength(5);

    await user.click(chip("Category", "TRAVAIL"));
    expect(push).toHaveBeenLastCalledWith("/history?q=x&category=TRAVAIL");

    await user.click(chip("Category", "All"));
    expect(push).toHaveBeenLastCalledWith("/history?q=x");
  });

  it("selecting a subcategory navigates with the category", async () => {
    const { user } = renderFilters({ category: "LOISIR" });
    expect(chip("Subcategory", "All")).toHaveAttribute("aria-pressed", "true");
    await user.click(chip("Subcategory", "Écouter"));
    expect(push).toHaveBeenLastCalledWith("/history?category=LOISIR&subcategory=%C3%89couter");
    await user.click(chip("Subcategory", "All"));
    expect(push).toHaveBeenLastCalledWith("/history?category=LOISIR");
  });

  it("shows a Clear filters link when filters are active", () => {
    renderFilters({ q: "dîner" });
    expect(screen.getByLabelText("Search notes")).toHaveValue("dîner");
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/history");
  });
});
