import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingScrollStory } from "./landing-scroll-story";

describe("landing-page example pricing", () => {
  it("shows the buyer-paid fee in ticket offers and the selected order total", () => {
    const html = renderToStaticMarkup(<LandingScrollStory qrCodeDataUrl="/tournibase-app-icon.svg" />);
    expect(html).toContain("Example prices include a TourniBase fee of 2% plus $0.30 per order.");
    expect(html).toContain("$28.86");
    expect(html).toContain("$18.66");
    expect(html).not.toContain("$28.00");
    expect(html).not.toContain("$18.00");
    expect(html).toContain("Demo event");
  });
});
