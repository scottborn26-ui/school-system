import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSchool } from "@/hooks/use-school";
import { renderMessage, type MessageType, type RenderedMessage } from "@/lib/message-renderer";
import { sendParentSms } from "@/lib/parent-sms.functions";
import { supabase } from "@/lib/supabase";

type Parent = {
  id: string;
  full_name: string;
  phone: string | null;
  alt_phone: string | null;
  learner_guardians: Array<{ learners: { id: string; first_name: string; last_name: string; current_grade: string | null; current_stream_id: string | null } | null }>;
};

type AudienceMode = "all" | "grade" | "stream" | "individual";

const labels: Record<MessageType, string> = {
  fee_statement: "Fee Statement",
  overdue_reminder: "Overdue Reminder",
  academic_report: "Academic Report",
  attendance_alert: "Attendance Alert",
  general_update: "General Update",
};

export function ParentMessageComposer() {
  const school = useSchool();
  const [type, setType] = useState<MessageType>("general_update");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("individual");
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [termId, setTermId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceIds, setAttendanceIds] = useState<string[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<RenderedMessage | null>(null);
  const schoolId = school.schoolId!;

  const parents = useQuery({
    queryKey: ["typed-parent-recipients", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("guardians").select("id, full_name, phone, alt_phone, learner_guardians(learners(id, first_name, last_name, current_grade, current_stream_id))").eq("school_id", schoolId).eq("is_archived", false).order("full_name");
      if (error) throw error;
      return (data ?? []) as Parent[];
    },
  });
  const terms = useQuery({
    queryKey: ["typed-message-terms", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("terms").select("id, name, academic_year_id").eq("school_id", schoolId).order("term_number");
      if (error) throw error;
      return data ?? [];
    },
  });
  const streams = useQuery({
    queryKey: ["typed-message-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("streams").select("id, name, grade").eq("school_id", schoolId).eq("is_active", true).order("grade").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const feeBalances = useQuery({
    queryKey: ["typed-message-overdue", schoolId],
    enabled: type === "overdue_reminder",
    queryFn: async () => {
      const [{ data: invoices, error: invoiceError }, { data: payments, error: paymentError }] = await Promise.all([
        supabase.from("invoices").select("learner_id, total, due_date").eq("school_id", schoolId).eq("status", "issued"),
        supabase.from("payments").select("learner_id, amount").eq("school_id", schoolId).eq("is_reversed", false),
      ]);
      if (invoiceError) throw invoiceError;
      if (paymentError) throw paymentError;
      const paid = new Map<string, number>();
      for (const payment of payments ?? []) paid.set(payment.learner_id, (paid.get(payment.learner_id) ?? 0) + Number(payment.amount ?? 0));
      return new Set((invoices ?? []).filter((invoice) => Number(invoice.total ?? 0) - (paid.get(invoice.learner_id) ?? 0) > 0 && Boolean(invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10))).map((invoice) => invoice.learner_id));
    },
  });
  const overdueLearners = feeBalances.data ?? new Set<string>();
  const availableParents = useMemo(() => (parents.data ?? []).filter((parent) => `${parent.full_name} ${parent.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()) && Boolean(parent.phone || parent.alt_phone) && (type !== "overdue_reminder" || parent.learner_guardians.some((link) => link.learners && overdueLearners.has(link.learners.id)))), [parents.data, search, type, overdueLearners]);
  const filteredParents = useMemo(() => availableParents.filter((parent) => {
    const learners = parent.learner_guardians.flatMap((link) => link.learners ? [link.learners] : []);
    return (!selectedGrades.length || learners.some((learner) => learner.current_grade && selectedGrades.includes(learner.current_grade))) &&
      (!selectedStreams.length || learners.some((learner) => learner.current_stream_id && selectedStreams.includes(learner.current_stream_id)));
  }), [availableParents, selectedGrades, selectedStreams]);
  const audienceParents = audienceMode === "all" ? availableParents : filteredParents;
  const sampleParent = audienceParents.find((parent) => selectedIds.includes(parent.id)) ?? audienceParents[0];
  const sampleStudent = sampleParent?.learner_guardians.find((link) => link.learners)?.learners;

  useEffect(() => {
    if (audienceMode !== "individual") setSelectedIds(audienceParents.map((parent) => parent.id));
  }, [audienceMode, audienceParents]);
  const attendanceRecords = useQuery({
    queryKey: ["typed-message-attendance", schoolId, sampleStudent?.id, attendanceDate],
    enabled: type === "attendance_alert" && Boolean(sampleStudent?.id && attendanceDate),
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_records").select("id, attendance_date, timetable_slot_id, timetable_slots(period_index, learning_area_id, staff_id)").eq("school_id", schoolId).eq("learner_id", sampleStudent!.id).eq("attendance_date", attendanceDate).eq("status", "absent");
      if (error) throw error;
      return data ?? [];
    },
  });

  const renderPreview = useMutation({
    mutationFn: () => {
      if (!sampleStudent) throw new Error("Select a parent with a linked student.");
      return renderMessage({ schoolId, studentId: sampleStudent.id, parentName: sampleParent?.full_name, type, termId: termId || undefined, attendanceDate, attendanceIds, messageBody, eventDate, eventVenue });
    },
    onSuccess: (result) => setPreview(result),
    onError: (error: Error) => toast.error(error.message),
  });
  const send = useMutation({
    mutationFn: async () => {
      if (!selectedIds.length) throw new Error("Select at least one parent.");
      const renderedMessages: Record<string, { body: string; snapshot: Record<string, unknown> }> = {};
      for (const parentId of selectedIds) {
        const parent = (parents.data ?? []).find((item) => item.id === parentId);
        const student = parent?.learner_guardians.find((link) => link.learners)?.learners;
        if (!student) continue;
        const rendered = await renderMessage({ schoolId, studentId: student.id, parentName: parent?.full_name, type, termId: termId || undefined, attendanceDate, attendanceIds, messageBody, eventDate, eventVenue });
        if (rendered.missingReason) throw new Error(`${student.first_name}: ${rendered.missingReason}`);
        renderedMessages[parentId] = { body: rendered.smsBody, snapshot: rendered.snapshot };
      }
      if (!Object.keys(renderedMessages).length) throw new Error("No linked students can receive this message.");
      await sendParentSms({ data: { schoolId, guardianIds: Object.keys(renderedMessages), category: type === "academic_report" ? "academic_report" : type === "attendance_alert" ? "attendance_alert" : type === "general_update" ? "general_update" : "fee_balance", message: preview?.smsBody || messageBody || "Rendered parent message", renderedMessages } });
    },
    onSuccess: () => { toast.success("Parent messages sent."); setSelectedIds([]); setPreview(null); },
    onError: (error: Error) => toast.error("Parent messages were not sent.", { description: error.message }),
  });

  function setAudience(mode: AudienceMode) {
    setAudienceMode(mode);
    if (mode === "all") {
      setSelectedGrades([]);
      setSelectedStreams([]);
      setSelectedIds(availableParents.map((parent) => parent.id));
    }
    else if (mode !== "individual") setSelectedIds(filteredParents.map((parent) => parent.id));
    else setSelectedIds([]);
  }

  function toggleValue(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Smartphone className="size-5 text-primary" /> Send message to parents</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a message type first. The preview uses live data from the selected student.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Select value={type} onValueChange={(value) => { setType(value as MessageType); setPreview(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          {type === "academic_report" && <Select value={termId} onValueChange={setTermId}><SelectTrigger><SelectValue placeholder="Select term / exam" /></SelectTrigger><SelectContent>{(terms.data ?? []).map((term) => <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>)}</SelectContent></Select>}
          {type === "attendance_alert" && <div className="space-y-2"><Label htmlFor="attendance-date">Flagged lesson date</Label><Input id="attendance-date" type="date" value={attendanceDate} onChange={(event) => { setAttendanceDate(event.target.value); setAttendanceIds([]); }} /><div className="max-h-24 overflow-y-auto rounded border p-2 text-xs">{(attendanceRecords.data ?? []).map((record: any) => <label key={record.id} className="flex items-center gap-2"><Checkbox checked={attendanceIds.includes(record.id)} onCheckedChange={(checked) => setAttendanceIds((current) => checked ? [...current, record.id] : current.filter((id) => id !== record.id))} /> Period {record.timetable_slots?.period_index ?? "?"} · Missed lesson</label>)}{!attendanceRecords.data?.length && <span className="text-muted-foreground">No flagged lessons for this student and date.</span>}</div></div>}
        </div>
        {type === "general_update" && <div className="grid gap-3 md:grid-cols-2"><Textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="Write the update..." maxLength={480} /><div className="space-y-3"><Input value={eventDate} onChange={(event) => setEventDate(event.target.value)} placeholder="Event date (optional)" /><Input value={eventVenue} onChange={(event) => setEventVenue(event.target.value)} placeholder="Venue (optional)" /></div></div>}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><Label>Audience</Label><span className="text-xs text-muted-foreground">{selectedIds.length} parent{selectedIds.length === 1 ? "" : "s"} selected</span></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(["all", "grade", "stream", "individual"] as AudienceMode[]).map((mode) => <Button key={mode} type="button" variant={audienceMode === mode ? "default" : "outline"} size="sm" onClick={() => setAudience(mode)}>{mode === "all" ? "All parents" : mode === "grade" ? "Selected grades" : mode === "stream" ? "Selected streams" : "Individual"}</Button>)}
          </div>
          {audienceMode === "grade" && <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 p-2">{school.grades.map((grade) => <label key={grade} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"><Checkbox checked={selectedGrades.includes(grade)} onCheckedChange={() => toggleValue(grade, selectedGrades, setSelectedGrades)} />{grade}</label>)}</div>}
          {audienceMode === "stream" && <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 p-2">{(streams.data ?? []).map((stream) => <label key={stream.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"><Checkbox checked={selectedStreams.includes(stream.id)} onCheckedChange={() => toggleValue(stream.id, selectedStreams, setSelectedStreams)} />{stream.grade} {stream.name}</label>)}</div>}
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search parent name or phone" />
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">{filteredParents.map((parent) => <label key={parent.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50"><Checkbox disabled={audienceMode !== "individual"} checked={selectedIds.includes(parent.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...current, parent.id] : current.filter((id) => id !== parent.id))} /><span><span className="block font-medium">{parent.full_name}</span><span className="text-xs text-muted-foreground">{parent.phone ?? parent.alt_phone}</span></span></label>)}{!filteredParents.length && <p className="p-4 text-center text-sm text-muted-foreground">No parents match this audience.</p>}</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border bg-muted/20 p-4"><div className="mb-2 flex items-center justify-between"><Label>Live preview</Label><span className="text-xs text-muted-foreground">{sampleStudent ? `Preview for ${sampleStudent.first_name} ${sampleStudent.last_name}` : "Select an audience"}</span></div><pre className="min-h-36 whitespace-pre-wrap text-sm leading-6">{preview?.missingReason ?? preview?.smsBody ?? "Preview appears here after you select a recipient."}</pre></div>
          <div className="flex flex-col justify-end gap-2"><Button variant="outline" onClick={() => renderPreview.mutate()} disabled={!sampleStudent || (type === "academic_report" && !termId) || renderPreview.isPending}><Eye className="mr-2 size-4" /> Render preview</Button><Button onClick={() => send.mutate()} disabled={!selectedIds.length || !preview || Boolean(preview.missingReason) || send.isPending}><Send className="mr-2 size-4" /> Send to {selectedIds.length || "parents"}</Button></div>
        </div>
      </CardContent>
    </Card>
  );
}