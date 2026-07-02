import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminConfigurationIssues() {
  const issues: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (
    !process.env.SUPABASE_SECRET_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    issues.push("SUPABASE_SECRET_KEY");
  }

  return issues;
}

export function getSupabaseAdmin() {
  const issues = getSupabaseAdminConfigurationIssues();

  if (issues.length > 0) {
    throw new Error(
      `Missing server configuration: ${issues.join(", ")}.`,
    );
  }

  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY ??
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
  }

  return adminClient;
}
