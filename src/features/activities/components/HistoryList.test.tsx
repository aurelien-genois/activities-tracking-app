import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ updateActivity: vi.fn(), deleteActivity: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { type EditableActivity } from "./EditActivityDialog";
import { HISTORY_EMPTY_MESSAGE, HistoryList } from "./HistoryList";

const TZ = "Europe/Paris";

function activity(
  id: string,
  startAt: string,
  endAt: string,
  extra: Partial<EditableActivity> = {},
): EditableActivity {
  return {
    id,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    category: "TRAVAIL",
    subcategory: "Job",
    notes: null,
    ...extra,
  };
}

describe("HistoryList", () => {
  it("shows the empty state", () => {
    render(<HistoryList activities={[]} timeZone={TZ} />);
    expect(screen.getByText(HISTORY_EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("groups activities by local day with time range, duration, category and notes", () => {
    render(
      <HistoryList
        timeZone={TZ}
        activities={[
          activity("a", "2026-10-22T22:30:00Z", "2026-10-22T23:15:00Z", {
            category: "MANGER",
            subcategory: "Dîner",
            notes: "Dîner tardif",
          }),
          activity("b", "2026-10-22T07:00:00Z", "2026-10-22T09:05:00Z"),
          activity("c", "2026-10-22T06:00:00Z", "2026-10-22T07:00:00Z", {
            category: "LOISIR",
            subcategory: "Écouter",
          }),
        ]}
      />,
    );

    const friday = screen.getByRole("region", { name: "Fri 23 Oct 2026" });
    const thursday = screen.getByRole("region", { name: "Thu 22 Oct 2026" });

    const [late] = within(friday).getAllByRole("listitem");
    expect(late).toHaveTextContent("00:30 - 01:15");
    expect(late).toHaveTextContent("45m");
    expect(late).toHaveTextContent("MANGER > Dîner");
    expect(within(late).getByText("Dîner tardif")).toBeInTheDocument();
    expect(within(late).getByRole("button", { name: /^Edit 00:30 - 01:15/ })).toBeInTheDocument();
    expect(within(late).getByRole("button", { name: /^Delete 00:30 - 01:15/ })).toBeInTheDocument();

    const items = within(thursday).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("09:00 - 11:05");
    expect(items[0]).toHaveTextContent("2h 05m");
    expect(items[1]).toHaveTextContent("LOISIR > Écouter");
  });
});
