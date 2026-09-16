import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Eye,
  Inbox,
  Mail,
  Paperclip,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  Users,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { sendParentSms } from "@/lib/parent-sms.functions";
import { buildParentNotice, renderParentTemplate } from "@/lib/parent-sms-template";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ParentMessageComposer } from "@/components/parent-message-composer";

type Contact = {
  id: string;
  user_id: string;
  full_name: string;
  job_title: string | null;
  photo_url: string | null;
};
type Message = {
  id: string;
  sender_id: string;
  subject: string | null;
  body: string;
  priority: string;
  created_at: string;
};

type ParentRecipient = {
  id: string;
  full_name: string;
  phone: string | null;
  alt_phone: string | null;
  learner_guardians: Array<{
    learners: {
      id: string;
      first_name: string;
      last_name: string;
      current_grade: string | null;
      current_stream_id: string | null;
    } | null;
  }>;
};

type SmsLog = {
  id: string;
  guardian_id: string;
  recipient_phone: string;
  message: string;
  status: string;
  provider_status: number | null;
  error_message: string | null;
  created_at: string;
};

export function MessageCenter() {
  const school = useSchool();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const [messageMode, setMessageMode] = useState<"staff" | "parents">("staff");
  const [replying, setReplying] = useState(false);

  const contacts = useQuery({
    queryKey: ["message-contacts", school.schoolId, school.userId],
    enabled: Boolean(school.schoolId && school.userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, user_id, full_name, job_title, photo_url")
        .eq("school_id", school.schoolId!)
        .eq("is_archived", false)
        .eq("status", "active")
        .not("user_id", "is", null)
        .order("full_name");
      if (error) throw error;
      return (data ?? []).filter((contact) => contact.user_id !== school.userId) as Contact[];
    },
  });
  const messages = useQuery({
    queryKey: ["messages", school.userId, school.schoolId],
    enabled: Boolean(school.schoolId && school.userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const [{ data: sent, error: sentError }, { data: received, error: receivedError }] =
        await Promise.all([
          supabase
            .from("messages")
            .select("id, sender_id, subject, body, priority, created_at")
            .eq("school_id", school.schoolId!)
            .eq("sender_id", school.userId!)
            .order("created_at", { ascending: true }),
          supabase
            .from("message_recipients")
            .select("message_id, recipient_id, is_read")
            .eq("recipient_id", school.userId!),
        ]);
      if (sentError) throw sentError;
      if (receivedError) throw receivedError;
      const sentIds = (sent ?? []).map((item) => item.id);
      const receivedIds = (received ?? []).map((item) => item.message_id);
      const [
        { data: sentRecipients, error: sentRecipientsError },
        { data: receivedMessages, error },
      ] = await Promise.all([
        sentIds.length
          ? supabase
              .from("message_recipients")
              .select("message_id, recipient_id, is_read")
              .in("message_id", sentIds)
          : Promise.resolve({ data: [], error: null }),
        receivedIds.length
          ? await supabase
              .from("messages")
              .select("id, sender_id, subject, body, priority, created_at")
              .in("id", receivedIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (sentRecipientsError) throw sentRecipientsError;
      if (error) throw error;
      return {
        rows: [...((sent ?? []) as Message[]), ...((receivedMessages ?? []) as Message[])].sort(
          (a, b) => a.created_at.localeCompare(b.created_at),
        ),
        recipients: [...(received ?? []), ...(sentRecipients ?? [])],
      };
    },
  });
  const conversations = useMemo(() => {
    const rows = messages.data?.rows ?? [];
    const recipientRows = messages.data?.recipients ?? [];
    return (
      contacts.data
        ?.map((contact) => {
          const thread = rows.filter(
            (message) =>
              message.sender_id === contact.user_id ||
              (message.sender_id === school.userId &&
                recipientRows.some(
                  (r) => r.message_id === message.id && r.recipient_id === contact.user_id,
                )),
          );
          const unread = thread.some(
            (message) =>
              message.sender_id === contact.user_id &&
              recipientRows.some((r) => r.message_id === message.id && !r.is_read),
          );
          return { contact, thread, unread, last: thread.at(-1) };
        })
        .filter(
          (conversation) =>
            conversation.last &&
            conversation.contact.full_name.toLowerCase().includes(search.toLowerCase()),
        ) ?? []
    );
  }, [contacts.data, messages.data?.rows, messages.data?.recipients, school.userId, search]);
  const selected =
    conversations.find((conversation) => conversation.contact.user_id === selectedId) ?? null;

  const send = useMutation({
    mutationFn: async ({
      recipients,
      messageBody,
      messageSubject,
      messagePriority,
    }: {
      recipients: string[];
      messageBody: string;
      messageSubject?: string;
      messagePriority: string;
    }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("You must be signed in to send a message.");
      if (!school.schoolId) throw new Error("No active school is available.");

      const messageId = crypto.randomUUID();
      const { error } = await supabase
        .from("messages")
        .insert({
          id: messageId,
          school_id: school.schoolId,
          sender_id: authData.user.id,
          body: messageBody,
          subject: messageSubject || null,
          priority: messagePriority,
        });
      if (error) throw error;
      const { error: recipientError } = await supabase
        .from("message_recipients")
        .insert(recipients.map((recipient_id) => ({ message_id: messageId, recipient_id })));
      if (recipientError) throw recipientError;
      setComposeOpen(false);
      setRecipientIds([]);
      setSubject("");
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast.success("Message sent.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length)
        await supabase
          .from("message_recipients")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("recipient_id", school.userId!)
          .in("message_id", ids);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
      void queryClient.invalidateQueries({ queryKey: ["communication-counts"] });
    },
  });

  function openThread(id: string) {
    setSelectedId(id);
    setReplying(false);
    const thread = conversations.find((item) => item.contact.user_id === id);
    void markRead.mutateAsync(
      thread?.thread.filter((message) => message.sender_id === id).map((message) => message.id) ??
        [],
    );
  }
  const canCompose = school.can(
    "admin",
    "principal",
    "deputy",
    "accountant",
    "support_staff",
    "security",
    "exam_officer",
    "teacher",
    "class_teacher",
  );
  const canMessageParents = school.can("admin", "principal", "deputy");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Private conversations with your school community."
        icon={Mail}
        actions={
          <div className="flex flex-wrap gap-2">
            {canMessageParents && (
              <Button
                variant={messageMode === "parents" ? "default" : "outline"}
                onClick={() => setMessageMode("parents")}
              >
                <Smartphone className="mr-2 size-4" />
                Parent SMS
              </Button>
            )}
            {canCompose && (
              <Button
                variant={messageMode === "staff" ? "default" : "outline"}
                onClick={() => {
                  setMessageMode("staff");
                  setComposeOpen(true);
                }}
              >
                <Plus className="mr-2 size-4" />
                New message
              </Button>
            )}
          </div>
        }
      />
      {messageMode === "parents" && canMessageParents ? (
        <ParentMessageComposer />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="grid min-h-[620px] p-0 md:grid-cols-[300px_1fr]">
            <section className={cn("border-r border-border/70", selected && "hidden md:block")}>
              <div className="border-b border-border/70 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search conversations"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {conversations.map(({ contact, last, unread }) => (
                  <button
                    key={contact.user_id}
                    onClick={() => openThread(contact.user_id)}
                    className="flex w-full gap-3 p-4 text-left hover:bg-muted/50"
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarImage src={contact.photo_url ?? undefined} />
                      <AvatarFallback>{initials(contact.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "flex items-center justify-between gap-2 text-sm",
                          unread && "font-bold",
                        )}
                      >
                        <span className="truncate">{contact.full_name}</span>
                        <time className="shrink-0 text-[11px] font-normal text-muted-foreground">
                          {new Date(last!.created_at).toLocaleDateString()}
                        </time>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {contact.job_title ?? "School staff"}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block truncate text-xs text-muted-foreground",
                          unread && "font-semibold text-foreground",
                        )}
                      >
                        {last!.body}
                      </span>
                    </span>
                    {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                ))}
                {!conversations.length && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <Inbox className="mx-auto mb-2 size-7 opacity-40" />
                    No conversations yet.
                  </div>
                )}
              </div>
            </section>
            <section className={cn("flex min-w-0 flex-col", !selected && "hidden md:flex")}>
              {selected ? (
                <>
                  <div className="flex items-center gap-3 border-b border-border/70 p-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setSelectedId(null)}
                      aria-label="Back to conversations"
                    >
                      <ArrowLeft className="size-4" />
                    </Button>
                    <Avatar className="size-9">
                      <AvatarImage src={selected.contact.photo_url ?? undefined} />
                      <AvatarFallback>{initials(selected.contact.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-sm font-semibold">{selected.contact.full_name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {selected.contact.job_title ?? "School staff"}
                      </p>
                    </div>
                    <Button
                      className="ml-auto"
                      variant="outline"
                      size="sm"
                      onClick={() => setReplying(true)}
                    >
                      <Send className="mr-2 size-4" /> Reply
                    </Button>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    {selected.thread.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          message.sender_id === school.userId ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                            message.sender_id === school.userId
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm bg-muted",
                          )}
                        >
                          <p className="whitespace-pre-wrap">{message.body}</p>
                          <time className="mt-2 block text-[10px] opacity-70">
                            {new Date(message.created_at).toLocaleString()}
                          </time>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form
                    className={cn("border-t border-border/70 p-3", !replying && "hidden")}
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (body.trim())
                        void send.mutateAsync({
                          recipients: [selected.contact.user_id],
                          messageBody: body.trim(),
                          messagePriority: "normal",
                        });
                    }}
                  >
                    <div className="flex items-end gap-2">
                      <Button type="button" variant="ghost" size="icon" aria-label="Attach file">
                        <Paperclip className="size-4" />
                      </Button>
                      <Textarea
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder="Write a message..."
                        className="min-h-11 resize-none"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={!body.trim() || send.isPending}
                        aria-label="Send message"
                      >
                        <Send className="size-4" />
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="grid flex-1 place-items-center p-8 text-center text-muted-foreground">
                  <div>
                    <UserRound className="mx-auto mb-3 size-10 opacity-30" />
                    <p className="font-medium text-foreground">Select a conversation</p>
                    <p className="mt-1 text-sm">Choose a thread to read and reply.</p>
                  </div>
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      )}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="border-b border-border/70 bg-primary/[0.04] px-6 py-5 pr-12">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Mail className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">New message</DialogTitle>
                <DialogDescription className="mt-1">
                  Reach one or more members of your school.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Recipients</Label>
                <span className="text-xs text-muted-foreground">
                  {recipientIds.length ? `${recipientIds.length} selected` : "Select staff"}
                </span>
              </div>
              <Input
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Search by name or role"
                className="bg-background"
              />
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border/80 bg-muted/20 p-2">
                {(contacts.data ?? [])
                  .filter((contact) =>
                    contact.full_name.toLowerCase().includes(recipientSearch.toLowerCase()),
                  )
                  .map((contact) => (
                    <label
                      key={contact.user_id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-background"
                    >
                      <Checkbox
                        checked={recipientIds.includes(contact.user_id)}
                        onCheckedChange={(checked) =>
                          setRecipientIds((current) =>
                            checked
                              ? [...current, contact.user_id]
                              : current.filter((id) => id !== contact.user_id),
                          )
                        }
                      />
                      <Users className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">
                        <span className="block truncate font-medium">{contact.full_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {contact.job_title ?? "Staff"}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-[1fr_170px]">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Subject <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Add a subject"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Message</Label>
                <span className="text-xs text-muted-foreground">Private conversation</span>
              </div>
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write your message here..."
                rows={7}
                className="resize-y bg-background"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/70 bg-muted/20 px-6 py-4 sm:gap-2">
            <Button variant="ghost" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!recipientIds.length || !body.trim() || send.isPending}
              onClick={() =>
                void send.mutateAsync({
                  recipients: recipientIds,
                  messageBody: body.trim(),
                  messageSubject: subject.trim(),
                  messagePriority: priority,
                })
              }
            >
              <Send className="mr-2 size-4" />
              Send message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParentSmsPanel() {
  const school = useSchool();
  const [grade, setGrade] = useState("all");
  const [stream, setStream] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [messageCategory, setMessageCategory] = useState<
    "academic_report" | "fee_balance" | "general_update" | "attendance_alert"
  >("general_update");
  const [eventDate, setEventDate] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [smsPage, setSmsPage] = useState(1);
  const [viewedLog, setViewedLog] = useState<SmsLog | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const smsPageSize = 10;

  const parents = useQuery({
    queryKey: ["parent-sms-recipients", school.schoolId],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guardians")
        .select(
          "id, full_name, phone, alt_phone, learner_guardians(learners(id, first_name, last_name, current_grade, current_stream_id))",
        )
        .eq("school_id", school.schoolId!)
        .eq("is_archived", false)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as ParentRecipient[];
    },
  });
  const streams = useQuery({
    queryKey: ["parent-sms-streams", school.schoolId],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", school.schoolId!)
        .order("grade")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const smsLogs = useQuery({
    queryKey: ["parent-sms-logs", school.schoolId, smsPage],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_message_logs")
        .select("id, guardian_id, recipient_phone, message, status, provider_status, error_message, created_at")
        .eq("school_id", school.schoolId!)
        .order("created_at", { ascending: false })
        .range((smsPage - 1) * smsPageSize, smsPage * smsPageSize - 1);
      if (error) throw error;
      const { count, error: countError } = await supabase
        .from("sms_message_logs")
        .select("id", { count: "exact", head: true })
        .eq("school_id", school.schoolId!);
      if (countError) throw countError;
      return { rows: (data ?? []) as SmsLog[], count: count ?? 0 };
    },
  });
  const parentMessagePreview = useQuery({
    queryKey: ["parent-message-preview", school.schoolId, selectedIds[0], messageCategory],
    enabled: Boolean(
      school.schoolId &&
        selectedIds[0] &&
        (messageCategory === "fee_balance" || messageCategory === "academic_report"),
    ),
    queryFn: async () => {
      const db = supabase as unknown as { from: (table: string) => any };
      const parent = (parents.data ?? []).find((item) => item.id === selectedIds[0]);
      const learnerId = parent?.learner_guardians.find((link) => link.learners)?.learners?.id;
      if (!parent || !learnerId) return null;
      const [schoolResult, settingsResult, templateResult, learnerResult] = await Promise.all([
        db.from("schools").select("name, phone, email").eq("id", school.schoolId!).maybeSingle(),
        db.from("message_settings").select("school_display_name, school_phone, school_email, footer_note").eq("school_id", school.schoolId!).maybeSingle(),
        db.from("message_templates").select("body_template").eq("school_id", school.schoolId!).eq("category", messageCategory).eq("is_active", true).in("channel", ["sms", "both"]).limit(1),
        db.from("learners").select("id, first_name, middle_name, last_name, admission_number, current_grade, current_stream_id").eq("school_id", school.schoolId!).eq("id", learnerId).maybeSingle(),
      ]);
      if (schoolResult.error) throw schoolResult.error;
      if (learnerResult.error) throw learnerResult.error;
      if (!learnerResult.data) return null;
      const learner = learnerResult.data;
      const [streamResult, reportResult, invoiceResult, paymentResult] = await Promise.all([
        learner.current_stream_id
          ? db.from("streams").select("name").eq("school_id", school.schoolId!).eq("id", learner.current_stream_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        messageCategory === "academic_report"
          ? db.from("report_cards").select("total_points, mean_percentage, class_position, class_size, payload").eq("school_id", school.schoolId!).eq("learner_id", learnerId).eq("status", "published").order("updated_at", { ascending: false }).limit(1)
          : Promise.resolve({ data: [], error: null }),
        messageCategory === "fee_balance"
          ? db.from("invoices").select("total, due_date").eq("school_id", school.schoolId!).eq("learner_id", learnerId).eq("status", "issued")
          : Promise.resolve({ data: [], error: null }),
        messageCategory === "fee_balance"
          ? db.from("payments").select("amount").eq("school_id", school.schoolId!).eq("learner_id", learnerId).eq("is_reversed", false)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (reportResult.error || invoiceResult.error || paymentResult.error) {
        throw reportResult.error ?? invoiceResult.error ?? paymentResult.error;
      }
      const report = reportResult.data?.[0] ?? null;
      const totalFees = (invoiceResult.data ?? []).reduce((sum: number, row: { total: number }) => sum + Number(row.total ?? 0), 0);
      const amountPaid = (paymentResult.data ?? []).reduce((sum: number, row: { amount: number }) => sum + Number(row.amount ?? 0), 0);
      const payload = (report?.payload ?? {}) as { term?: string; year?: string; areas?: Array<{ learning_area?: string; percentage?: number; points?: number | null }> };
      const subjectBreakdown = (payload.areas ?? []).map((area) => `${area.learning_area ?? "Subject"}: ${area.percentage ?? area.points ?? "-"}`).join(", ");
      const schoolData = schoolResult.data ?? {};
      const settings = settingsResult.data ?? {};
      const feeStatement = `Fee balance for ${[learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(" ")}: ${totalFees - amountPaid} outstanding of ${totalFees}. Paid: ${amountPaid}. Due: ${invoiceResult.data?.[0]?.due_date ?? "N/A"}.`;
      const template = messageCategory === "fee_balance"
        ? "{{fee_statement}}"
        : templateResult.data?.[0]?.body_template || "Academic report for {{student_name}}. Mean: {{mean_grade}}. Position: {{class_position}}/{{class_total_students}}.";
      const message = renderParentTemplate(template, {
        student_name: [learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(" "),
        admission_no: learner.admission_number,
        class_stream: [learner.current_grade, streamResult.data?.name].filter(Boolean).join(" "),
        fee_balance: totalFees - amountPaid,
        fee_statement: feeStatement,
        total_fees: totalFees,
        amount_paid: amountPaid,
        due_date: invoiceResult.data?.[0]?.due_date ?? "N/A",
        mean_grade: report?.mean_percentage == null ? "N/A" : `${report.mean_percentage}%`,
        class_position: report?.class_position ?? "N/A",
        class_total_students: report?.class_size ?? "N/A",
        total_points: report?.total_points ?? "N/A",
        subject_breakdown: subjectBreakdown,
        term: payload.term ?? "current term",
        year: payload.year ?? new Date().getFullYear(),
      }, "No message data is available for this learner.");
      return buildParentNotice({
        schoolName: settings.school_display_name || schoolData.name || school.school?.name || "School",
        parentName: parent.full_name,
        studentName: [learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(" "),
        admissionNumber: learner.admission_number,
        classStream: [learner.current_grade, streamResult.data?.name].filter(Boolean).join(" ") || "N/A",
        schoolPhone: settings.school_phone || schoolData.phone || "N/A",
        schoolEmail: settings.school_email || schoolData.email || "N/A",
        messageBody: message,
        footerNote: settings.footer_note || undefined,
      });
    },
  });
  useEffect(() => {
    if (parentMessagePreview.data) setBody(parentMessagePreview.data);
  }, [parentMessagePreview.data]);
  const totalSmsPages = Math.max(1, Math.ceil((smsLogs.data?.count ?? 0) / smsPageSize));
  const deleteSms = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from("sms_message_logs")
        .delete()
        .eq("id", logId)
        .eq("school_id", school.schoolId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SMS log deleted.");
      if (smsLogs.data?.rows.length === 1 && smsPage > 1) {
        setSmsPage((page) => page - 1);
      }
      void smsLogs.refetch();
    },
    onError: (error: Error) => toast.error("SMS log could not be deleted.", { description: error.message }),
  });
  const streamOptions = (streams.data ?? []).filter(
    (item) => grade === "all" || item.grade === grade,
  );
  const visibleParents = (parents.data ?? []).filter((parent) => {
    const linkedLearners = parent.learner_guardians.flatMap((link) =>
      link.learners ? [link.learners] : [],
    );
    const scopeMatch = linkedLearners.some(
      (learner) =>
        (grade === "all" || learner.current_grade === grade) &&
        (stream === "all" || learner.current_stream_id === stream),
    );
    const searchMatch = `${parent.full_name} ${parent.phone ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return scopeMatch && searchMatch && Boolean(parent.phone || parent.alt_phone);
  });
  const sendSms = useMutation({
    mutationFn: async () => {
      if (!selectedIds.length) throw new Error("Select at least one parent.");
      if (!body.trim()) throw new Error("Enter a message.");
      await sendParentSms({
        data: {
          schoolId: school.schoolId!,
          guardianIds: selectedIds,
          category: messageCategory,
          eventDate: eventDate.trim() || undefined,
          eventVenue: eventVenue.trim() || undefined,
          message: body.trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Parent SMS request sent.");
      setSelectedIds([]);
      setBody("");
      setEventDate("");
      setEventVenue("");
      void smsLogs.refetch();
    },
    onError: (error: Error) =>
      toast.error("Parent SMS was not sent.", {
        description: error.message,
      }),
  });

  function toggleAll() {
    setSelectedIds((current) =>
      current.length === visibleParents.length ? [] : visibleParents.map((parent) => parent.id),
    );
  }

  function startNewMessage(log: SmsLog) {
    setSelectedIds([log.guardian_id]);
    setBody("");
    messageInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    messageInputRef.current?.focus();
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Smartphone className="size-5 text-primary" /> Send message to parents
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select parents by grade or stream, then send directly to their saved phone number.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={messageCategory} onValueChange={(value) => setMessageCategory(value as typeof messageCategory)}>
            <SelectTrigger><SelectValue placeholder="Message category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general_update">General update / event</SelectItem>
              <SelectItem value="academic_report">Academic report</SelectItem>
              <SelectItem value="fee_balance">Fee balance</SelectItem>
              <SelectItem value="attendance_alert">Attendance alert</SelectItem>
            </SelectContent>
          </Select>
          <Input value={eventDate} onChange={(event) => setEventDate(event.target.value)} placeholder="Event/date (optional)" />
          <Input value={eventVenue} onChange={(event) => setEventVenue(event.target.value)} placeholder="Venue (optional)" />
        </div>
        <p className="text-xs text-muted-foreground">
          Reports and fee balances are filled from the selected learner records. For general updates, write the message below.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr]">
          <Select
            value={grade}
            onValueChange={(value) => {
              setGrade(value);
              setStream("all");
              setSelectedIds([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All grades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All grades</SelectItem>
              {school.grades.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={stream}
            onValueChange={(value) => {
              setStream(value);
              setSelectedIds([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All streams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All streams</SelectItem>
              {streamOptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search parent name or phone"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm">
          <span>
            {visibleParents.length} parent{visibleParents.length === 1 ? "" : "s"} with phone
            numbers
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleAll}
            disabled={!visibleParents.length}
          >
            {selectedIds.length === visibleParents.length && visibleParents.length
              ? "Clear all"
              : "Select all"}
          </Button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
          {visibleParents.map((parent) => (
            <label
              key={parent.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50"
            >
              <Checkbox
                checked={selectedIds.includes(parent.id)}
                onCheckedChange={(checked) =>
                  setSelectedIds((current) =>
                    checked ? [...current, parent.id] : current.filter((id) => id !== parent.id),
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{parent.full_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {parent.phone ?? parent.alt_phone}
                </span>
              </span>
            </label>
          ))}
          {!visibleParents.length && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No matching parents with phone numbers.
            </p>
          )}
        </div>
        <Textarea
          ref={messageInputRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write the SMS message..."
          rows={5}
          maxLength={480}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {body.length}/480 characters · {selectedIds.length} selected
          </span>
          <Button
            onClick={() => sendSms.mutate()}
            disabled={!selectedIds.length || !body.trim() || sendSms.isPending}
          >
            <Send className="mr-2 size-4" /> Send to parents
          </Button>
        </div>
        <div className="space-y-2 border-t pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Recent SMS logs</h3>
              <p className="text-xs text-muted-foreground">{smsLogs.data?.count ?? 0} total messages</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="divide-y">
              {(smsLogs.data?.rows ?? []).map((log) => (
                <div key={log.id} className="flex flex-col gap-3 p-4 text-sm transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold tracking-tight">{log.recipient_phone}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", log.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                        {log.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{log.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 border-t pt-2 sm:border-0 sm:pt-0">
                    <Button size="sm" variant="ghost" onClick={() => setViewedLog(log)}>
                      <Eye className="mr-1.5 size-4" /> View
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startNewMessage(log)}>
                      <Send className="mr-1.5 size-4" /> Send
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteSms.mutate(log.id)} disabled={deleteSms.isPending} aria-label="Delete SMS log">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {!smsLogs.data?.rows.length && (
              <p className="p-4 text-center text-xs text-muted-foreground">No SMS logs yet.</p>
            )}
          </div>
          {totalSmsPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" aria-disabled={smsPage === 1} className={smsPage === 1 ? "pointer-events-none opacity-50" : ""} onClick={(event) => { event.preventDefault(); setSmsPage((page) => Math.max(1, page - 1)); }} />
                </PaginationItem>
                {Array.from({ length: totalSmsPages }, (_, index) => index + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink href="#" isActive={page === smsPage} onClick={(event) => { event.preventDefault(); setSmsPage(page); }}>
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext href="#" aria-disabled={smsPage === totalSmsPages} className={smsPage === totalSmsPages ? "pointer-events-none opacity-50" : ""} onClick={(event) => { event.preventDefault(); setSmsPage((page) => Math.min(totalSmsPages, page + 1)); }} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </CardContent>
      <Dialog open={Boolean(viewedLog)} onOpenChange={(open) => !open && setViewedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMS details</DialogTitle>
            <DialogDescription>{viewedLog?.recipient_phone}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
            <p className="whitespace-pre-wrap leading-6">{viewedLog?.message}</p>
            <div className="grid grid-cols-2 gap-3 border-t pt-3 text-xs text-muted-foreground">
              <span>Status: {viewedLog?.status}</span>
              <span>Provider code: {viewedLog?.provider_status ?? "No response"}</span>
              <span className="col-span-2">Sent: {viewedLog && new Date(viewedLog.created_at).toLocaleString()}</span>
            </div>
            {viewedLog?.error_message && <p className="text-xs text-destructive">{viewedLog.error_message}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
