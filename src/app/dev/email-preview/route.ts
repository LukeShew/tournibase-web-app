import { render } from "react-email";
import {
  OrderConfirmationEmail,
  type OrderConfirmationEmailData,
} from "@/emails/order-confirmation";

export const runtime = "nodejs";

const sample: OrderConfirmationEmailData = {
  amountPaid: "$25.00",
  buyerName: "Taylor Parent",
  eventDate: "July 11–12, 2026",
  eventName: "DMV Summer Tip-Off Classic",
  items: [
    {
      lineTotal: "$15.00",
      name: "Weekend Pass",
      quantity: 1,
    },
    {
      lineTotal: "$10.00",
      name: "One Day Pass (Saturday)",
      quantity: 1,
    },
  ],
  logoUrl: "http://localhost:3000/icon.png",
  orderNumber: "TB-000123",
  organizerEmail: "demo.director@tournibase.test",
  organizerName: "TourniBase Demo Director",
  passes: [
    {
      label: "Weekend Pass",
      offlineUrl:
        "http://localhost:3000/p/11111111-1111-4111-8111-111111111111/offline-pass.png",
      url: "http://localhost:3000/p/11111111-1111-4111-8111-111111111111",
    },
    {
      label: "One Day Pass (Saturday)",
      offlineUrl:
        "http://localhost:3000/p/22222222-2222-4222-8222-222222222222/offline-pass.png",
      url: "http://localhost:3000/p/22222222-2222-4222-8222-222222222222",
    },
  ],
  venueAddress: "123 Main Street, Arlington, VA",
  venueName: "Capital Sports Center",
};

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const html = await render(OrderConfirmationEmail(sample));

  return new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
