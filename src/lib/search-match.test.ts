import { describe, expect, it } from "vitest";
import { matchesStrictText, matchesTightName } from "./search-match";

describe("matchesTightName", () => {
  it("matches exact and partial names", () => {
    expect(matchesTightName("Luke Shewmaker", "Luke")).toBe(true);
    expect(matchesTightName("Luke Shewmaker", "Shew")).toBe(true);
  });

  it("allows one small typo or transposition", () => {
    expect(matchesTightName("Luke Shewmaker", "Luek Shewmaker")).toBe(true);
    expect(matchesTightName("Summer Tournament", "Summer Tournamnet")).toBe(true);
  });

  it("keeps short and unrelated searches strict", () => {
    expect(matchesTightName("Luke Shewmaker", "Lime")).toBe(false);
    expect(matchesTightName("Luke Shewmaker", "Mark Jones")).toBe(false);
    expect(matchesTightName("Luke Shewmaker", "Lux")).toBe(false);
  });

  it("does not fuzzy match identifier-shaped searches", () => {
    expect(matchesTightName("Luke Shewmaker", "luke@example.com")).toBe(false);
    expect(matchesTightName("Luke Shewmaker", "TB-000123")).toBe(false);
  });
});

describe("matchesStrictText", () => {
  it("matches normalized substrings without allowing typos", () => {
    expect(matchesStrictText("TB-000123", "000123")).toBe(true);
    expect(matchesStrictText("luke@example.com", "luke@example")).toBe(true);
    expect(matchesStrictText("TB-000123", "TB-000132")).toBe(false);
  });
});
