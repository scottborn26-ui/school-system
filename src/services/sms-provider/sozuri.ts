import { decryptCredential, encryptCredential } from "@/lib/credential-encryption";

// Supabase types are generated separately from the migration in this project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

type StoredSettings = {
  id: string;
  school_id: string;
  project_id: string;
  api_key_encrypted: string;
  endpoint_url: string;
  last_balance: number | string | null;
  last_synced_at: string | null;
};

export type SmsSettings = Omit<StoredSettings, "api_key_encrypted"> & {
  apiKeyLastFour: string;
};

export class SozuriBalanceUnavailableError extends Error {
  constructor() {
    super("Balance unavailable");
    this.name = "SozuriBalanceUnavailableError";
  }
}

export async function loadSettings(db: Db, schoolId: string): Promise<StoredSettings | null> {
  const { data, error } = await db
    .from("school_sms_settings")
    .select(
      "id, school_id, project_id, api_key_encrypted, endpoint_url, last_balance, last_synced_at",
    )
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StoredSettings | null) ?? null;
}

export function presentSettings(settings: StoredSettings | null): SmsSettings | null {
  if (!settings) return null;
  const apiKey = decryptCredential(settings.api_key_encrypted);
  return {
    id: settings.id,
    school_id: settings.school_id,
    project_id: settings.project_id,
    endpoint_url: settings.endpoint_url,
    last_balance: settings.last_balance,
    last_synced_at: settings.last_synced_at,
    apiKeyLastFour: apiKey.slice(-4),
  };
}

export async function saveCredentials(
  db: Db,
  schoolId: string,
  userId: string,
  input: { projectId: string; apiKey?: string; endpointUrl: string },
): Promise<SmsSettings> {
  const existing = await loadSettings(db, schoolId);
  const apiKey = input.apiKey?.trim()
    ? encryptCredential(input.apiKey.trim())
    : existing?.api_key_encrypted;
  if (!apiKey) throw new Error("Enter a Sozuri Secret API Key.");

  const { data, error } = await db
    .from("school_sms_settings")
    .upsert(
      {
        school_id: schoolId,
        provider: "sozuri",
        project_id: input.projectId.trim(),
        api_key_encrypted: apiKey,
        endpoint_url: input.endpointUrl.trim(),
        created_by: userId,
      },
      { onConflict: "school_id" },
    )
    .select(
      "id, school_id, project_id, api_key_encrypted, endpoint_url, last_balance, last_synced_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return presentSettings(data as StoredSettings)!;
}

export async function getBalance(schoolId: string, settings: StoredSettings) {
  void schoolId;
  void settings;
  // Sozuri's public docs currently document messaging and payment collection
  // endpoints, but not a project-credit balance endpoint. Never guess a route.
  throw new SozuriBalanceUnavailableError();
}

export async function initiateTopUp(_schoolId: string, settings: StoredSettings) {
  return {
    kind: "manual" as const,
    project: settings.project_id,
    paymentMethod: "M-Pesa",
    paybill: "4029323",
    accountNumber: "shnscott technologies",
  };
}
