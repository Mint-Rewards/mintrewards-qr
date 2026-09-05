import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * `server-only` above makes importing this from a client component a build-time error,
 * which is what keeps the service role key out of the browser bundle.
 *
 * Legitimate uses are narrow:
 *   1. the public redirect route, which must write qr_scan_events while unauthenticated
 *      (there is deliberately no client insert policy on that table), and
 *   2. standee generation, which writes to a private storage bucket.
 *
 * Everything an admin does in the UI should go through `@/lib/supabase/server` instead,
 * so RLS still applies and actions are attributable to a real user.
 */
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
