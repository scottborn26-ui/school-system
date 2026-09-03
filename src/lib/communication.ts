import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  related_link: string | null;
  is_read: boolean;
  created_at: string;
};

export function useCommunicationCounts(userId: string | null) {
  return useQuery({
    queryKey: ["communication-counts", userId],
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const [{ count: notifications }, { count: messages }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!)
          .eq("is_read", false),
        supabase
          .from("message_recipients")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId!)
          .eq("is_read", false),
      ]);
      return { notifications: notifications ?? 0, messages: messages ?? 0 };
    },
  });
}

export function useNotifications(userId: string | null, limit?: number) {
  return useQuery({
    queryKey: ["notifications", userId, limit],
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      let query = supabase
        .from("notifications")
        .select("id, type, title, message, related_link, is_read, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });
}

export function formatRelativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function notificationIcon(type: string) {
  return type === "message"
    ? "message"
    : type === "fee"
      ? "fee"
      : type === "academic"
        ? "academic"
        : "system";
}
