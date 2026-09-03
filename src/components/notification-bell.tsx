import { Link } from "@tanstack/react-router";
import { Bell, BookOpen, CircleDollarSign, Mail, Settings2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCommunicationCounts,
  useNotifications,
  formatRelativeTime,
  notificationIcon,
} from "@/lib/communication";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";

function TypeIcon({ type }: { type: string }) {
  const Icon =
    notificationIcon(type) === "message"
      ? Mail
      : notificationIcon(type) === "fee"
        ? CircleDollarSign
        : notificationIcon(type) === "academic"
          ? BookOpen
          : Settings2;
  return <Icon className="size-4" />;
}

export function NotificationBell() {
  const school = useSchool();
  const queryClient = useQueryClient();
  const counts = useCommunicationCounts(school.userId);
  const notifications = useNotifications(school.userId, 5);
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
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", school.userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", school.userId] });
      void queryClient.invalidateQueries({ queryKey: ["communication-counts", school.userId] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Open notifications"
        >
          <Bell className="size-4" />
          {!!counts.data?.notifications && (
            <span className="absolute right-0 top-0 grid min-w-4 translate-x-1/4 -translate-y-1/4 place-items-center rounded-full bg-[color:var(--danger)] px-1 text-[9px] font-bold text-white">
              {counts.data.notifications > 99 ? "99+" : counts.data.notifications}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => markAll.mutate()}
            disabled={!counts.data?.notifications}
          >
            Mark all as read
          </button>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[360px] overflow-y-auto">
          {(notifications.data ?? []).map((notification) => (
            <Link
              key={notification.id}
              to={
                notification.related_link?.split("?")[0] === "/messages"
                  ? "/messages"
                  : "/notifications"
              }
              className={`flex gap-3 border-b border-border/60 px-4 py-3 hover:bg-muted/60 ${!notification.is_read ? "bg-primary/5" : ""}`}
              onClick={() => {
                if (!notification.is_read) markRead.mutate(notification.id);
              }}
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <TypeIcon type={notification.type} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm ${!notification.is_read ? "font-semibold" : ""}`}
                >
                  {notification.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {notification.message}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {formatRelativeTime(notification.created_at)}
                </span>
              </span>
              {!notification.is_read && (
                <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
              )}
            </Link>
          ))}
          {!notifications.data?.length && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You are all caught up.
            </p>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <Link
          to="/notifications"
          className="block px-4 py-3 text-center text-sm font-medium text-primary hover:bg-muted/60"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
