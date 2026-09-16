import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeKePhone } from "@/lib/format";

// Supabase types are generated separately from the payment receipt migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

type Payment = {
  id: string;
  school_id: string;
  learner_id: string;
  receipt_number: string;
  amount: number | string;
  method: string;
  reference: string | null;
  paid_at: string;
};

type Guardian = { id: string; full_name: string; phone: string | null; alt_phone: string | null };
type School = { name: string; phone: string | null };
type Learner = { first_name: string; middle_name: string | null; last_name: string };

type SozuriResponse = { message?: string; error?: string; success?: boolean; status?: string };

function formatReceiptMessage(school: School, learner: Learner, payment: Payment): string {
  const learnerName = [learner.first_name, learner.middle_name, learner.last_name]
    .filter(Boolean)
    .join(" ");
  const reference = payment.reference ? ` Ref: ${payment.reference}.` : "";
  return `${school.name}: Fee payment received for ${learnerName}. Receipt ${payment.receipt_number}. Amount: KES ${Number(payment.amount).toLocaleString()}.${reference} Thank you.`;
}

async function sendReceiptSms(db: Db, payment: Payment, actorId: string) {
  const [{ data: school }, { data: learner }, { data: links }] = await Promise.all([
    db.from("schools").select("name, phone").eq("id", payment.school_id).maybeSingle(),
    db
      .from("learners")
      .select("first_name, middle_name, last_name")
      .eq("id", payment.learner_id)
      .maybeSingle(),
    db
      .from("learner_guardians")
      .select("guardian_id")
      .eq("school_id", payment.school_id)
      .eq("learner_id", payment.learner_id),
  ]);
  if (!school || !learner) throw new Error("Payment receipt details could not be loaded.");

  const guardianIds = [
    ...new Set((links ?? []).map((link: { guardian_id: string }) => link.guardian_id)),
  ];
  if (!guardianIds.length) return { sent: 0, skipped: 0 };
  const { data: guardians, error: guardianError } = await db
    .from("guardians")
    .select("id, full_name, phone, alt_phone")
    .eq("school_id", payment.school_id)
    .in("id", guardianIds);
  if (guardianError) throw new Error(guardianError.message);

  const recipients = (guardians ?? [])
    .map((guardian: Guardian) => ({
      guardian,
      phone: normalizeKePhone(guardian.phone || guardian.alt_phone || ""),
    }))
    .filter((item: { phone: string }) => Boolean(item.phone));
  if (!recipients.length) return { sent: 0, skipped: guardianIds.length };

  const apiKey = process.env["SOZURI_API_KEY"];
  const project = process.env["SOZURI_PROJECT"];
  const from = process.env["SOZURI_FROM"] ?? "SHANSCOTT TECHNOLOGIES";
  if (!apiKey || !project) throw new Error("SMS service is not configured.");

  const message = formatReceiptMessage(school as School, learner as Learner, payment);
  const batchId = crypto.randomUUID();
  const results = await Promise.all(
    recipients.map(async ({ guardian, phone }: { guardian: Guardian; phone: string }) => {
      try {
        const response = await fetch("https://sozuri.net/api/v1/messaging", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            project,
            apiKey,
            from,
            to: phone,
            message,
            channel: "sms",
            type: "transactional",
          }),
        });
        const text = await response.text();
        let payload: SozuriResponse = {};
        try {
          payload = JSON.parse(text) as SozuriResponse;
        } catch {
          /* provider returned plain text */
        }
        const ok = response.ok && payload.success !== false && payload.status !== "failed";
        return {
          guardian,
          phone,
          ok,
          status: response.status,
          payload,
          error: ok ? null : payload.error || payload.message || text,
        };
      } catch (error) {
        return {
          guardian,
          phone,
          ok: false,
          status: null,
          payload: {},
          error: error instanceof Error ? error.message : "SMS request failed",
        };
      }
    }),
  );

  await db.from("sms_message_logs").insert(
    results.map((result: (typeof results)[number]) => ({
      school_id: payment.school_id,
      sender_id: actorId,
      guardian_id: result.guardian.id,
      batch_id: batchId,
      recipient_phone: result.phone,
      message,
      status: result.ok ? "sent" : "failed",
      provider: "sozuri",
      provider_status: result.status,
      provider_response: result.payload,
      error_message: result.error,
    })),
  );

  const failed = results.filter((result: (typeof results)[number]) => !result.ok);
  return {
    sent: results.length - failed.length,
    skipped: guardianIds.length - results.length,
    failed: failed.length,
  };
}

export const sendPaymentReceiptSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ paymentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { data: payment, error: paymentError } = await db
      .from("payments")
      .select("id, school_id, learner_id, receipt_number, amount, method, reference, paid_at")
      .eq("id", data.paymentId)
      .single();
    if (paymentError || !payment) throw new Error("Payment receipt could not be found.");

    const { data: role } = await db
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("school_id", payment.school_id)
      .eq("is_active", true)
      .in("role", ["admin", "accountant", "principal", "deputy"])
      .maybeSingle();
    if (!role) throw new Error("You are not authorised to send payment receipts.");

    const { data: claim, error: claimError } = await db
      .from("payment_receipt_sms")
      .upsert(
        { school_id: payment.school_id, payment_id: payment.id, status: "pending" },
        { onConflict: "payment_id", ignoreDuplicates: true },
      )
      .select("id, status")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claim) {
      const { data: existingClaim, error: existingError } = await db
        .from("payment_receipt_sms")
        .select("status")
        .eq("payment_id", payment.id)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existingClaim?.status === "sent") return { sent: 0, skipped: 0, alreadySent: true };
    }
    if (claim?.status === "sent") return { sent: 0, skipped: 0, alreadySent: true };

    try {
      const result = await sendReceiptSms(db, payment as Payment, context.userId);
      await db
        .from("payment_receipt_sms")
        .update({
          status: result.sent > 0 ? "sent" : "failed",
          recipient_count: result.sent,
          sent_at: result.sent > 0 ? new Date().toISOString() : null,
          error_message: result.sent > 0 ? null : "No parent phone number was available.",
        })
        .eq("payment_id", payment.id);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Receipt SMS failed.";
      await db
        .from("payment_receipt_sms")
        .update({ status: "failed", error_message: message })
        .eq("payment_id", payment.id);
      throw new Error(message);
    }
  });
