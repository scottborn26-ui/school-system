import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeKePhone } from "@/lib/format";
import {
  buildParentNotice,
  renderParentTemplate,
} from "@/lib/parent-sms-template";

const SendParentSmsInput = z.object({
  schoolId: z.string().uuid("School ID must be a valid UUID"),
  guardianIds: z.array(z.string().uuid("Guardian ID must be a valid UUID")).min(1),
  category: z
    .enum(["academic_report", "fee_balance", "general_update", "attendance_alert"])
    .default("general_update"),
  eventDate: z.string().trim().max(40).optional(),
  eventVenue: z.string().trim().max(120).optional(),
  message: z
    .string()
    .trim()
    .min(1, "Enter a message.")
    .max(480, "SMS cannot exceed 480 characters."),
  renderedMessages: z.record(z.string(), z.object({ body: z.string().min(1).max(480), snapshot: z.record(z.string(), z.unknown()).optional() })).optional(),
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
    const db = context.supabase as unknown as { from: (table: string) => any };
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

    const [
      { data: school, error: schoolError },
      { data: guardians, error: guardianError },
      { data: settings },
      { data: templates },
    ] =
      await Promise.all([
        context.supabase
          .from("schools")
          .select("name, phone, email")
          .eq("id", data.schoolId)
          .maybeSingle(),
        context.supabase
          .from("guardians")
          .select("id, full_name, phone, alt_phone")
          .eq("school_id", data.schoolId)
          .eq("is_archived", false)
          .in("id", data.guardianIds),
        db.from("message_settings").select("*").eq("school_id", data.schoolId).maybeSingle(),
        db
          .from("message_templates")
          .select("body_template, channel")
          .eq("school_id", data.schoolId)
          .eq("category", data.category)
          .eq("is_active", true)
          .in("channel", ["sms", "both"])
          .limit(1),
      ]);

    if (schoolError || !school) {
      throw new Error(`Could not load school contact details: ${schoolError?.message ?? "School not found."}`);
    }

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

    const guardianIds = guardians.map((guardian) => guardian.id);
    const { data: guardianLinks, error: linkError } = await context.supabase
      .from("learner_guardians")
      .select("guardian_id, learner_id")
      .eq("school_id", data.schoolId)
      .in("guardian_id", guardianIds);
    if (linkError) throw new Error(`Could not load parent learner details: ${linkError.message}`);

    const learnerIds = [...new Set((guardianLinks ?? []).map((link) => link.learner_id))];
    const { data: learners, error: learnerError } = learnerIds.length
      ? await context.supabase
          .from("learners")
          .select("id, first_name, middle_name, last_name, admission_number, current_grade, current_stream_id")
          .eq("school_id", data.schoolId)
          .in("id", learnerIds)
      : { data: [], error: null };
    if (learnerError) throw new Error(`Could not load student details: ${learnerError.message}`);

    const streamIds = [...new Set((learners ?? []).map((learner) => learner.current_stream_id).filter(Boolean))];
    const { data: streams, error: streamError } = streamIds.length
      ? await context.supabase
          .from("streams")
          .select("id, name")
          .eq("school_id", data.schoolId)
          .in("id", streamIds)
      : { data: [], error: null };
    if (streamError) throw new Error(`Could not load class details: ${streamError.message}`);

    const [{ data: reportCards, error: reportError }, { data: invoices, error: invoiceError }, { data: payments, error: paymentError }] = await Promise.all([
      data.category === "academic_report"
        ? context.supabase.from("report_cards").select("learner_id, term_id, total_points, mean_percentage, class_position, class_size, payload").eq("school_id", data.schoolId).eq("status", "published").in("learner_id", learnerIds)
        : Promise.resolve({ data: [], error: null }),
      data.category === "fee_balance"
        ? context.supabase.from("invoices").select("learner_id, total, due_date, term_id").eq("school_id", data.schoolId).eq("status", "issued").in("learner_id", learnerIds)
        : Promise.resolve({ data: [], error: null }),
      data.category === "fee_balance"
        ? context.supabase.from("payments").select("learner_id, amount, term_id, is_reversed").eq("school_id", data.schoolId).eq("is_reversed", false).in("learner_id", learnerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (reportError) throw new Error(`Could not load academic reports: ${reportError.message}`);
    if (invoiceError) throw new Error(`Could not load fee balances: ${invoiceError.message}`);
    if (paymentError) throw new Error(`Could not load fee payments: ${paymentError.message}`);

    const learnersByGuardian = new Map<string, typeof learners>();
    for (const link of guardianLinks ?? []) {
      const learner = (learners ?? []).find((item) => item.id === link.learner_id);
      if (!learner) continue;
      learnersByGuardian.set(link.guardian_id, [
        ...(learnersByGuardian.get(link.guardian_id) ?? []),
        learner,
      ]);
    }
    const streamsById = new Map((streams ?? []).map((stream) => [stream.id, stream.name]));
    const reportByLearner = new Map((reportCards ?? []).map((card) => [card.learner_id, card]));
    const invoicesByLearner = new Map<string, { total: number; dueDate: string }>();
    for (const invoice of invoices ?? []) {
      const current = invoicesByLearner.get(invoice.learner_id) ?? { total: 0, dueDate: "N/A" };
      invoicesByLearner.set(invoice.learner_id, {
        total: current.total + Number(invoice.total ?? 0),
        dueDate: current.dueDate === "N/A" ? invoice.due_date ?? "N/A" : current.dueDate,
      });
    }
    const paidByLearner = new Map<string, number>();
    for (const payment of payments ?? []) {
      paidByLearner.set(payment.learner_id, (paidByLearner.get(payment.learner_id) ?? 0) + Number(payment.amount ?? 0));
    }
    const schoolName = settings?.school_display_name || school.name;
    const schoolPhone = settings?.school_phone || school.phone || "N/A";
    const schoolEmail = settings?.school_email || school.email || "N/A";
    const template =
      templates?.[0]?.body_template?.trim() &&
      templates[0].body_template.trim().toLowerCase() !== "undefined"
        ? templates[0].body_template
        : data.message;
    const formattedMessages = new Map(
      guardians.map((guardian) => {
        const linkedLearners = learnersByGuardian.get(guardian.id) ?? [];
        const studentNames = linkedLearners.map((learner) =>
          [learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(" "),
        );
        const admissionNumbers = linkedLearners.map((learner) => learner.admission_number);
        const classStreams = linkedLearners.map((learner) =>
          [learner.current_grade, learner.current_stream_id ? streamsById.get(learner.current_stream_id) : null]
            .filter(Boolean)
            .join(" "),
        );
        const body = linkedLearners.map((learner) => {
          const report = reportByLearner.get(learner.id);
          const invoice = invoicesByLearner.get(learner.id) ?? { total: 0, dueDate: "N/A" };
          const paid = paidByLearner.get(learner.id) ?? 0;
          const studentName = [learner.first_name, learner.middle_name, learner.last_name]
            .filter(Boolean)
            .join(" ");
          const classStream = [
            learner.current_grade,
            learner.current_stream_id ? streamsById.get(learner.current_stream_id) : null,
          ]
            .filter(Boolean)
            .join(" ");
          const feeStatement = `Fee balance for ${studentName}: ${invoice.total - paid} outstanding of ${invoice.total}. Paid: ${paid}. Due: ${invoice.dueDate}.`;
          const payload = (report?.payload ?? {}) as { term?: string; year?: string; learner?: { stream?: string }; areas?: Array<{ learning_area?: string; percentage?: number; points?: number | null }> };
          const subjectBreakdown = (payload.areas ?? []).map((area) => `${area.learning_area ?? "Subject"}: ${area.percentage ?? area.points ?? "-"}`).join(", ");
          const renderedBody = renderParentTemplate(template, {
            parent_name: guardian.full_name,
            student_name: studentName,
            admission_no: learner.admission_number,
            class_stream: classStream,
            class_position: report?.class_position,
            class_total_students: report?.class_size,
            grade_position: "N/A",
            grade_total_students: "N/A",
            total_points: report?.total_points,
            total_marks: report?.mean_percentage,
            mean_grade: report?.mean_percentage == null ? "N/A" : `${report.mean_percentage}%`,
            subject_breakdown: subjectBreakdown,
            term: payload.term ?? "current term",
            year: payload.year ?? new Date().getFullYear(),
            teacher_remarks: report?.class_position ? "See the published report card." : "N/A",
            fee_balance: invoice.total - paid,
            total_fees: invoice.total,
            amount_paid: paid,
            due_date: invoice.dueDate,
            message_body: data.message,
            event_date: data.eventDate,
            event_venue: data.eventVenue,
            date: data.eventDate ?? new Date().toLocaleDateString("en-KE"),
            status: data.message,
          }, data.category === "fee_balance" ? feeStatement : data.message);
          return renderedBody;
        }).join("\n\n");
        const safeBody =
          body.trim() && body.trim().toLowerCase() !== "undefined"
            ? body
            : data.message;
        return [
          guardian.id,
          buildParentNotice({
            schoolName,
            parentName: guardian.full_name,
            studentName: studentNames.join(" / ") || "the learner",
            admissionNumber: admissionNumbers.join(" / ") || "N/A",
            classStream: classStreams.join(" / ") || "N/A",
            schoolPhone,
            schoolEmail,
            messageBody: safeBody,
            footerNote: settings?.footer_note || undefined,
          }),
        ] as const;
      }),
    );
    for (const [guardianId, rendered] of Object.entries(data.renderedMessages ?? {})) {
      if (guardians.some((guardian) => guardian.id === guardianId)) {
        formattedMessages.set(guardianId, rendered.body);
      }
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
              message: formattedMessages.get(guardianId) ?? data.message,
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
        message: formattedMessages.get(result.guardianId) ?? data.message,
        status: result.ok ? "sent" : "failed",
        provider: "sozuri",
        provider_status: result.providerStatus ?? null,
        provider_response: result.providerResponse ?? null,
        error_message: result.ok ? null : result.error,
      })),
    );
    if (logError) console.error("Parent SMS log could not be saved:", logError);
    const { error: messageLogError } = await db.from("message_logs").insert(
      results.map((result) => ({
        school_id: data.schoolId,
        guardian_id: result.guardianId,
        category: data.category,
        channel: "sms",
        rendered_body: formattedMessages.get(result.guardianId) ?? data.message,
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date().toISOString() : null,
        error_reason: result.ok ? null : result.error,
        data_snapshot: data.renderedMessages?.[result.guardianId]?.snapshot ?? {},
      })),
    );
    if (messageLogError && messageLogError.code !== "PGRST205") {
      console.error("Parent communication log could not be saved:", messageLogError);
    }
    await db
      .from("message_templates")
      .update({ last_used_at: new Date().toISOString() })
      .eq("school_id", data.schoolId)
      .eq("category", data.category)
      .eq("is_active", true);

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
