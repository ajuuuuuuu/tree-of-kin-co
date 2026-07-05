import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PresenceMeta {
  user_id: string;
  display_name: string;
  role: string;
  online_at: string;
  device: "desktop" | "mobile" | "tablet" | "unknown";
  country: string;
}

function detectDeviceType() {
  if (typeof navigator === "undefined") return "unknown" as const;
  const ua = navigator.userAgent || "";
  if (/Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return "mobile" as const;
  }
  if (/Tablet|iPad|PlayBook|Silk/i.test(ua)) {
    return "tablet" as const;
  }
  return "desktop" as const;
}

function detectCountry() {
  if (typeof navigator === "undefined") return "unknown";
  const locale = navigator.language || (navigator.languages && navigator.languages[0]) || "";
  const match = locale.match(/[-_](?<region>[A-Za-z]{2})$/);
  if (match?.groups?.region) {
    return match.groups.region.toUpperCase();
  }
  return "unknown";
}

/** Track who is currently viewing the app via Supabase Realtime presence. */
export function usePresence(opts: {
  userId: string | null;
  displayName: string;
  role: string;
  enabled?: boolean;
}) {
  const { userId, displayName, role, enabled = true } = opts;
  const [online, setOnline] = useState<Record<string, PresenceMeta>>({});
  const isDev = typeof import.meta !== "undefined" && import.meta.env?.MODE === "development";

  useEffect(() => {
    if (!enabled || isDev) return;
    const key = userId ?? "anon-" + Math.random().toString(36).slice(2, 9);
    const channel = supabase.channel("family-tree-presence", {
      config: { presence: { key } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const next: Record<string, PresenceMeta> = {};
        Object.entries(state).forEach(([k, metas]) => {
          const meta = metas[0];
          if (meta?.user_id) next[meta.user_id] = meta;
          else next[k] = meta as PresenceMeta;
        });
        setOnline(next);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId ?? key,
            display_name: displayName || "Guest",
            role,
            online_at: new Date().toISOString(),
            device: detectDeviceType(),
            country: detectCountry(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, displayName, role, enabled, isDev]);

  return online;
}