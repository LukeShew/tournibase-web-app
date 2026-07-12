import type { CSSProperties } from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

export type RefundConfirmationEmailData = {
  amountPaid: string;
  amountRefunded: string;
  buyerName: string;
  eventDate: string;
  eventName: string;
  logoUrl: string;
  orderNumber: string;
  organizerEmail: string;
  organizerName: string;
  refundStatus: "refunded" | "partial_refund";
  venueName: string;
};

export function RefundConfirmationEmail({
  amountPaid,
  amountRefunded,
  buyerName,
  eventDate,
  eventName,
  logoUrl,
  orderNumber,
  organizerEmail,
  organizerName,
  refundStatus,
  venueName,
}: RefundConfirmationEmailData) {
  const firstName = buyerName.trim().split(/\s+/)[0] || "there";
  const isFullRefund = refundStatus === "refunded";

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Your {eventName} refund was processed
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandBar}>
            <Img alt="" height="42" src={logoUrl} style={logo} width="42" />
            <Text style={brandName}>TourniBase</Text>
          </Section>

          <Section style={card}>
            <Text style={eyebrow}>
              {isFullRefund ? "REFUND CONFIRMED" : "PARTIAL REFUND CONFIRMED"}
            </Text>
            <Heading style={heading}>
              {isFullRefund
                ? "Your order was refunded"
                : "A partial refund was processed"}
            </Heading>
            <Text style={intro}>
              Hi {firstName}, a refund was processed for your{" "}
              <strong>{eventName}</strong> admission order.
            </Text>

            <Section style={eventPanel}>
              <Text style={eventNameStyle}>{eventName}</Text>
              <Text style={detailText}>{eventDate}</Text>
              <Text style={detailText}>{venueName}</Text>
            </Section>

            <Section style={summaryPanel}>
              <SummaryRow label="Amount refunded" value={amountRefunded} />
              <SummaryRow label="Original payment" value={amountPaid} />
              <SummaryRow label="Order" value={orderNumber} />
            </Section>

            <Text style={statusText}>
              {isFullRefund
                ? "The mobile passes for this order are no longer valid for entry."
                : "This was a partial refund. Any remaining pass access should be confirmed with the event organizer."}
            </Text>

            <Hr style={divider} />

            <Text style={supportText}>
              Questions? Contact{" "}
              <Link href={`mailto:${organizerEmail}`} style={supportLink}>
                {organizerName}
              </Link>{" "}
              and include order {orderNumber}.
            </Text>
          </Section>

          <Text style={footer}>
            TourniBase digital admission · Keep this email for your records.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Section style={summaryRow}>
      <Text style={summaryLabel}>{label}</Text>
      <Text style={summaryValue}>{value}</Text>
    </Section>
  );
}

export function createRefundConfirmationText({
  amountPaid,
  amountRefunded,
  buyerName,
  eventDate,
  eventName,
  orderNumber,
  organizerEmail,
  organizerName,
  refundStatus,
  venueName,
}: RefundConfirmationEmailData) {
  const isFullRefund = refundStatus === "refunded";

  return [
    `Your ${eventName} refund was processed`,
    "",
    `Hi ${buyerName},`,
    "",
    `Event: ${eventName}`,
    `Date: ${eventDate}`,
    `Venue: ${venueName}`,
    `Order: ${orderNumber}`,
    `Amount refunded: ${amountRefunded}`,
    `Original payment: ${amountPaid}`,
    "",
    isFullRefund
      ? "The mobile passes for this order are no longer valid for entry."
      : "This was a partial refund. Any remaining pass access should be confirmed with the event organizer.",
    "",
    `Questions? Contact ${organizerName} at ${organizerEmail} and include order ${orderNumber}.`,
    "",
    "TourniBase digital admission",
  ].join("\n");
}

const body: CSSProperties = {
  backgroundColor: "#eef3f9",
  color: "#142033",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin: 0,
  padding: "28px 12px",
};

const container: CSSProperties = {
  margin: "0 auto",
  maxWidth: "600px",
};

const brandBar: CSSProperties = {
  padding: "0 8px 18px",
  width: "100%",
};

const logo: CSSProperties = {
  display: "inline-block",
  verticalAlign: "middle",
};

const brandName: CSSProperties = {
  color: "#0b1c34",
  display: "inline-block",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 0 10px",
  verticalAlign: "middle",
};

const card: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #dce5f0",
  borderRadius: "18px",
  padding: "34px",
  width: "100%",
};

const eyebrow: CSSProperties = {
  color: "#13795b",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  margin: 0,
};

const heading: CSSProperties = {
  color: "#0b1c34",
  fontSize: "32px",
  letterSpacing: "-0.03em",
  lineHeight: "1.15",
  margin: "10px 0 12px",
};

const intro: CSSProperties = {
  color: "#4b5d73",
  fontSize: "16px",
  lineHeight: "1.65",
  margin: "0 0 24px",
};

const eventPanel: CSSProperties = {
  backgroundColor: "#f5f8fc",
  border: "1px solid #e1e8f1",
  borderRadius: "12px",
  padding: "18px 20px",
  width: "100%",
};

const eventNameStyle: CSSProperties = {
  color: "#0b1c34",
  fontSize: "18px",
  fontWeight: 700,
  margin: "0 0 6px",
};

const detailText: CSSProperties = {
  color: "#62748a",
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "2px 0",
};

const summaryPanel: CSSProperties = {
  border: "1px solid #dbe4ef",
  borderRadius: "12px",
  marginTop: "20px",
  padding: "12px 18px",
  width: "100%",
};

const summaryRow: CSSProperties = {
  borderBottom: "1px solid #edf1f6",
  padding: "8px 0",
  width: "100%",
};

const summaryLabel: CSSProperties = {
  color: "#62748a",
  display: "inline-block",
  fontSize: "14px",
  margin: 0,
  width: "52%",
};

const summaryValue: CSSProperties = {
  color: "#142033",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 700,
  margin: 0,
  textAlign: "right",
  width: "48%",
};

const statusText: CSSProperties = {
  color: "#34465d",
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "20px 0 0",
};

const divider: CSSProperties = {
  borderColor: "#e2e8f0",
  margin: "28px 0 0",
};

const supportText: CSSProperties = {
  color: "#62748a",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "24px 0 0",
};

const supportLink: CSSProperties = {
  color: "#2563eb",
  fontWeight: 600,
};

const footer: CSSProperties = {
  color: "#52657c",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "18px 8px 0",
  textAlign: "center",
};
