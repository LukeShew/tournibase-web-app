import { afterEach, describe, expect, it } from "vitest";
import { getAuthEmailRedirectUrl } from "./auth-email-url";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

describe("getAuthEmailRedirectUrl", () => {
  it("never sends hosted confirmation emails back to localhost", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(getAuthEmailRedirectUrl()).toBe(
      "https://tournibase.com/email-confirmed",
    );
  });

  it("uses a configured hosted site URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://preview.example.com/";
    expect(getAuthEmailRedirectUrl()).toBe(
      "https://preview.example.com/email-confirmed",
    );
  });
});
