import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeKePhone } from "@/lib/format";

const SendParentSmsInput = z.object({
  schoolId: z.string().uuid("School ID must be a valid UUID"),
  guardianIds: z.array(z.string().uuid("Guardian ID must be a valid UUID")).min(1),
  message: z
    .string()
    .trim()
    .min(1, "Enter a message.")
    .max(480, "SMS cannot exceed 480 characters."),
});

type SozuriResponse = {
  success?: boolean;
  status?: string;
  message?: string;
  error?: string;
};

type SmsRecipient = {
  guardianId: string;
  phone: string;
};

export const sendParentSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SendParentSmsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: adminRole, error: roleError } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("school_id", data.schoolId)
      .eq("is_active", true)
      .in("role", ["admin", "principal", "deputy"])
      .maybeSingle();

    if (roleError || !adminRole) {
      throw new Error("Only a school administrator, principal, or deputy can send parent SMS.");
    }

    const { data: guardians, error: guardianError } = await context.supabase
      .from("guardians")
      .select("id, phone, alt_phone")
      .eq("school_id", data.schoolId)
      .eq("is_archived", false)
      .in("id", data.guardianIds);

    if (guardianError)
      throw new Error(`Could not load parent phone numbers: ${guardianError.message}`);
    if (!guardians || guardians.length !== new Set(data.guardianIds).size) {
      throw new Error("One or more selected parents do not belong to this school.");
    }

    const recipients = guardians
      .map((guardian) => ({
        guardianId: guardian.id,
        phone: guardian.phone || guardian.alt_phone,
      }))
      .map((recipient) => ({
        guardianId: recipient.guardianId,
        phone: recipient.phone ? normalizeKePhone(recipient.phone) : "",
      }))
      .filter((recipient): recipient is SmsRecipient => Boolean(recipient.phone));
    if (recipients.length !== guardians.length) {
      throw new Error("Every selected parent must have a phone number.");
    }

    const apiKey = process.env["SOZURI_API_KEY"];
    const project = process.env["SOZURI_PROJECT"];
    const from = process.env["SOZURI_FROM"] ?? "SHANSCOTT TECHNOLOGIES";
    if (!apiKey || !project) {
      throw new Error(
        "Sozuri is not configured. Set SOZURI_API_KEY and SOZURI_PROJECT on the server.",
      );
    }

    const batchId = crypto.randomUUID();
    const results = await Promise.all(
      recipients.map(async ({ guardianId, phone }) => {
        let response: Response;
        try {
          response = await fetch("https://sozuri.net/api/v1/messaging", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              project,
              apiKey,
              from,
              to: phone,
              message: data.message,
              channel: "sms",
              type: process.env["SOZURI_MESSAGE_TYPE"] ?? "promotional",
            }),
          });
        } catch (error) {
          return {
            guardianId,
            phone,
            ok: false,
            error:
              error instanceof Error
                ? `Sozuri connection failed: ${error.message}`
                : "Sozuri connection failed.",
          };
        }
        const providerStatus = response.status;
        const responseText = await response.text();
        let payload: SozuriResponse = {};
        try {
          payload = JSON.parse(responseText) as SozuriResponse;
        } catch {
          // Some provider errors are returned as plain text.
        }
        const providerResponse = Object.keys(payload).length ? payload : responseText;
        return {
          guardianId,
          phone,
          ok: response.ok && payload.success !== false && payload.status !== "failed",
          providerStatus,
          providerResponse,
          error:
            payload.error ||
            (payload.success === false ? payload.message : undefined) ||
            responseText ||
            `HTTP ${response.status}`,
        };
      }),
    );

    const { error: logError } = await context.supabase.from("sms_message_logs").insert(
      results.map((result) => ({
        school_id: data.schoolId,
        sender_id: context.userId,
        guardian_id: result.guardianId,
        batch_id: batchId,
        recipient_phone: result.phone,
        message: data.message,
        status: result.ok ? "sent" : "failed",
        provider: "sozuri",
        provider_status: result.providerStatus ?? null,
        provider_response: result.providerResponse ?? null,
        error_message: result.ok ? null : result.error,
      })),
    );
    if (logError) console.error("Parent SMS log could not be saved:", logError);

    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      throw new Error(
        failed.length === results.length
          ? `Sozuri rejected the SMS request: ${failed[0].error}`
          : `${failed.length} of ${results.length} parent SMS messages failed to send.`,
      );
    }

    return { sent: results.length };
  });
