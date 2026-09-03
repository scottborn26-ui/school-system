export type DetailEntityType = "learner" | "staff" | "allocation";

export function getPersonDisplayName(person: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
}): string {
  if (person.full_name?.trim()) {
    return person.full_name.trim();
  }

  const name = [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "Unnamed person";
}

export function canViewFinancePanel(roles: string[]): boolean {
  const allowed = new Set(["principal", "deputy", "super_admin", "admin"]);
  return roles.some((role) => allowed.has(role));
}

export function canViewSensitiveStaffDocuments(roles: string[]): boolean {
  const allowed = new Set(["principal", "deputy", "super_admin", "admin"]);
  return roles.some((role) => allowed.has(role));
}
