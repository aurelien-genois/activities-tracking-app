import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecentList, type RecentActivity } from "./RecentList";

const TZ = "Europe/Paris";
const NOW = new Date("2026-10-23T14:30:00Z"); // Fri 23 Oct, 16:30 in Paris (CEST)

function activity(
  id: string,
  startAt: string,
  endAt: string,
  category = "TRAVAIL",
  subcategory = "Job",
): RecentActivity {
  return { id, startAt: new Date(startAt), endAt: new Date(endAt), category, subcategory };
}

function renderList(activities: RecentActivity[], timeZone = TZ) {
  render(<RecentList activities={activities} timeZone={timeZone} now={NOW} />);
  return screen.queryAllByRole("listitem");
}

describe("RecentList", () => {
  it("renders an accessible section with the time range, category and duration", () => {
    const [item] = renderList([
      activity("a", "2026-10-23T07:00:00Z", "2026-10-23T08:30:00Z", "MANGER", "Dej"),
    ]);
    expect(screen.getByRole("region", { name: "Recent activities" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent activities" })).toBeInTheDocument();
    expect(item).toHaveTextContent("09:00 - 10:30");
    expect(within(item).getByText("MANGER > Dej")).toBeInTheDocument();
    expect(within(item).getByText("1h 30m")).toBeInTheDocument();
  });

  it("preserves the given order (most recent first) and renders every given item", () => {
    const activities = Array.from({ length: 10 }, (_, index) => {
      const hour = String(13 - index).padStart(2, "0");
      return activity(
        `id-${index}`,
        `2026-10-23T${hour}:00:00Z`,
        `2026-10-23T${hour}:30:00Z`,
        "LOISIR",
        "Lecture",
      );
    });
    const items = renderList(activities);
    expect(items).toHaveLength(10);
    expect(items[0]).toHaveTextContent("15:00 - 15:30");
    expect(items[9]).toHaveTextContent("06:00 - 06:30");
    items.forEach((item) => expect(item).toHaveTextContent("30m"));
  });

  it("shows an empty state when there are no activities", () => {
    expect(renderList([])).toHaveLength(0);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText("No activities yet.")).toBeInTheDocument();
  });

  it("labels activities that are not today with their day, in the time zone", () => {
    const [today, afterMidnight, yesterday] = renderList([
      activity("today", "2026-10-23T07:00:00Z", "2026-10-23T08:00:00Z"),
      // 22:30 UTC on the 22nd is already 00:30 on the 23rd in Paris: today.
      activity("midnight", "2026-10-22T22:30:00Z", "2026-10-22T23:00:00Z"),
      activity("yesterday", "2026-10-22T10:00:00Z", "2026-10-22T10:45:00Z"),
    ]);
    expect(today).not.toHaveTextContent(/Oct/);
    expect(afterMidnight).toHaveTextContent("00:30 - 01:00");
    expect(afterMidnight).not.toHaveTextContent(/Oct/);
    expect(within(yesterday).getByText("Thu 22 Oct")).toBeInTheDocument();
    expect(yesterday).toHaveTextContent("12:00 - 12:45");
    expect(within(yesterday).getByText("45m")).toBeInTheDocument();
  });

  it("displays UTC instants in Europe/Paris for summer (CEST) and winter (CET)", () => {
    const [summer, winter] = renderList([
      activity("summer", "2026-07-14T06:00:00Z", "2026-07-14T08:00:00Z", "REPOS", "Dormir"),
      activity("winter", "2026-01-15T08:00:00Z", "2026-01-15T09:05:00Z", "FAMILLE", "Discussion"),
    ]);
    expect(summer).toHaveTextContent("Tue 14 Jul");
    expect(summer).toHaveTextContent("08:00 - 10:00");
    expect(within(summer).getByText("2h")).toBeInTheDocument();
    expect(winter).toHaveTextContent("Thu 15 Jan");
    expect(winter).toHaveTextContent("09:00 - 10:05");
    expect(within(winter).getByText("1h 05m")).toBeInTheDocument();
  });

  it("uses the given time zone", () => {
    const [item] = renderList(
      [activity("a", "2026-10-23T07:00:00Z", "2026-10-23T08:00:00Z")],
      "UTC",
    );
    expect(item).toHaveTextContent("07:00 - 08:00");
  });

  it("defaults 'today' to the current date", () => {
    const now = new Date();
    render(
      <RecentList
        activities={[
          { id: "now", startAt: now, endAt: now, category: "LOISIR", subcategory: "Jeu-vidéo" },
        ]}
        timeZone={TZ}
      />,
    );
    expect(screen.getByRole("listitem")).not.toHaveTextContent(
      /[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}/,
    );
  });
});
