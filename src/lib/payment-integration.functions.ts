import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ConfigInput = z.object({
  schoolId: z.string().uuid(),
  provider: z.enum(["mpesa", "bank_jenga", "bank_kcb", "bank"]),
  environment: z.enum(["sandbox", "live"]),
  consumerKey: z.string().max(500).optional(),
  consumerSecret: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
  apiSecret: z.string().max(500).optional(),
  shortcode: z.string().max(50).optional(),
  passkey: z.string().max(500).optional(),
  accountNumber: z.string().max(100).optional(),
  accountReferenceFormat: z.string().max(100).default("{admission_number}"),
});

// The generated Supabase types are refreshed from migrations separately; this
// narrow boundary keeps the new migration usable before that generated file changes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

async function encryptSecret(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const keyText = process.env["PAYMENT_ENCRYPTION_KEY"];
  if (!keyText) throw new Error("PAYMENT_ENCRYPTION_KEY is not configured on the server.");
  const { createCipheriv, createHash, randomBytes } = await import("node:crypto");
  const key = createHash("sha256").update(keyText).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

export const savePaymentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ConfigInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { data: allowed } = await db
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("school_id", data.schoolId)
      .eq("is_active", true)
      .in("role", ["admin", "accountant", "principal", "deputy"])
      .maybeSingle();
    if (!allowed) throw new Error("You are not authorised to manage payment settings.");

    const encrypted = {
      consumer_key: await encryptSecret(data.consumerKey),
      consumer_secret: await encryptSecret(data.consumerSecret),
      api_key: await encryptSecret(data.apiKey),
      api_secret: await encryptSecret(data.apiSecret),
      passkey: await encryptSecret(data.passkey),
    };
    const { data: existing } = await db
      .from("payment_provider_configs")
      .select("consumer_key, consumer_secret, api_key, api_secret, passkey")
      .eq("school_id", data.schoolId)
      .eq("provider", data.provider)
      .maybeSingle();
    for (const field of Object.keys(encrypted) as (keyof typeof encrypted)[]) {
      if (!encrypted[field] && existing?.[field]) encrypted[field] = existing[field];
    }
    const callbackBaseUrl = `https://api.shanscott.com/webhooks/${data.provider === "mpesa" ? "mpesa" : "bank"}/${data.schoolId}`;
    const { data: config, error } = await db
      .from("payment_provider_configs")
      .upsert(
        {
          school_id: data.schoolId,
          provider: data.provider,
          environment: data.environment,
          ...encrypted,
          shortcode: data.shortcode || null,
          account_number: data.accountNumber || null,
          callback_base_url: callbackBaseUrl,
          account_reference_format: data.accountReferenceFormat,
          is_active: false,
          last_error: null,
        },
        { onConflict: "school_id,provider" },
      )
      .select(
        "id, school_id, provider, environment, shortcode, account_number, callback_base_url, account_reference_format, is_active, last_error, last_verified_at, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);

    await db.from("payment_config_audit_logs").insert({
      school_id: data.schoolId,
      config_id: config.id,
      actor_id: context.userId,
      action: "updated",
      changed_fields: Object.keys(encrypted).filter(
        (field) => encrypted[field as keyof typeof encrypted],
      ),
    });
    return config;
  });

export const testPaymentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ schoolId: z.string().uuid(), configId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { data: config, error } = await db
      .from("payment_provider_configs")
      .select(
        "id, school_id, provider, environment, consumer_key, consumer_secret, api_key, api_secret, shortcode, passkey, is_active",
      )
      .eq("id", data.configId)
      .eq("school_id", data.schoolId)
      .single();
    if (error || !config) throw new Error("Payment configuration was not found.");
    if (config.environment !== "sandbox")
      throw new Error("Connection tests are only available in Sandbox mode.");
    const { data: allowed } = await db
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("school_id", data.schoolId)
      .eq("is_active", true)
      .in("role", ["admin", "accountant", "principal", "deputy"])
      .maybeSingle();
    if (!allowed) throw new Error("You are not authorised to test payment settings.");

    // A real Daraja STK request belongs behind the webhook/service boundary.
    // This check validates that the stored encrypted credential set is complete
    // without creating a financial transaction.
    const complete =
      config.provider === "mpesa"
        ? config.consumer_key && config.consumer_secret && config.shortcode && config.passkey
        : config.api_key && config.api_secret && config.account_number;
    if (!complete) throw new Error("Required credentials are missing.");

    const { error: updateError } = await db
      .from("payment_provider_configs")
      .update({ is_active: true, last_verified_at: new Date().toISOString(), last_error: null })
      .eq("id", data.configId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
