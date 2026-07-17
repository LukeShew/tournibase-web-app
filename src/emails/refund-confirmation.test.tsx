import { render } from "react-email";
import { describe, expect, it } from "vitest";
import {
  createRefundConfirmationText,
  RefundConfirmationEmail,
  type RefundConfirmationEmailData,
} from "./refund-confirmation";

const sample: RefundConfirmationEmailData = {
  amountPaid: "$25.00",
  amountRefunded: "$25.00",
  buyerName: "Taylor Parent",
  eventDate: "July 11–12, 2026",
  eventName: "DMV Summer Tip-Off Classic",
  logoUrl: "http://localhost:3000/icon.png",
  orderNumber: "TB-000123",
  organizerEmail: "director@example.com",
  organizerName: "Sample Director",
  refundStatus: "refunded",
  venueName: "Capital Sports Center",
};

describe("refund confirmation email", () => {
  it("renders refund details and support contact", async () => {
    const html = await render(<RefundConfirmationEmail {...sample} />);

    expect(html).toContain(sample.eventName);
    expect(html).toContain(sample.orderNumber);
    expect(html).toContain(sample.amountRefunded);
    expect(html).toContain(sample.organizerEmail);
    expect(html).toContain("no longer valid for entry");
    expect(html).toContain("the event seller");
  });

  it("creates a plain-text fallback for full refunds", () => {
    const text = createRefundConfirmationText(sample);

    expect(text).toContain("Amount refunded: $25.00");
    expect(text).toContain("Original payment: $25.00");
    expect(text).toContain("no longer valid for entry");
    expect(text).toContain(sample.organizerEmail);
    expect(text).toContain("the event seller");
  });

  it("explains partial refunds without voiding passes", () => {
    const text = createRefundConfirmationText({
      ...sample,
      amountRefunded: "$10.00",
      refundStatus: "partial_refund",
    });

    expect(text).toContain("partial refund");
    expect(text).toContain("remaining pass access");
  });
});
