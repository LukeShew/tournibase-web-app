import { render } from "react-email";
import { describe, expect, it } from "vitest";
import {
  createOrderConfirmationText,
  OrderConfirmationEmail,
  type OrderConfirmationEmailData,
} from "./order-confirmation";

const sample: OrderConfirmationEmailData = {
  amountPaid: "$25.00",
  buyerName: "Taylor Parent",
  eventDate: "July 11–12, 2026",
  eventName: "DMV Summer Tip-Off Classic",
  items: [
    {
      lineTotal: "$25.00",
      name: "Weekend Pass",
      quantity: 1,
    },
  ],
  logoUrl: "http://localhost:3000/icon.png",
  orderNumber: "TB-000123",
  organizerEmail: "director@example.com",
  organizerName: "Sample Director",
  passes: [
    {
      label: "Weekend Pass",
      offlineUrl:
        "http://localhost:3000/p/11111111-1111-4111-8111-111111111111/offline-pass.png",
      url: "http://localhost:3000/p/11111111-1111-4111-8111-111111111111",
    },
    {
      label: "Saturday Pass",
      offlineUrl:
        "http://localhost:3000/p/22222222-2222-4222-8222-222222222222/offline-pass.png",
      url: "http://localhost:3000/p/22222222-2222-4222-8222-222222222222",
    },
  ],
  venueAddress: "123 Main Street, Arlington, VA",
  venueName: "Capital Sports Center",
};

describe("order confirmation email", () => {
  it("renders every pass link and the order details", async () => {
    const html = await render(<OrderConfirmationEmail {...sample} />);

    expect(html).toContain(sample.eventName);
    expect(html).toContain(sample.orderNumber);
    expect(html).toContain(sample.amountPaid);

    for (const pass of sample.passes) {
      expect(html).toContain(pass.url);
      expect(html).toContain(pass.offlineUrl);
    }
  });

  it("creates a useful plain-text fallback", () => {
    const text = createOrderConfirmationText(sample);

    expect(text).toContain("MOBILE PASSES");
    expect(text).toContain(sample.organizerEmail);
    expect(text).toContain(sample.venueAddress);

    for (const pass of sample.passes) {
      expect(text).toContain(pass.url);
      expect(text).toContain(pass.offlineUrl);
    }
  });
});
