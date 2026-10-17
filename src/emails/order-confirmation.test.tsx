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
        "http://localhost:3000/p/11111111-1111-4111-8111-111111111111/save",
      url: "http://localhost:3000/p/11111111-1111-4111-8111-111111111111",
    },
    {
      label: "Saturday Pass",
      offlineUrl:
        "http://localhost:3000/p/22222222-2222-4222-8222-222222222222/save",
      url: "http://localhost:3000/p/22222222-2222-4222-8222-222222222222",
    },
  ],
  venueAddress: "123 Main Street, Arlington, VA",
  venueName: "Capital Sports Center",
};

describe("order confirmation email", () => {
  it("itemizes the buyer fee above ticket prices in both receipt formats", async () => {
    const withFee = { ...sample, amountPaid: "$25.80", buyerFee: "$0.80", ticketSubtotal: "$25.00" };
    const html = await render(<OrderConfirmationEmail {...withFee} />);
    const text = createOrderConfirmationText(withFee);

    for (const body of [html, text]) {
      expect(body).toContain("Ticket subtotal");
      expect(body).toContain("TourniBase service fee");
      expect(body).toContain("$25.00");
      expect(body).toContain("$0.80");
      expect(body).toContain("$25.80");
    }
    expect(text).toContain("Amount paid: $25.80");
  });

  it("keeps legacy and no-fee receipts free of added service fees", async () => {
    const html = await render(<OrderConfirmationEmail {...sample} />);
    expect(html).not.toContain("TourniBase service fee");
    expect(createOrderConfirmationText(sample)).not.toContain("TourniBase service fee");
  });

  it("renders every pass link and the order details", async () => {
    const html = await render(<OrderConfirmationEmail {...sample} />);

    expect(html).toContain(sample.eventName);
    expect(html).toContain(sample.orderNumber);
    expect(html).toContain(sample.amountPaid);
    expect(html).toContain("Questions or refund requests?");
    expect(html).toContain("is the seller for this admission order");

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
    expect(text).toContain("refund requests");
    expect(text).toContain("is the seller for this admission order");

    for (const pass of sample.passes) {
      expect(text).toContain(pass.url);
      expect(text).toContain(pass.offlineUrl);
    }
  });

  it("clearly separates the original purchase and refund in HTML and text", async () => {
    const partiallyRefunded: OrderConfirmationEmailData = {
      ...sample,
      refund: { amountRefunded: "$10.00", amountRemaining: "$15.00" },
    };
    const html = await render(<OrderConfirmationEmail {...partiallyRefunded} />);
    const text = createOrderConfirmationText(partiallyRefunded);

    for (const body of [html, text]) {
      expect(body.toLowerCase()).toContain("original order summary");
      expect(body).toContain("Original amount paid");
      expect(body).toContain("$25.00");
      expect(body).toContain("Refunded");
      expect(body).toContain("$10.00");
      expect(body).toContain("Amount after refunds");
      expect(body).toContain("$15.00");
      expect(body).toContain("refunded passes cannot be used for entry");
    }
  });
});
