import "server-only";

import { requireDirector } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function getOwnedOrganizationForStripeConnect(
  organizationId: number,
) {
  const director = await requireDirector();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .eq("owner_user_id", director.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? {
        director,
        organization: {
          id: data.id as number,
          name: data.name as string,
        },
      }
    : null;
}

export function parseConnectReturnEvent(value: FormDataEntryValue | null) {
  return typeof value === "string" && /^\d+$/.test(value)
    ? value
    : null;
}

export function settingsUrl({
  event,
  origin,
  result,
}: {
  event: string | null;
  origin: string;
  result?: string;
}) {
  const url = new URL("/dashboard/settings", origin);

  if (event) {
    url.searchParams.set("event", event);
  }

  if (result) {
    url.searchParams.set("payments", result);
  }

  return url;
}
