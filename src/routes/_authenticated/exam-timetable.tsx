import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Lock, Pencil, Plus, Printer, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { printSection } from "@/lib/csv";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/exam-timetable")({
  head: () => ({ meta: [{ title: "Exam Timetable · SHANSCOTT CBE" }] }),
  component: () => (
    <RequireSchool roles={["admin", "exam_officer", "principal", "deputy", "teacher", "class_teacher"]}>
      <ExamTimetablePage />
    </RequireSchool>
  ),
});

type Session = {
  id: string; assessment_id: string; grade: CbeGrade; session_date: string;
  start_time: string; end_time: string; venue: string | null; invigilator_id: string | null; status: "draft" | "published";
  assessments?: { title: string; learning_area_id: string } | null;
};

function ExamTimetablePage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const isAdmin = school.can("admin", "exam_officer", "principal", "deputy", "super_admin");
  const db = supabase as unknown as { from: (table: string) => any };
  const [grade, setGrade] = useState<CbeGrade | "">("");
  const [assessmentId, setAssessmentId] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [venue, setVenue] = useState("");
  const [invigilatorId, setInvigilatorId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const sessions = useQuery({
    queryKey: ["exam-timetable-sessions", schoolId, grade],
    queryFn: async () => {
      let query = db.from("exam_timetable_sessions").select("*, assessments(title, learning_area_id)").eq("school_id", schoolId).order("session_date").order("start_time");
      if (grade) query = query.eq("grade", grade);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });
  const assessments = useQuery({
    queryKey: ["exam-timetable-assessments", schoolId, grade, school.termId],
    enabled: Boolean(grade),
    queryFn: async () => {
      const { data, error } = await supabase.from("assessments").select("id, title, learning_area_id, grade").eq("school_id", schoolId).eq("term_id", school.termId).eq("grade", grade!).order("assessment_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  const staff = useQuery({
    queryKey: ["exam-timetable-staff", schoolId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, full_name").eq("school_id", schoolId).eq("is_archived", false).eq("status", "active").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!grade || !assessmentId) throw new Error("Select a grade and assessment.");
      const payload = { school_id: schoolId, assessment_id: assessmentId, grade, session_date: sessionDate, start_time: startTime, end_time: endTime, venue: venue.trim() || null, invigilator_id: invigilatorId || null, created_by: school.userId };
      const result = editingId ? await db.from("exam_timetable_sessions").update(payload).eq("id", editingId) : await db.from("exam_timetable_sessions").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => { toast.success(editingId ? "Exam session updated." : "Exam session added."); reset(); void qc.invalidateQueries({ queryKey: ["exam-timetable-sessions", schoolId] }); },
    onError: (error: Error) => toast.error("Could not save exam session.", { description: error.message }),
  });
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { const { error } = await db.from("exam_timetable_sessions").update({ status }).eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Exam timetable updated."); void qc.invalidateQueries({ queryKey: ["exam-timetable-sessions", schoolId] }); },
    onError: (error: Error) => toast.error("Could not update timetable.", { description: error.message }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("exam_timetable_sessions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Exam session deleted."); void qc.invalidateQueries({ queryKey: ["exam-timetable-sessions", schoolId] }); },
    onError: (error: Error) => toast.error("Could not delete session.", { description: error.message }),
  });
  function reset() { setEditingId(null); setAssessmentId(""); setVenue(""); setInvigilatorId(""); }
  function edit(session: Session) { setEditingId(session.id); setGrade(session.grade); setAssessmentId(session.assessment_id); setSessionDate(session.session_date); setStartTime(session.start_time.slice(0, 5)); setEndTime(session.end_time.slice(0, 5)); setVenue(session.venue ?? ""); setInvigilatorId(session.invigilator_id ?? ""); }

  return <>
    <PageHeader title="Exam Timetable" description="Schedule one-off exam sessions by grade, with clash-safe rooms and invigilators." icon={CalendarDays} />
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {isAdmin && <Card><CardHeader><CardTitle className="text-base">{editingId ? "Edit exam session" : "Add exam session"}</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-1.5"><Label>Grade</Label><Select value={grade} onValueChange={(value) => { setGrade(value as CbeGrade); setAssessmentId(""); }}><SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger><SelectContent>{school.grades.map((item) => <SelectItem key={item} value={item}>{GRADE_LABELS[item]}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Assessment</Label><Select value={assessmentId} onValueChange={setAssessmentId} disabled={!grade}><SelectTrigger><SelectValue placeholder="Select assessment" /></SelectTrigger><SelectContent>{(assessments.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Date</Label><Input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} /></div><div className="space-y-1.5"><Label>Venue</Label><Input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Room / hall" /></div></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Start</Label><Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div><div className="space-y-1.5"><Label>End</Label><Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div></div>
        <div className="space-y-1.5"><Label>Invigilator</Label><Select value={invigilatorId} onValueChange={setInvigilatorId}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{(staff.data ?? []).map((member) => <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex gap-2"><Button onClick={() => save.mutate()} disabled={save.isPending}><Plus className="mr-2 size-4" />{editingId ? "Save changes" : "Add session"}</Button>{editingId && <Button variant="outline" onClick={reset}>Cancel</Button>}</div>
      </CardContent></Card>}
      <Card id="exam-timetable-print"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Sessions {grade && `· ${GRADE_LABELS[grade]}`}</CardTitle></div><div className="flex gap-2"><Select value={grade} onValueChange={(value) => setGrade(value as CbeGrade)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="All grades" /></SelectTrigger><SelectContent>{school.grades.map((item) => <SelectItem key={item} value={item}>{GRADE_LABELS[item]}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" title="Print timetable" aria-label="Print timetable" onClick={() => printSection("exam-timetable-print")}><Printer className="size-4" /></Button></div></div></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Grade / subject</TableHead><TableHead>Venue</TableHead><TableHead>Invigilator</TableHead><TableHead>Status</TableHead>{isAdmin && <TableHead />}</TableRow></TableHeader><TableBody>{(sessions.data ?? []).map((session) => <TableRow key={session.id}><TableCell>{session.session_date}</TableCell><TableCell>{session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}</TableCell><TableCell className="font-medium">{GRADE_LABELS[session.grade]} · {session.assessments?.title ?? "Assessment"}</TableCell><TableCell>{session.venue ?? "—"}</TableCell><TableCell>{staff.data?.find((member) => member.id === session.invigilator_id)?.full_name ?? "—"}</TableCell><TableCell><Badge variant={session.status === "published" ? "default" : "outline"}>{session.status}</Badge></TableCell>{isAdmin && <TableCell><div className="flex justify-end gap-1">{session.status === "draft" && <Button variant="ghost" size="icon" title="Publish" aria-label="Publish" onClick={() => updateStatus.mutate({ id: session.id, status: "published" })}><Send className="size-4" /></Button>}<Button variant="ghost" size="icon" title="Edit" aria-label="Edit" onClick={() => edit(session)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" title="Delete" aria-label="Delete" onClick={() => remove.mutate(session.id)}><Trash2 className="size-4" /></Button></div></TableCell>}</TableRow>)}</TableBody></Table>{!sessions.isLoading && !sessions.data?.length && <p className="py-8 text-center text-sm text-muted-foreground">No exam sessions scheduled.</p>}</CardContent></Card>
    </div>
  </>;
}
