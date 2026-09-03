import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, BookOpen, CircleDollarSign, Mail, Settings2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotifications, formatRelativeTime, notificationIcon } from "@/lib/communication";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { cn } from "@/lib/utils";

function Icon({ type }: { type: string }) {
  const kind = notificationIcon(type);
  const Component =
    kind === "message"
      ? Mail
      : kind === "fee"
        ? CircleDollarSign
        : kind === "academic"
          ? BookOpen
          : Settings2;
  return <Component className="size-4" />;
}

export function NotificationsPage() {
  const school = useSchool();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const notifications = useNotifications(school.userId);
  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", school.userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", school.userId] });
      void queryClient.invalidateQueries({ queryKey: ["communication-counts", school.userId] });
    },
  });
  const filtered = (notifications.data ?? []).filter(
    (item) => filter === "all" || (filter === "unread" && !item.is_read) || item.type === filter,
  );
  const grouped = filtered.reduce<Record<string, typeof filtered>>((groups, item) => {
    const date = new Date(item.created_at);
    const today = new Date();
    const days = Math.floor((today.getTime() - date.getTime()) / 86400000);
    const key =
      days === 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? "This Week" : "Earlier";
    (groups[key] ??= []).push(item);
    return groups;
  }, {});
  async function open(item: (typeof filtered)[number]) {
    if (!item.is_read) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", item.id)
        .eq("user_id", school.userId!);
      void queryClient.invalidateQueries({ queryKey: ["communication-counts"] });
    }
    if (item.related_link?.startsWith("/messages")) void navigate({ to: "/messages" });
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay current with messages, academic activity and school updates."
        icon={Bell}
        actions={
          <Button
            variant="outline"
            onClick={() => markAll.mutate()}
            disabled={!notifications.data?.some((item) => !item.is_read)}
          >
            Mark all as read
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All"],
          ["unread", "Unread"],
          ["message", "Messages"],
          ["system", "System alerts"],
          ["academic", "Academic"],
          ["fee", "Fees"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          {Object.entries(grouped).map(([group, items]) => (
            <section key={group}>
              <h2 className="border-b border-border/70 bg-muted/30 px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {group}
              </h2>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void open(item)}
                  className={cn(
                    "flex w-full gap-4 border-b border-border/60 px-5 py-4 text-left transition-colors hover:bg-muted/50",
                    !item.is_read && "bg-primary/5",
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon type={item.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !item.is_read && "font-semibold")}>
                      {item.title}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{item.message}</span>
                    <time className="mt-2 block text-xs text-muted-foreground">
                      {formatRelativeTime(item.created_at)} ·{" "}
                      {new Date(item.created_at).toLocaleString()}
                    </time>
                  </span>
                  <span
                    className={cn(
                      "mt-2 size-2 shrink-0 rounded-full",
                      item.is_read ? "bg-muted-foreground/20" : "bg-primary",
                    )}
                  />
                </button>
              ))}
            </section>
          ))}
          {!filtered.length && (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              No notifications in this view.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
