import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import {
  formatPassValidity,
  getOfflinePassFilename,
} from "@/lib/pass-display";
import { isValidPassToken } from "@/lib/pass-tokens";
import { getPublicPass } from "@/lib/public-passes";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ "pass-token": string }>;
  },
) {
  const { "pass-token": token } = await params;

  if (!isValidPassToken(token)) {
    return unavailableResponse(404);
  }

  if (getSupabaseAdminConfigurationIssues().length > 0) {
    return unavailableResponse(503);
  }

  try {
    const pass = await getPublicPass(token);

    if (!pass) {
      return unavailableResponse(404);
    }

    if (pass.status === "refunded" || pass.status === "voided") {
      return unavailableResponse(409);
    }

    const qrCodeDataUrl = await QRCode.toDataURL(pass.publicToken, {
      color: {
        dark: "#07101D",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
      margin: 2,
      width: 440,
    });
    const iconUrl = new URL("/tournibase-app-icon.svg", request.url).toString();
    const filename = getOfflinePassFilename({
      orderNumber: pass.orderNumber,
      passId: pass.id,
    });
    const disposition =
      new URL(request.url).searchParams.get("view") === "1"
        ? "inline"
        : "attachment";

    return new ImageResponse(
      (
        <div
          style={{
            alignItems: "center",
            backgroundColor: "#06101f",
            backgroundImage:
              "linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            color: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "center",
            padding: "44px",
            width: "100%",
          }}
        >
          <div
            style={{
              backgroundColor: "#0d1a2d",
              border: "2px solid #22324a",
              borderRadius: "38px",
              boxShadow: "0 28px 70px rgba(0, 0, 0, 0.38)",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              width: "100%",
            }}
          >
            <div
              style={{
                alignItems: "center",
                borderBottom: "2px solid #22324a",
                display: "flex",
                padding: "32px 42px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                height={62}
                src={iconUrl}
                style={{ borderRadius: "14px" }}
                width={62}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginLeft: "18px",
                }}
              >
                <div
                  style={{
                    fontSize: "30px",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                  }}
                >
                  TourniBase
                </div>
                <div
                  style={{
                    color: "#83b9ff",
                    fontSize: "15px",
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    marginTop: "4px",
                  }}
                >
                  OFFLINE ADMISSION PASS
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "34px 42px 22px",
              }}
            >
              <div
                style={{
                  color: "#8bbdff",
                  fontSize: "20px",
                  fontWeight: 700,
                }}
              >
                {pass.ticketName}
              </div>
              <div
                style={{
                  fontSize: "42px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.08,
                  marginTop: "8px",
                }}
              >
                {pass.eventName}
              </div>
              <div
                style={{
                  color: "#9fb0c6",
                  display: "flex",
                  fontSize: "22px",
                  marginTop: "14px",
                }}
              >
                Valid{" "}
                {formatPassValidity(
                  pass.validFrom,
                  pass.validUntil,
                  pass.eventTimeZone,
                )}
              </div>
            </div>

            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                padding: "6px 42px 24px",
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: "#ffffff",
                  borderRadius: "34px",
                  display: "flex",
                  height: "472px",
                  justifyContent: "center",
                  position: "relative",
                  width: "472px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Unique TourniBase admission QR code"
                  height={440}
                  src={qrCodeDataUrl}
                  width={440}
                />
                <div
                  style={{
                    alignItems: "center",
                    backgroundColor: "#ffffff",
                    borderRadius: "18px",
                    boxShadow: "0 3px 12px rgba(7, 16, 29, 0.16)",
                    display: "flex",
                    height: "94px",
                    justifyContent: "center",
                    left: "189px",
                    padding: "8px",
                    position: "absolute",
                    top: "189px",
                    width: "94px",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    height={78}
                    src={iconUrl}
                    style={{ borderRadius: "16px" }}
                    width={78}
                  />
                </div>
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  marginTop: "20px",
                }}
              >
                Present this code at the gate
              </div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "17px",
                  marginTop: "6px",
                }}
              >
                Final validity and prior use are checked when scanned.
              </div>
            </div>

            <div
              style={{
                borderTop: "2px solid #22324a",
                display: "flex",
                flexDirection: "column",
                marginTop: "auto",
                padding: "24px 42px 30px",
              }}
            >
              <Detail label="Guest" value={pass.buyerName} />
              <Detail label="Order" value={pass.orderNumber} />
              <Detail label="Venue" value={pass.venueName} />
            </div>
          </div>
        </div>
      ),
      {
        height: 1200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Disposition": `${disposition}; filename="${filename}"`,
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
        width: 900,
      },
    );
  } catch (error) {
    console.error("[offline-pass] image generation failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return unavailableResponse(503);
  }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "space-between",
        marginTop: "8px",
      }}
    >
      <div
        style={{
          color: "#718198",
          fontSize: "17px",
          marginRight: "24px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#e7edf6",
          fontSize: "19px",
          fontWeight: 700,
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function unavailableResponse(status: number) {
  return new Response("Offline pass unavailable.", {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
    status,
  });
}
