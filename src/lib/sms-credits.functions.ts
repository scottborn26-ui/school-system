import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getBalance,
  initiateTopUp,
  loadSettings,
  presentSettings,
  saveCredentials,
  SozuriBalanceUnavailableError,
} from "@/services/sms-provider/sozuri";

// Supabase types are generated separately from the migration in this project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };
const schoolId = z.string().uuid();
const roles = ["admin", "accountant", "principal", "deputy"];

async function requireSuperAdmin(db: Db, userId: string) {
  const [{ data: role }, { data: platformAdmin }] = await Promise.all([
    db
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .eq("is_active", true)
      .maybeSingle(),
    db
      .from("platform_admins")
      .select("id")
      .eq("id", userId)
      .in("role", ["super_admin", "support_admin"])
      .maybeSingle(),
  ]);
  if (!role && !platformAdmin) throw new Error("Platform administrator access is required.");
}

async function requireSmsManager(db: Db, userId: string, id: string) {
  const { data: superAdmin } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .eq("is_active", true)
    .maybeSingle();
  if (superAdmin) return;

  const { data } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("school_id", id)
    .eq("is_active", true)
    .in("role", roles)
    .maybeSingle();
  if (!data) throw new Error("You are not authorised to manage SMS credits.");
}

async function recordAudit(
  db: Db,
  schoolIdValue: string,
  actorId: string,
  action: string,
  reason: string,
) {
  await db.from("audit_logs").insert({
    school_id: schoolIdValue,
    actor_id: actorId,
    action,
    entity: "school_sms_settings",
    reason,
  });
}

export type SmsCreditBalance = {
  school_id: string;
  balance: number | string;
  business_number: string;
  account_number: string;
  updated_at: string;
};

export const getSmsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ schoolId }).parse(input))
  .handler(async ({ data, context }) => {
    const settings = await loadSettings(context.supabase as unknown as Db, data.schoolId);
    return presentSettings(settings);
  });

export const listPlatformSmsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    await requireSuperAdmin(db, context.userId);
    const { data, error } = await db
      .from("school_sms_settings")
      .select(
        "id, school_id, project_id, api_key_encrypted, endpoint_url, last_balance, last_synced_at",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: unknown) =>
      presentSettings(row as Parameters<typeof presentSettings>[0]),
    );
  });

export const listPlatformSmsBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    await requireSuperAdmin(db, context.userId);
    const { data, error } = await db
      .from("sms_credit_balances")
      .select("school_id, balance, business_number, account_number, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SmsCreditBalance[];
  });

export const setPlatformSmsBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        schoolId,
        balance: z.number().min(0).max(1_000_000_000),
        businessNumber: z.string().trim().min(1).max(100),
        accountNumber: z.string().trim().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    await requireSuperAdmin(db, context.userId);
    const { data: balance, error } = await db
      .from("sms_credit_balances")
      .upsert(
        {
          school_id: data.schoolId,
          balance: data.balance,
          business_number: data.businessNumber,
          account_number: data.accountNumber,
          updated_by: context.userId,
        },
        { onConflict: "school_id" },
      )
      .select("school_id, balance, business_number, account_number, updated_at")
      .single();
    if (error) throw new Error(error.message);
    await recordAudit(
      db,
      data.schoolId,
      context.userId,
      "update",
      `SMS balance manually set to ${data.balance} credits`,
    );
    return balance as SmsCreditBalance;
  });

export const saveSmsCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        schoolId,
        projectId: z.string().trim().min(1).max(200),
        apiKey: z.string().max(500).optional(),
        endpointUrl: z.string().url().default("https://sozuri.net/api/v1/messaging"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    await requireSuperAdmin(db, context.userId);
    const settings = await saveCredentials(db, data.schoolId, context.userId, data);
    await recordAudit(
      db,
      data.schoolId,
      context.userId,
      "update",
      "SMS provider credentials changed",
    );
    return settings;
  });

export const refreshSmsBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ schoolId }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    await requireSmsManager(db, context.userId, data.schoolId);
    const settings = await loadSettings(db, data.schoolId);
    const { data: manualBalance } = await db
      .from("sms_credit_balances")
      .select("school_id, balance, business_number, account_number, updated_at")
      .eq("school_id", data.schoolId)
      .maybeSingle();
    if (!settings)
      return {
        settings: null,
        manualBalance: manualBalance as SmsCreditBalance | null,
        error: "SMS credits have not been configured for this school yet.",
      };

    if (settings.last_synced_at && Date.now() - Date.parse(settings.last_synced_at) < 30_000) {
      return {
        settings: presentSettings(settings),
        manualBalance: manualBalance as SmsCreditBalance | null,
        error: "Balance refresh is limited to once every 30 seconds.",
      };
    }

    try {
      const balance = await getBalance(data.schoolId, settings);
      const { data: updated, error } = await db
        .from("school_sms_settings")
        .update({ last_balance: balance.balance, last_synced_at: balance.syncedAt })
        .eq("school_id", data.schoolId)
        .select(
          "id, school_id, project_id, api_key_encrypted, endpoint_url, last_balance, last_synced_at",
        )
        .single();
      if (error) throw new Error(error.message);
      return {
        settings: presentSettings(updated),
        manualBalance: manualBalance as SmsCreditBalance | null,
        error: null,
      };
    } catch (error) {
      if (error instanceof SozuriBalanceUnavailableError) {
        return {
          settings: presentSettings(settings),
          manualBalance: manualBalance as SmsCreditBalance | null,
          error: null,
        };
      }
      return {
        settings: presentSettings(settings),
        manualBalance: manualBalance as SmsCreditBalance | null,
        error: "We could not reach Sozuri. Check the saved credentials and try again.",
      };
    }
  });

export const topUpSmsCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        schoolId,
        amount: z.number().positive().max(1_000_000),
        phoneNumber: z.string().trim().min(7).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    await requireSmsManager(db, context.userId, data.schoolId);
    const settings = await loadSettings(db, data.schoolId);
    if (!settings) throw new Error("Connect your Sozuri account before topping up.");
    const result = await initiateTopUp(data.schoolId, settings);
    await recordAudit(
      db,
      data.schoolId,
      context.userId,
      "top_up",
      `SMS credit top-up requested for KES ${data.amount} from ${data.phoneNumber}`,
    );
    return result;
  });
