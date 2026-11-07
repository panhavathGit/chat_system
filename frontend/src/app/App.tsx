import { useEffect, useState } from "react";
import { ApplicationsPage } from "@/pages/applications";
import { ChatPage } from "@/pages/chat";
import { CustomerCallDialog } from "@/features/customer-call";
import { SignInPage } from "@/features/sign-in";
import { Toaster } from "@/shared/ui";
import { isChatBackend } from "@/shared/config";
import { useSessionStore, wireSessionToFetchClient } from "@/entities/session";
import { startRealtime } from "./realtime/realtime";

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const accessToken = useSessionStore((s) => s.accessToken);
  const hasSession = !isChatBackend || accessToken !== null;

  // Wire the fetch client once so it can read the token and renew on 401.
  useEffect(() => {
    if (isChatBackend) wireSessionToFetchClient();
  }, []);

  // Start realtime only once a session exists (or immediately in mock mode).
  useEffect(() => {
    if (!hasSession) return;
    const teardown = startRealtime();
    return teardown;
  }, [hasSession]);

  if (!hasSession) {
    return (
      <>
        <SignInPage />
        <Toaster />
      </>
    );
  }

  return (
    <>
      {expanded ? (
        <ApplicationsPage onClose={() => setExpanded(false)} />
      ) : (
        <ChatPage onExpand={() => setExpanded(true)} />
      )}
      <CustomerCallDialog />
      <Toaster />
    </>
  );
}
