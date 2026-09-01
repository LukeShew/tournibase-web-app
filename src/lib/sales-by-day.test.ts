import { describe, expect, it } from "vitest";
import { selectSalesByDay, type SalesByDay } from "./sales-by-day";

describe("selectSalesByDay", () => {
  it("shows sales dates from oldest to newest", () => {
    expect(
      selectSalesByDay([
        { date: "2026-08-30", totalRevenue: 10 },
        { date: "2026-08-29", totalRevenue: 12 },
      ]),
    ).toEqual([
      { date: "2026-08-29", totalRevenue: 12 },
      { date: "2026-08-30", totalRevenue: 10 },
    ]);
  });

  it("keeps only the seven highest-sales dates and displays them chronologically", () => {
    const days: SalesByDay[] = [
      { date: "2026-08-01", totalRevenue: 5 },
      { date: "2026-08-02", totalRevenue: 90 },
      { date: "2026-08-03", totalRevenue: 20 },
      { date: "2026-08-04", totalRevenue: 80 },
      { date: "2026-08-05", totalRevenue: 30 },
      { date: "2026-08-06", totalRevenue: 70 },
      { date: "2026-08-07", totalRevenue: 40 },
      { date: "2026-08-08", totalRevenue: 60 },
      { date: "2026-08-09", totalRevenue: 50 },
    ];

    expect(selectSalesByDay(days)).toEqual([
      { date: "2026-08-02", totalRevenue: 90 },
      { date: "2026-08-04", totalRevenue: 80 },
      { date: "2026-08-05", totalRevenue: 30 },
      { date: "2026-08-06", totalRevenue: 70 },
      { date: "2026-08-07", totalRevenue: 40 },
      { date: "2026-08-08", totalRevenue: 60 },
      { date: "2026-08-09", totalRevenue: 50 },
    ]);
  });

  it("does not mutate the original sales data", () => {
    const days = [
      { date: "2026-08-30", totalRevenue: 10 },
      { date: "2026-08-29", totalRevenue: 12 },
    ];

    selectSalesByDay(days);

    expect(days).toEqual([
      { date: "2026-08-30", totalRevenue: 10 },
      { date: "2026-08-29", totalRevenue: 12 },
    ]);
  });
});
