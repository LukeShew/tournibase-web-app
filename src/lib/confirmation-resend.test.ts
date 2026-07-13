import { describe, expect, it } from "vitest";
import { getConfirmationResendSecondsRemaining } from "./confirmation-resend";

describe("confirmation resend cooldown", () => {
  it("counts down without showing negative time", () => {
    expect(getConfirmationResendSecondsRemaining(60_000, 0)).toBe(60);
    expect(getConfirmationResendSecondsRemaining(60_000, 59_001)).toBe(1);
    expect(getConfirmationResendSecondsRemaining(60_000, 60_001)).toBe(0);
  });
});
