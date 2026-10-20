import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingScrollStory } from "./landing-scroll-story";

describe("landing-page example pricing", () => {
  it("shows the buyer-paid fee in ticket offers and the selected order total", () => {
    const html = renderToStaticMarkup(<LandingScrollStory qrCodeDataUrl="/tournibase-app-icon.svg" />);
    expect(html).toContain("prices include a $1 fee per paid pass through $10.");
    expect(html).toContain("fee is $1 plus 4% of the ticket price.");
    expect(html).toContain("$30.12");
    expect(html).toContain("$19.72");
    expect(html).not.toContain("$28.00");
    expect(html).not.toContain("$18.00");
    expect(html).toContain("Demo event");
  });
});
