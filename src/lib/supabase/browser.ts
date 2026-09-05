"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Anon key only -- it ships in the JS bundle by design, and RLS is what
 * protects the data behind it.
 *
 * Reads NEXT_PUBLIC_* directly rather than importing `@/lib/env`, which is server-only.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
