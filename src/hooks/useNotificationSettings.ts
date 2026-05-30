import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { NotificationSettings } from "../types";

const QUERY_KEY = ["notificationSettings"] as const;

export function useNotificationSettings() {
  return useQuery({
    enabled: supabaseConfigured,
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<NotificationSettings | null> => {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as NotificationSettings | null;
    },
  });
}

type Patch = Partial<
  Pick<
    NotificationSettings,
    "discord_enabled" | "discord_user_id" | "notification_hour" | "timezone"
  >
>;

export function useUpsertNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Patch): Promise<NotificationSettings> => {
      const { data, error } = await supabase
        .from("notification_settings")
        .upsert(patch, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data as NotificationSettings;
    },
    onSuccess: (data) => {
      qc.setQueryData(QUERY_KEY, data);
    },
  });
}
