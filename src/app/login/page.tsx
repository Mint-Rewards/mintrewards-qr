import { Suspense } from "react";
import { Leaf } from "lucide-react";
import { LoginForm } from "@/components/layout/login-form";

export const metadata = { title: "Sign in · MintRewards QR" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Leaf className="text-primary size-7" />
          <h1 className="text-xl font-semibold tracking-tight">MintRewards QR</h1>
          <p className="text-muted-foreground text-sm">
            Internal onboarding attribution. Sign in to continue.
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
