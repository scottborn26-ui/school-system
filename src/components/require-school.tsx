import { Link } from "@tanstack/react-router";
import { Loader2, School, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { useSchool, type AppRole } from "@/hooks/use-school";

/**
 * Wraps a page in the app shell and blocks rendering until an active school
 * membership (and, optionally, an allowed role) is confirmed. Server-side RLS is
 * the real boundary; this only avoids showing an unusable screen.
 */
export function RequireSchool({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: AppRole[];
}) {
  const school = useSchool();

  if (school.loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!school.schoolId) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-md text-center">
          <School className="mx-auto mb-3 size-8 text-primary" />
          <h1 className="text-lg font-semibold">No school linked to your account yet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete the school onboarding wizard to set up your school, academic year and grades.
          </p>
          <Button asChild className="mt-4">
            <Link to="/onboarding">Start onboarding</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (roles && !school.can(...roles)) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-16 text-center">
          <ShieldAlert className="mx-auto mb-3 size-8 text-destructive" />
          <h1 className="text-lg font-semibold">You are not authorised to access this page</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your current roles do not include access to this module. Ask your principal to grant it.
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
