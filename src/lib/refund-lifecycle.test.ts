import { describe, expect, it } from "vitest";
import { getRefundLifecycle } from "./refund-lifecycle";

describe("authoritative refund lifecycle", () => {
  it("separates pending and failed attempts from actual money returned", () => {
    expect(getRefundLifecycle([
      { id: "re_1", amount: 1000, status: "succeeded" },
      { id: "re_2", amount: 500, status: "pending" },
      { id: "re_3", amount: 200, status: "requires_action" },
      { id: "re_4", amount: 2000, status: "failed" },
      { id: "re_5", amount: 2000, status: "canceled" },
      { id: "re_1", amount: 1000, status: "succeeded" },
    ], 2000)).toEqual({ succeededCents: 1000, pendingCents: 700, failedCents: 4000 });
  });
  it("fails closed on unknown status or inconsistent money", () => {
    expect(() => getRefundLifecycle([{ id: "re_1", amount: 2001, status: "succeeded" }], 2000)).toThrow("changed");
    expect(() => getRefundLifecycle([{ id: "re_1", amount: 1000, status: null }], 2000)).toThrow("unknown");
  });
});
