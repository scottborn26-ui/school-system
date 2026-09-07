import type { AppRole } from "@/hooks/use-school";

export const STAFF_ACCOUNT_ROLES: readonly { value: AppRole; label: string; isTeaching: boolean }[] = [
  { value: "teacher", label: "Teacher", isTeaching: true },
  { value: "class_teacher", label: "Class teacher", isTeaching: true },
  { value: "exam_officer", label: "Exam officer", isTeaching: false },
  { value: "accountant", label: "Accountant", isTeaching: false },
  { value: "security", label: "Security / gate staff", isTeaching: false },
];

export function isTeachingStaffRole(role: AppRole | string | null | undefined) {
  return STAFF_ACCOUNT_ROLES.some((item) => item.value === role && item.isTeaching);
}
