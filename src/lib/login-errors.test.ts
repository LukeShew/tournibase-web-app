import { describe, expect, it } from "vitest";
import {
  getLoginFailureMessage,
  isEmailConfirmationRequired,
} from "./login-errors";

describe("login error helpers", () => {
  it("recognizes Supabase's unconfirmed-email error", () => {
    expect(
      isEmailConfirmationRequired({ code: "email_not_confirmed" }),
    ).toBe(true);
    expect(
      isEmailConfirmationRequired({ message: "Email not confirmed" }),
    ).toBe(true);
  });

  it("distinguishes a missing account from a wrong password", () => {
    expect(getLoginFailureMessage({ accountExists: false })).toBe(
      "No account exists with that email. Create an account first.",
    );
    expect(getLoginFailureMessage({ accountExists: true })).toBe(
      "The password is incorrect.",
    );
  });

  it("uses a generic fallback when account lookup fails", () => {
    expect(getLoginFailureMessage({ accountExists: null })).toBe(
      "Email or password is incorrect.",
    );
  });
});
