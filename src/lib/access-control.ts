import type { AppRole } from "@/hooks/use-school";

export const ALLOWED_CURRICULUM_ROLES: readonly AppRole[] = [
  "super_admin",
  "admin",
  "principal",
  "deputy",
];
