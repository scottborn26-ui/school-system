import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  BadgeCheck,
  BookOpen,
  Coins,
  GraduationCap,
  Loader2,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABELS, useSchool, type AppRole } from "@/hooks/use-school";

export const Route = createFileRoute("/_authenticated/select-role")({
  head: () => ({
    meta: [
      { title: "Choose your role · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Select the role you want to work in for this session on SHANSCOTT CBE School Management.",
      },
      { property: "og:title", content: "Choose your role · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Multi-role staff choose their working role at sign-in.",
      },
    ],
  }),
  component: SelectRolePage,
});

const ROLE_ICONS: Record<AppRole, typeof BadgeCheck> = {
  super_admin: ShieldCheck,
  admin: ShieldCheck,
  exam_officer: ShieldCheck,
  principal: UserCog,
  deputy: UserCog,
  teacher: BookOpen,
  class_teacher: Users,
  parent: Users,
  student: GraduationCap,
};

const ROLE_BLURB: Record<AppRole, string> = {
  super_admin: "Platform-wide administration across all schools.",
  admin: "School administration, curriculum and academic oversight.",
  exam_officer: "School-wide assessment administration and marks-entry oversight.",
  principal: "Full school oversight, approvals, publishing and settings.",
  deputy: "Approvals, timetabling and academic administration.",
  teacher: "Enter and submit marks for your allocated learning areas.",
  class_teacher: "Class register, marks and class-teacher comments.",
  parent: "View your learner's reports, fees and attendance.",
  student: "View your own reports and timetable.",
};

function SelectRolePage() {
  const school = useSchool();
  const router = useRouter();

  const single = school.roles.length === 1 ? school.roles[0] : null;
  const requestedRole =
    typeof window !== "undefined"
      ? (window.localStorage.getItem("shanscott.activeRole") as AppRole | null)
      : null;

  useEffect(() => {
    if (school.loading) return;
    if (school.roles.length === 0) {
      void router.navigate({ to: "/onboarding", replace: true });
      return;
    }
    if (requestedRole && school.roles.includes(requestedRole)) {
      school.setActiveRole(requestedRole);
      void router.navigate({ to: "/dashboard", replace: true });
      return;
    }
    if (single) {
      school.setActiveRole(single);
      void router.navigate({ to: "/dashboard", replace: true });
    }
  }, [school.loading, school.roles.length, single, requestedRole, router, school]);

  function choose(role: AppRole) {
    school.setActiveRole(role);
    void router.navigate({ to: "/dashboard", replace: true });
  }

  if (school.loading || single || school.roles.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose your role for this session
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {school.fullName} · {school.school?.name ?? "Your school"}. Permissions are always
            enforced on the server — switching roles changes only what you see.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {school.roles.map((role) => {
            const Icon = ROLE_ICONS[role];
            return (
              <Card key={role} className="transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <p className="font-medium">{ROLE_LABELS[role]}</p>
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground">{ROLE_BLURB[role]}</p>
                  <Button onClick={() => choose(role)} className="w-full">
                    Continue as {ROLE_LABELS[role]}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
