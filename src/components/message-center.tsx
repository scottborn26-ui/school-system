import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Inbox,
  Mail,
  Paperclip,
  Plus,
  Search,
  Send,
  UserRound,
  Users,
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
import { useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

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

      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          school_id: school.schoolId,
          sender_id: authData.user.id,
          body: messageBody,
          subject: messageSubject || null,
          priority: messagePriority,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: recipientError } = await supabase
        .from("message_recipients")
        .insert(recipients.map((recipient_id) => ({ message_id: message.id, recipient_id })));
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
    const thread = conversations.find((item) => item.contact.user_id === id);
    void markRead.mutateAsync(
      thread?.thread.filter((message) => message.sender_id === id).map((message) => message.id) ??
        [],
    );
  }
  const canCompose = school.can("admin", "principal", "deputy", "teacher", "class_teacher");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Private conversations with your school community."
        icon={Mail}
        actions={
          canCompose ? (
            <Button onClick={() => setComposeOpen(true)}>
              <Plus className="mr-2 size-4" />
              New message
            </Button>
          ) : undefined
        }
      />
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
                  className="border-t border-border/70 p-3"
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
