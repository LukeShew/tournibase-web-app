import { NextResponse } from "next/server";
import {
  getOwnedOrganizationForStripeConnect,
  parseConnectReturnEvent,
  settingsUrl,
} from "@/lib/stripe-connect-director";
import {
  getOrganizationStripeAccount,
  synchronizeOrganizationStripeAccount,
} from "@/lib/stripe-connect";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return refreshConnect({
    event: parseConnectReturnEvent(url.searchParams.get("event")),
    organizationId: Number(url.searchParams.get("organization")),
    request,
    returned: url.searchParams.get("returned") === "1",
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  return refreshConnect({
    event: parseConnectReturnEvent(formData.get("event")),
    organizationId: Number(formData.get("organizationId")),
    request,
    returned: false,
  });
}

async function refreshConnect({
  event,
  organizationId,
  request,
  returned,
}: {
  event: string | null;
  organizationId: number;
  request: Request;
  returned: boolean;
}) {
  const origin = new URL(request.url).origin;
  const destination = settingsUrl({ event, origin });

  if (!Number.isSafeInteger(organizationId) || organizationId < 1) {
    destination.searchParams.set("payments", "invalid_organization");
    return NextResponse.redirect(destination, 303);
  }

  try {
    const ownership =
      await getOwnedOrganizationForStripeConnect(organizationId);

    if (!ownership) {
      destination.searchParams.set("payments", "not_authorized");
      return NextResponse.redirect(destination, 303);
    }

    const account = await getOrganizationStripeAccount(organizationId);

    if (!account) {
      destination.searchParams.set("payments", "not_connected");
      return NextResponse.redirect(destination, 303);
    }

    await synchronizeOrganizationStripeAccount(account);
    destination.searchParams.set(
      "payments",
      returned ? "onboarding_returned" : "synchronized",
    );
  } catch (error) {
    console.error("[stripe-connect-refresh] synchronization failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      organizationId,
    });
    destination.searchParams.set("payments", "sync_error");
  }

  return NextResponse.redirect(destination, 303);
}
