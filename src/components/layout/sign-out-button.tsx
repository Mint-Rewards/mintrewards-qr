"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createBrowserSupabase().auth.signOut();
    // refresh() clears cached server-rendered data so the next render sees no session.
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={signOut}
      disabled={busy}
      className="text-muted-foreground w-full justify-start"
    >
      <LogOut className="size-4" />
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
