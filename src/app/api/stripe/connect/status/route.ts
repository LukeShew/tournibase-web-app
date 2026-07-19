import { NextResponse } from "next/server";
import {
  getStripeConnectStatus,
  getOrganizationStripeAccount,
  synchronizeOrganizationStripeAccount,
} from "@/lib/stripe-connect";
import { getOwnedOrganizationForStripeConnect } from "@/lib/stripe-connect-director";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let organizationId: number;

  try {
    const body = (await request.json()) as { organizationId?: unknown };
    organizationId = Number(body.organizationId);
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 },
    );
  }

  if (!Number.isSafeInteger(organizationId) || organizationId < 1) {
    return NextResponse.json(
      { error: "Invalid organization." },
      { status: 400 },
    );
  }

  try {
    const ownership =
      await getOwnedOrganizationForStripeConnect(organizationId);

    if (!ownership) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const account = await getOrganizationStripeAccount(organizationId);

    if (!account) {
      return NextResponse.json(
        { status: "not_connected" },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const synchronizedAccount =
      await synchronizeOrganizationStripeAccount(account);

    return NextResponse.json(
      {
        status: getStripeConnectStatus(synchronizedAccount),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[stripe-connect-status] synchronization failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      organizationId,
    });

    return NextResponse.json(
      { error: "Stripe status could not be refreshed." },
      { status: 500 },
    );
  }
}
