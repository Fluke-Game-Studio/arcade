import { useCallback, useEffect, useMemo, useState } from "react";

declare const M: any;

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export type IntegrationKey = "linkedin" | "discord" | "jira";

export function useIntegrations(api: any, me: any, opts?: { onConnected?: () => void | Promise<void> }) {
  const [loadingByKey, setLoadingByKey] = useState<Record<IntegrationKey, boolean>>({
    linkedin: false,
    discord: false,
    jira: false,
  });
  const [jiraStatus, setJiraStatus] = useState<any>(null);

  const status = useMemo(
    () => ({
      linkedin: Boolean(
        (me as any)?.linkedin_connected || safeStr((me as any)?.linkedin_connected_at)
      ),
      discord: Boolean(
        (me as any)?.discord_connected || safeStr((me as any)?.discord_connected_at)
      ),
      jira: Boolean(jiraStatus?.connected),
      jiraCloudName: safeStr(jiraStatus?.cloudName),
    }),
    [me, jiraStatus]
  );

  const setLoading = useCallback((key: IntegrationKey, value: boolean) => {
    setLoadingByKey((prev) => ({ ...prev, [key]: value }));
  }, []);

  const refreshJiraStatus = useCallback(async () => {
    try {
      const next = await api.getJiraConnectStatus();
      setJiraStatus(next || null);
    } catch {
      setJiraStatus(null);
    }
  }, [api]);

  useEffect(() => {
    void refreshJiraStatus();
  }, [refreshJiraStatus]);

  const startConnect = useCallback(
    async (key: IntegrationKey) => {
      const popup = window.open("", `${key}-connect`, "width=560,height=760,left=140,top=140");
      if (!popup) {
        M?.toast?.({ html: "Popup blocked. Please allow popups.", classes: "red" });
        return;
      }

      popup.document.write(`<p style='font-family:Arial,sans-serif;padding:20px'>Opening ${key}...</p>`);
      setLoading(key, true);
      try {
        const fetcher =
          key === "linkedin"
            ? () => api.startLinkedInConnect({ returnTo: window.location.href })
            : key === "discord"
            ? () => api.startDiscordConnect({ returnTo: window.location.href })
            : () => api.startJiraConnect({ returnTo: window.location.href });
        const resp = await fetcher();
        const authorizeUrl = safeStr(resp?.authorizeUrl);
        if (!authorizeUrl) throw new Error("Missing authorize URL");
        popup.location.href = authorizeUrl;
        popup.focus();
      } catch (e: any) {
        try {
          popup.close();
        } catch {}
        setLoading(key, false);
        M?.toast?.({ html: e?.message || `Failed to start ${key} connect.`, classes: "red" });
      }

      const timer = window.setInterval(() => {
        try {
          if (popup.closed) {
            setLoading(key, false);
            window.clearInterval(timer);
          }
        } catch {
          setLoading(key, false);
          window.clearInterval(timer);
        }
      }, 500);
    },
    [api, setLoading]
  );

  const disconnectJira = useCallback(async () => {
    await api.disconnectJira();
    await refreshJiraStatus();
  }, [api, refreshJiraStatus]);

  useEffect(() => {
    function onOauthMessage(event: MessageEvent) {
      const type = safeStr((event as any)?.data?.type);
      if (type === "linkedin-connected") {
        setLoading("linkedin", false);
        void opts?.onConnected?.();
        M?.toast?.({ html: "LinkedIn connected.", classes: "green" });
      } else if (type === "discord-connected") {
        setLoading("discord", false);
        void opts?.onConnected?.();
        M?.toast?.({ html: "Discord connected.", classes: "green" });
      } else if (type === "jira-connected") {
        setLoading("jira", false);
        void opts?.onConnected?.();
        void refreshJiraStatus();
        M?.toast?.({ html: "Jira connected.", classes: "green" });
      } else if (type === "jira-error") {
        setLoading("jira", false);
        M?.toast?.({ html: safeStr((event as any)?.data?.message) || "Jira connect failed.", classes: "red" });
      } else if (type === "linkedin-error") {
        setLoading("linkedin", false);
      } else if (type === "discord-error") {
        setLoading("discord", false);
      }
    }
    window.addEventListener("message", onOauthMessage);
    return () => window.removeEventListener("message", onOauthMessage);
  }, [opts, refreshJiraStatus, setLoading]);

  return {
    status,
    loadingByKey,
    refreshJiraStatus,
    startConnect,
    disconnectJira,
  };
}
