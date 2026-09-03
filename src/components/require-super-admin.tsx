import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { useSchool } from "@/hooks/use-school";

export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const school = useSchool();

  if (school.loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!school.can("super_admin")) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-16 text-center">
          <ShieldAlert className="mx-auto mb-3 size-8 text-destructive" />
          <h1 className="text-lg font-semibold">Platform access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This area is restricted to platform administrators.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
