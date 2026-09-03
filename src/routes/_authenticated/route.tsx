import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SchoolProvider } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const user = data.user;
    const { data: staff } = await supabase
      .from("staff")
      .select("must_change_password, account_status, credentials_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (staff?.account_status === "disabled") throw redirect({ to: "/auth" });
    if (
      staff?.must_change_password &&
      staff.credentials_expires_at &&
      new Date(staff.credentials_expires_at) <= new Date()
    ) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (staff?.must_change_password) throw redirect({ to: "/set-password" });
    return { user };
  },
  component: AuthenticatedLayout,
  errorComponent: RouteError,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <SchoolProvider user={user}>
      <Outlet />
    </SchoolProvider>
  );
}

function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto mb-3 size-8 text-warning" />
        <h1 className="text-lg font-semibold">This page didn’t load</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-4" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
