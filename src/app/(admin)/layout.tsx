import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf, Plus } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Button } from "@/components/ui/button";

/**
 * Authenticated admin shell.
 *
 * Middleware already redirects unauthenticated users, but this re-checks server-side:
 * middleware can be bypassed by matcher misconfiguration, and a layout guard is the
 * boundary that actually protects the data.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="bg-background hidden w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Leaf className="text-primary size-5" />
          <span className="text-sm font-semibold tracking-tight">MintRewards QR</span>
        </div>

        <Sidebar />

        {/* Assignment creation is the single most frequent action, so it gets a
            permanent shortcut rather than living only inside the list page. */}
        <div className="mt-auto space-y-3 border-t p-3">
          <Button
            size="sm"
            className="w-full"
            render={<Link href="/assignments/new" />}
          >
            <Plus className="size-4" />
            New Assignment
          </Button>
          <div className="text-muted-foreground truncate px-1 text-xs" title={user.email ?? ""}>
            {user.email}
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
