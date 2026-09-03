import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { CbeGrade } from "@/lib/cbe";

export type AppRole =
  | "super_admin"
  | "admin"
  | "exam_officer"
  | "principal"
  | "deputy"
  | "teacher"
  | "class_teacher"
  | "parent"
  | "student";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Platform Super Administrator",
  admin: "School Administrator",
  exam_officer: "Exam Officer",
  principal: "Headteacher / Principal",
  deputy: "Deputy Headteacher",
  teacher: "Subject Teacher",
  class_teacher: "Class Teacher",
  parent: "Parent / Guardian",
  student: "Student",
};

export interface SchoolContextValue {
  loading: boolean;
  userId: string | null;
  fullName: string;
  avatarUrl: string | null;
  email: string | null;
  schoolId: string | null;
  school: SchoolRow | null;
  roles: AppRole[];
  activeRole: AppRole | null;
  setActiveRole: (r: AppRole) => void;
  grades: CbeGrade[];
  academicYearId: string | null;
  setAcademicYearId: (id: string) => void;
  years: { id: string; name: string; is_current: boolean }[];
  terms: {
    id: string;
    name: string;
    term_number: number;
    academic_year_id: string;
    is_current: boolean;
  }[];
  termId: string | null;
  setTermId: (id: string) => void;
  can: (...roles: AppRole[]) => boolean;
  refetch: () => void;
}

export interface SchoolRow {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  motto: string | null;
  county: string | null;
  onboarding_completed: boolean;
}

const Ctx = createContext<SchoolContextValue | null>(null);

const ROLE_STORAGE_KEY = "shanscott.activeRole";

export function SchoolProvider({ children, user }: { children: ReactNode; user: User }) {
  const [activeRoleState, setActiveRoleState] = useState<AppRole | null>(() => {
    if (typeof window === "undefined") return null;
    return (window.localStorage.getItem(ROLE_STORAGE_KEY) as AppRole | null) ?? null;
  });
  const [yearOverride, setAcademicYearId] = useState<string | null>(null);
  const [termOverride, setTermId] = useState<string | null>(null);

  const setActiveRole = (role: AppRole) => {
    setActiveRoleState(role);
    if (typeof window !== "undefined") window.localStorage.setItem(ROLE_STORAGE_KEY, role);
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["school-context", user.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [{ data: profile }, { data: roleRows }, { data: memberships }, { data: staff }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, email, avatar_url")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("user_roles")
            .select("role, school_id")
            .eq("user_id", user.id)
            .eq("is_active", true),
          supabase
            .from("user_school_memberships")
            .select("school_id")
            .eq("user_id", user.id)
            .eq("is_active", true),
          supabase
            .from("staff")
            .select("id")
            .eq("user_id", user.id)
            .eq("is_archived", false)
            .eq("status", "active")
            .eq("account_status", "active")
            .maybeSingle(),
        ]);

      const schoolId = memberships?.[0]?.school_id ?? null;
      const staffRoles = ["admin", "exam_officer", "teacher", "class_teacher"];
      const visibleRoleRows = staff
        ? (roleRows ?? []).filter((row) => staffRoles.includes(row.role))
        : (roleRows ?? []);
      let school: SchoolRow | null = null;
      let grades: CbeGrade[] = [];
      let years: SchoolContextValue["years"] = [];
      let terms: SchoolContextValue["terms"] = [];

      if (schoolId) {
        const [{ data: s }, { data: offerings }, { data: yr }, { data: tm }] = await Promise.all([
          supabase
            .from("schools")
            .select("id, name, short_name, logo_url, motto, county, onboarding_completed")
            .eq("id", schoolId)
            .maybeSingle(),
          supabase
            .from("school_grade_offerings")
            .select("grade")
            .eq("school_id", schoolId)
            .eq("is_active", true),
          supabase
            .from("academic_years")
            .select("id, name, is_current")
            .eq("school_id", schoolId)
            .order("name", { ascending: false }),
          supabase
            .from("terms")
            .select("id, name, term_number, academic_year_id, is_current")
            .eq("school_id", schoolId)
            .order("term_number"),
        ]);
        school = (s as SchoolRow | null) ?? null;
        grades = (offerings ?? []).map((o) => o.grade as CbeGrade);
        years = yr ?? [];
        terms = tm ?? [];
      }

      return {
        userId: user.id,
        fullName: profile?.full_name || user.email || "User",
        avatarUrl: profile?.avatar_url ?? null,
        email: profile?.email ?? user.email ?? null,
        schoolId,
        school,
        roles: visibleRoleRows.map((r) => r.role as AppRole),
        grades,
        years,
        terms,
      };
    },
  });

  const value = useMemo<SchoolContextValue>(() => {
    const roles = data?.roles ?? [];
    const years = data?.years ?? [];
    const terms = data?.terms ?? [];
    const activeRole =
      activeRoleState && roles.includes(activeRoleState) ? activeRoleState : (roles[0] ?? null);
    const academicYearId =
      yearOverride ?? years.find((y) => y.is_current)?.id ?? years[0]?.id ?? null;
    const yearTerms = terms.filter((t) => t.academic_year_id === academicYearId);
    const termId =
      termOverride ?? yearTerms.find((t) => t.is_current)?.id ?? yearTerms[0]?.id ?? null;

    return {
      loading: isLoading,
      userId: data?.userId ?? null,
      fullName: data?.fullName ?? "",
      avatarUrl: data?.avatarUrl ?? null,
      email: data?.email ?? null,
      schoolId: data?.schoolId ?? null,
      school: data?.school ?? null,
      roles,
      activeRole,
      setActiveRole,
      grades: data?.grades ?? [],
      academicYearId,
      setAcademicYearId,
      years,
      terms,
      termId,
      setTermId,
      can: (...allowed: AppRole[]) => roles.some((r) => allowed.includes(r)),
      refetch: () => void refetch(),
    };
  }, [data, isLoading, activeRoleState, yearOverride, termOverride, refetch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSchool(): SchoolContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSchool must be used inside SchoolProvider");
  return ctx;
}
