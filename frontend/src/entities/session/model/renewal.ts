import { getHandoff, apiCreateSession, chatSocket, configureFetchClient } from "@/shared/api";
import { useSessionStore } from "./session-store";

let renewalTimer: ReturnType<typeof setTimeout> | null = null;

/** Shared in-flight promise so concurrent 401s reuse the same renewal. */
let _renewInFlight: Promise<string> | null = null;

/** Runs steps 2+3: get a new handoff token from LOS and exchange it for a chat session. */
export function renewSession(): Promise<string> {
  if (_renewInFlight) return _renewInFlight;

  _renewInFlight = (async () => {
    const { losToken } = useSessionStore.getState();
    if (!losToken) throw new Error("LOS token missing — user must sign in again");

    const handoffToken = await getHandoff(losToken);
    const session = await apiCreateSession(handoffToken);

    useSessionStore.getState().setSession(session.accessToken, session.expiresIn, session.user);
    scheduleRenewal();

    // Reconnect socket with the new token
    chatSocket.connect(session.accessToken);

    return session.accessToken;
  })().finally(() => {
    _renewInFlight = null;
  });

  return _renewInFlight;
}

/** Schedule the next renewal 60 s before the token expires. */
export function scheduleRenewal() {
  if (renewalTimer) clearTimeout(renewalTimer);
  const { expiresAt } = useSessionStore.getState();
  if (!expiresAt) return;
  const delay = Math.max(0, expiresAt - Date.now() - 60_000);
  renewalTimer = setTimeout(() => {
    renewSession().catch(() => {
      // LOS token likely expired; force sign-out
      useSessionStore.getState().clear();
    });
  }, delay);
}

/** Cancel the renewal timer (call on sign-out). */
export function cancelRenewal() {
  if (renewalTimer) {
    clearTimeout(renewalTimer);
    renewalTimer = null;
  }
}

/** Wire the fetch client so it can call renewSession() on 401. */
export function wireSessionToFetchClient() {
  configureFetchClient(
    () => useSessionStore.getState().accessToken,
    renewSession,
  );
}
