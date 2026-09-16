import { supabase } from "@/lib/supabase";
import { renderParentTemplate } from "@/lib/parent-sms-template";

export type MessageType =
  | "fee_statement"
  | "overdue_reminder"
  | "academic_report"
  | "attendance_alert"
  | "general_update";

export type RenderMessageOptions = {
  schoolId: string;
  studentId: string;
  parentName?: string;
  type: MessageType;
  termId?: string;
  attendanceDate?: string;
  attendanceIds?: string[];
  messageBody?: string;
  eventDate?: string;
  eventVenue?: string;
};

export type RenderedMessage = {
  smsBody: string;
  emailHtml: string;
  snapshot: Record<string, unknown>;
  missingReason?: string;
};

const money = (value: number) => value.toLocaleString("en-KE", { maximumFractionDigits: 2 });
const nameOf = (learner: { first_name: string; middle_name?: string | null; last_name: string }) =>
  [learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(" ");

function html(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br />");
}

export async function renderMessage(options: RenderMessageOptions): Promise<RenderedMessage> {
  const db = supabase as unknown as { from: (table: string) => any };
  const [{ data: learner, error: learnerError }, { data: school, error: schoolError }, { data: settings }, { data: template }] =
    await Promise.all([
      db.from("learners").select("id, first_name, middle_name, last_name, admission_number, current_grade, current_stream_id").eq("school_id", options.schoolId).eq("id", options.studentId).maybeSingle(),
      db.from("schools").select("name, phone, email").eq("id", options.schoolId).maybeSingle(),
      db.from("message_settings").select("*").eq("school_id", options.schoolId).maybeSingle(),
      db.from("message_templates").select("body_template").eq("school_id", options.schoolId).eq("category", options.type === "fee_statement" || options.type === "overdue_reminder" ? "fee_balance" : options.type).eq("is_active", true).in("channel", ["sms", "both"]).limit(1),
    ]);
  if (learnerError) throw learnerError;
  if (schoolError) throw schoolError;
  if (!learner) throw new Error("Student could not be found.");
  if (options.type === "academic_report" && !options.termId) {
    return {
      smsBody: "",
      emailHtml: "",
      snapshot: { studentName: nameOf(learner), admissionNumber: learner.admission_number },
      missingReason: "Select a term before rendering the academic report.",
    };
  }

  const [{ data: stream }, { data: invoices }, { data: payments }] = await Promise.all([
    learner.current_stream_id ? db.from("streams").select("name").eq("id", learner.current_stream_id).maybeSingle() : Promise.resolve({ data: null }),
    options.type === "fee_statement" || options.type === "overdue_reminder" ? db.from("invoices").select("total, due_date, term_id").eq("school_id", options.schoolId).eq("learner_id", options.studentId).eq("status", "issued") : Promise.resolve({ data: [] }),
    options.type === "fee_statement" ? db.from("payments").select("amount, method, paid_at").eq("school_id", options.schoolId).eq("learner_id", options.studentId).eq("is_reversed", false).order("paid_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const studentName = nameOf(learner);
  const classStream = [learner.current_grade, stream?.name].filter(Boolean).join(" ") || "N/A";
  const totalInvoiced = (invoices ?? []).reduce((sum: number, row: any) => sum + Number(row.total ?? 0), 0);
  const amountPaid = options.type === "fee_statement" ? (payments ?? []).reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0) : 0;
  const balance = totalInvoiced - amountPaid;
  const dueDate = (invoices ?? []).map((row: any) => row.due_date).filter(Boolean).sort()[0] ?? "N/A";

  let body = "";
  let snapshot: Record<string, unknown> = { studentName, admissionNumber: learner.admission_number, classStream };
  if (options.type === "general_update") {
    body = renderParentTemplate(template?.[0]?.body_template ?? "{{message_body}}", { message_body: options.messageBody ?? "", event_date: options.eventDate, event_venue: options.eventVenue }, options.messageBody ?? "");
  } else if (options.type === "fee_statement" || options.type === "overdue_reminder") {
    const daysOverdue = dueDate !== "N/A" ? Math.max(0, Math.floor((Date.now() - new Date(`${dueDate}T00:00:00`).getTime()) / 86400000)) : 0;
    if (options.type === "overdue_reminder" && !(balance > 0 && daysOverdue > 0)) {
      return { smsBody: "", emailHtml: "", snapshot, missingReason: "This student has no overdue balance." };
    }
    snapshot = { ...snapshot, totalInvoiced, amountPaid, balance, dueDate, payments: payments ?? [], daysOverdue };
    body = options.type === "overdue_reminder"
      ? `${settings?.school_display_name || school.name}: ${studentName} has an overdue fee balance of KES ${money(balance)}, due since ${dueDate} (${daysOverdue} days overdue). Pay via ${settings?.sms_sender_id || "the school office"}. Contact ${settings?.school_phone || school.phone || "the school office"}.`
      : `FEE STATEMENT - Student: ${studentName} (${learner.admission_number})\n\nTotal Fees Invoiced: KES ${money(totalInvoiced)}\nAmount Paid: KES ${money(amountPaid)}\nBalance: KES ${money(balance)}\nDue Date: ${dueDate}\n\nRecent Payments:\n${(payments ?? []).map((payment: any) => `${payment.paid_at?.slice(0, 10) ?? "N/A"} - KES ${money(Number(payment.amount))} (${payment.method})`).join("\n") || "None"}`;
  } else if (options.type === "academic_report") {
    const { data: report, error } = await db.from("report_cards").select("total_points, mean_percentage, class_position, class_size, payload, class_teacher_comment, head_teacher_comment").eq("school_id", options.schoolId).eq("learner_id", options.studentId).eq("term_id", options.termId).eq("status", "published").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!report) return { smsBody: "", emailHtml: "", snapshot, missingReason: "Report not yet finalized for this term." };
    const payload = (report.payload ?? {}) as any;
    const subjects = payload.areas ?? payload.subjects ?? [];
    snapshot = { ...snapshot, report };
    body = `ACADEMIC REPORT - ${payload.term ?? "Term"}, ${payload.year ?? new Date().getFullYear()}\n${studentName} | ${classStream}\n\nClass Position: ${report.class_position ?? "N/A"} of ${report.class_size ?? "N/A"}\nTotal Points: ${report.total_points ?? "N/A"}\nMean Grade: ${report.mean_percentage ?? "N/A"}\n\nSubject Breakdown:\n${subjects.map((item: any) => `${item.learning_area ?? item.name ?? "Subject"}: ${item.percentage ?? item.score ?? "-"} ${item.grade ?? ""}`).join("\n") || "No subject breakdown available."}\n\nTeacher's Remarks: ${report.class_teacher_comment ?? report.head_teacher_comment ?? "N/A"}`;
  } else {
    const { data: records, error } = await db.from("attendance_records").select("id, attendance_date, status, timetable_slot_id, timetable_slots(period_index, learning_area_id, staff_id)").eq("school_id", options.schoolId).eq("learner_id", options.studentId).eq("attendance_date", options.attendanceDate ?? "").eq("status", "absent").in("id", options.attendanceIds?.length ? options.attendanceIds : ["00000000-0000-0000-0000-000000000000"]);
    if (error) throw error;
    if (!(records ?? []).length) return { smsBody: "", emailHtml: "", snapshot, missingReason: "Select at least one flagged missed lesson." };
    const lesson = records[0];
    const slot = lesson.timetable_slots;
    const [{ data: subject }, { data: teacher }] = await Promise.all([
      slot?.learning_area_id ? db.from("learning_areas").select("name").eq("id", slot.learning_area_id).maybeSingle() : Promise.resolve({ data: null }),
      slot?.staff_id ? db.from("staff").select("full_name").eq("id", slot.staff_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const period = slot?.period_index ? `period ${slot.period_index}` : "the selected lesson";
    body = `${settings?.school_display_name || school.name}: ${studentName} was marked absent from ${subject?.name || "the lesson"} (${period}, ${teacher?.full_name || "teacher not recorded"}) on ${lesson.attendance_date}. Contact the school office if this is unexpected.`;
    snapshot = { ...snapshot, attendance: records };
  }
  const envelope = `${settings?.school_display_name || school.name} Official Notice\nDear ${options.parentName || "Parent"},\n\nRe: ${studentName} (Adm No: ${learner.admission_number}, ${classStream})\n\n—\n${body}\n—\n\nContact: ${settings?.school_phone || school.phone || "N/A"} | ${settings?.school_email || school.email || "N/A"}`;
  return { smsBody: envelope.slice(0, 480), emailHtml: `<article><p>${html(envelope)}</p></article>`, snapshot };
}