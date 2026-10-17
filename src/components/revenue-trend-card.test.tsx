import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RevenueTrendCard } from "./revenue-trend-card";

const days = Array.from({ length: 10 }, (_, index) => ({
  date: `2026-10-${String(index + 1).padStart(2, "0")}`,
  totalRevenue: (index + 1) * 100,
}));

describe("RevenueTrendCard layout", () => {
  it.each([
    { label: "populated", days },
    { label: "empty", days: [] },
  ])("lets its container size a $label card instead of taking its entire parent's height", ({ days }) => {
    const html = renderToStaticMarkup(
      <RevenueTrendCard days={days} totalRevenue={5500} />,
    );
    const rootClasses = html.match(/^<section class="([^"]+)"/)?.[1].split(" ");

    // A 100%-height card overflows an overview/hero stack that has siblings.
    // Auto height also preserves the Orders grid's default cross-axis stretch.
    expect(rootClasses).toContain("revenue-trend-card");
    expect(rootClasses).not.toContain("h-full");
    expect(rootClasses).not.toContain("self-start");
    expect(rootClasses).toEqual(expect.arrayContaining(["flex", "flex-col", "min-w-0"]));
  });

  it("keeps the seven highest-sales dates chronological and fully labeled", () => {
    const html = renderToStaticMarkup(
      <RevenueTrendCard days={days} totalRevenue={5500} />,
    );

    expect(html.match(/class="revenue-trend-day /g)).toHaveLength(7);
    expect(html).toContain("repeat(7, minmax(0, 1fr))");
    expect(html).toContain("$5,500.00");
    let previous = -1;
    for (let day = 4; day <= 10; day++) {
      const at = html.indexOf(`title="Oct ${day}, 2026 ·`);
      expect(at).toBeGreaterThan(previous);
      previous = at;
    }
    expect(html).toContain("revenue-trend-label h-16 min-w-0");
    expect(html).toContain("revenue-trend-full");
    expect(html).toContain("revenue-trend-compact");
  });

  it("keeps readable minimum plot height for an empty card", () => {
    const html = renderToStaticMarkup(
      <RevenueTrendCard days={[]} totalRevenue={0} />,
    );
    expect(html).toContain("min-h-64 flex-1");
    expect(html).toContain("No sales data yet");
    expect(html).toContain("$0.00");
  });
});
