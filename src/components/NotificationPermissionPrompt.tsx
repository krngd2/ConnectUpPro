"use client";
import { useEffect, useState } from "react";

export function NotificationPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    if (Notification.permission === "default") {
      // Show prompt after small delay
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  const requestPermission = async () => {
    try {
      if (!("Notification" in window)) return;
      const result = await Notification.requestPermission();
      setPermission(result);
      setVisible(false);
    } catch (e) {
      console.error("[NOTIFICATIONS] Permission request failed", e);
      setVisible(false);
    }
  };

  if (!visible || permission !== "default") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded border bg-background shadow-lg p-4 text-sm">
      <h4 className="font-semibold mb-2">Enable Analysis Notifications</h4>
      <p className="mb-3 text-muted-foreground">
        Get a browser notification when your video analysis finishes.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setVisible(false)}
          className="px-3 py-1 text-xs border rounded"
        >
          Later
        </button>
        <button
          onClick={requestPermission}
          className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground"
        >
          Enable
        </button>
      </div>
    </div>
  );
}

export default NotificationPermissionPrompt;
