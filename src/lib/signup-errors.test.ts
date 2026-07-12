import { describe, expect, it } from "vitest";
import { getSignupFailureMessage } from "./signup-errors";

describe("getSignupFailureMessage", () => {
  it("uses duplicate copy only when Supabase reports an existing account", () => {
    expect(
      getSignupFailureMessage({
        error: { message: "User already registered" },
        identityCreated: true,
      }),
    ).toBe("An account with that email already exists. Try signing in.");
  });

  it("uses duplicate copy when Supabase does not create a new identity", () => {
    expect(
      getSignupFailureMessage({
        error: null,
        identityCreated: false,
      }),
    ).toBe("An account with that email already exists. Try signing in.");
  });

  it("does not call non-duplicate service failures duplicate emails", () => {
    expect(
      getSignupFailureMessage({
        error: { message: "Database error saving new user" },
        identityCreated: false,
      }),
    ).toBe("The account could not be created. Try again.");
  });

  it("explains when the hosted Supabase project blocks signup", () => {
    expect(
      getSignupFailureMessage({
        error: {
          code: "signup_disabled",
          message: "Signups not allowed for this instance",
        },
        identityCreated: false,
      }),
    ).toBe(
      "New account creation is not enabled right now. Contact TourniBase support.",
    );
  });

  it("uses password copy for password policy failures", () => {
    expect(
      getSignupFailureMessage({
        error: { message: "Password should contain more characters" },
        identityCreated: true,
      }),
    ).toBe("Use a stronger password, then try again.");
  });
});
