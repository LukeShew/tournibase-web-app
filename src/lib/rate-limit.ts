import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function getRequestIp() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

export function hashRateLimitValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket_key: hashRateLimitValue(key),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("[rate-limit] check failed", { code: error.code });
    return true;
  }

  return data === true;
}
