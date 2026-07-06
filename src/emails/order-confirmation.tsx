import type { CSSProperties } from "react";
import {
  Body,
  Button,
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

export type OrderConfirmationEmailData = {
  amountPaid: string;
  buyerName: string;
  eventDate: string;
  eventName: string;
  items: Array<{
    lineTotal: string;
    name: string;
    quantity: number;
  }>;
  logoUrl: string;
  orderNumber: string;
  organizerEmail: string;
  organizerName: string;
  passes: Array<{
    label: string;
    offlineUrl: string;
    url: string;
  }>;
  venueAddress: string | null;
  venueName: string;
};

export function OrderConfirmationEmail({
  amountPaid,
  buyerName,
  eventDate,
  eventName,
  items,
  logoUrl,
  orderNumber,
  organizerEmail,
  organizerName,
  passes,
  venueAddress,
  venueName,
}: OrderConfirmationEmailData) {
  const firstName = buyerName.trim().split(/\s+/)[0] || "there";

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Your {eventName} passes are ready
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandBar}>
            <Img
              alt=""
              height="42"
              src={logoUrl}
              style={logo}
              width="42"
            />
            <Text style={brandName}>TourniBase</Text>
          </Section>

          <Section style={card}>
            <Text style={eyebrow}>PAYMENT CONFIRMED</Text>
            <Heading style={heading}>Your passes are ready</Heading>
            <Text style={intro}>
              Hi {firstName}, your order for <strong>{eventName}</strong> is
              confirmed. Keep this email available so each guest can open their
              pass at the gate.
            </Text>

            <Section style={eventPanel}>
              <Text style={eventNameStyle}>{eventName}</Text>
              <Text style={detailText}>{eventDate}</Text>
              <Text style={detailText}>{venueName}</Text>
              {venueAddress ? (
                <Text style={detailText}>{venueAddress}</Text>
              ) : null}
            </Section>

            <Heading as="h2" style={sectionHeading}>
              Mobile passes
            </Heading>
            <Text style={sectionDescription}>
              Each link opens one unique QR pass. Do not post or forward these
              links publicly.
            </Text>

            {passes.map((pass, index) => (
              <Section key={pass.url} style={passPanel}>
                <Text style={passLabel}>
                  {pass.label} · Pass {index + 1}
                </Text>
                <Button href={pass.url} style={button}>
                  Open mobile pass
                </Button>
                <Button href={pass.offlineUrl} style={secondaryButton}>
                  Save pass offline
                </Button>
                <Text style={offlineHelp}>
                  Save the image to Photos or Files before arriving if service
                  at the venue may be weak.
                </Text>
                <Text style={fallbackText}>
                  If the button does not work, copy this link:
                  <br />
                  <Link href={pass.url} style={fallbackLink}>
                    {pass.url}
                  </Link>
                </Text>
              </Section>
            ))}

            <Hr style={divider} />

            <Heading as="h2" style={sectionHeading}>
              Order summary
            </Heading>
            {items.map((item) => (
              <Section key={item.name} style={itemRow}>
                <Text style={itemName}>
                  {item.quantity} × {item.name}
                </Text>
                <Text style={itemPrice}>{item.lineTotal}</Text>
              </Section>
            ))}

            <Section style={totalRow}>
              <Text style={totalLabel}>Amount paid</Text>
              <Text style={totalValue}>{amountPaid}</Text>
            </Section>
            <Text style={orderNumberStyle}>Order {orderNumber}</Text>

            <Hr style={divider} />

            <Text style={supportText}>
              Questions about this event? Contact{" "}
              <Link href={`mailto:${organizerEmail}`} style={supportLink}>
                {organizerName}
              </Link>
              .
            </Text>
          </Section>

          <Text style={footer}>
            TourniBase digital admission · Keep this email until the event ends.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function createOrderConfirmationText({
  amountPaid,
  buyerName,
  eventDate,
  eventName,
  items,
  orderNumber,
  organizerEmail,
  organizerName,
  passes,
  venueAddress,
  venueName,
}: OrderConfirmationEmailData) {
  const passLines = passes
    .map(
      (pass, index) =>
        `${pass.label} · Pass ${index + 1}\nOpen pass: ${pass.url}\nSave offline: ${pass.offlineUrl}`,
    )
    .join("\n\n");
  const itemLines = items
    .map((item) => `${item.quantity} × ${item.name}: ${item.lineTotal}`)
    .join("\n");

  return [
    `Your ${eventName} passes are ready`,
    "",
    `Hi ${buyerName},`,
    "",
    `Event: ${eventName}`,
    `Date: ${eventDate}`,
    `Venue: ${venueName}`,
    ...(venueAddress ? [`Address: ${venueAddress}`] : []),
    "",
    "MOBILE PASSES",
    "Each link opens one unique QR pass. Do not post or forward these links publicly.",
    "",
    passLines,
    "",
    "ORDER SUMMARY",
    itemLines,
    `Amount paid: ${amountPaid}`,
    `Order: ${orderNumber}`,
    "",
    `Questions? Contact ${organizerName} at ${organizerEmail}.`,
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

const sectionHeading: CSSProperties = {
  color: "#0b1c34",
  fontSize: "20px",
  lineHeight: "1.3",
  margin: "28px 0 6px",
};

const sectionDescription: CSSProperties = {
  color: "#62748a",
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "0 0 14px",
};

const passPanel: CSSProperties = {
  border: "1px solid #dbe4ef",
  borderRadius: "12px",
  marginBottom: "12px",
  padding: "18px",
  width: "100%",
};

const passLabel: CSSProperties = {
  color: "#142033",
  fontSize: "15px",
  fontWeight: 700,
  margin: "0 0 14px",
};

const button: CSSProperties = {
  backgroundColor: "#2563eb",
  borderRadius: "9px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 700,
  padding: "12px 18px",
  textDecoration: "none",
};

const secondaryButton: CSSProperties = {
  backgroundColor: "#e8f0ff",
  border: "1px solid #bfd1f5",
  borderRadius: "9px",
  color: "#1d4ed8",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 700,
  marginLeft: "8px",
  padding: "11px 16px",
  textDecoration: "none",
};

const offlineHelp: CSSProperties = {
  color: "#62748a",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "12px 0 0",
};

const fallbackText: CSSProperties = {
  color: "#8090a4",
  fontSize: "11px",
  lineHeight: "1.5",
  margin: "14px 0 0",
  wordBreak: "break-all",
};

const fallbackLink: CSSProperties = {
  color: "#4d6f9b",
};

const divider: CSSProperties = {
  borderColor: "#e2e8f0",
  margin: "28px 0 0",
};

const itemRow: CSSProperties = {
  borderBottom: "1px solid #edf1f6",
  padding: "2px 0",
  width: "100%",
};

const itemName: CSSProperties = {
  color: "#34465d",
  display: "inline-block",
  fontSize: "14px",
  margin: "10px 0",
  width: "70%",
};

const itemPrice: CSSProperties = {
  color: "#142033",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  margin: "10px 0",
  textAlign: "right",
  width: "30%",
};

const totalRow: CSSProperties = {
  paddingTop: "10px",
  width: "100%",
};

const totalLabel: CSSProperties = {
  color: "#34465d",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 700,
  margin: "8px 0",
  width: "65%",
};

const totalValue: CSSProperties = {
  color: "#0b1c34",
  display: "inline-block",
  fontSize: "18px",
  fontWeight: 800,
  margin: "8px 0",
  textAlign: "right",
  width: "35%",
};

const orderNumberStyle: CSSProperties = {
  color: "#7b8da3",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "12px",
  margin: "4px 0 0",
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
  color: "#7c8da3",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "18px 8px 0",
  textAlign: "center",
};
