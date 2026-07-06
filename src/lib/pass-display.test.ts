import { describe, expect, it } from "vitest";
import {
  formatPassValidity,
  getOfflinePassFilename,
  getOfflinePassPath,
  getOfflinePassUrl,
} from "./pass-display";

describe("offline pass display helpers", () => {
  const token = "11111111-1111-4111-8111-111111111111";

  it("builds same-origin download paths and absolute email links", () => {
    expect(getOfflinePassPath(token)).toBe(
      `/p/${token}/offline-pass.png`,
    );
    expect(getOfflinePassUrl("https://tournibase.com/", token)).toBe(
      `https://tournibase.com/p/${token}/offline-pass.png`,
    );
  });

  it("creates an informative download filename", () => {
    expect(
      getOfflinePassFilename({
        orderNumber: "TB-000123",
        passId: 456,
      }),
    ).toBe("tournibase-tb-000123-pass-456.png");
  });

  it("formats validity in the tournament time zone", () => {
    expect(
      formatPassValidity(
        "2026-07-04T04:00:00.000Z",
        "2026-07-06T03:59:59.999Z",
        "America/New_York",
      ),
    ).toBe("Jul 4, 2026 – Jul 5, 2026");
  });
});
