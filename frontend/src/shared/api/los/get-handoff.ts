import { AUTH_MODE } from "@/shared/config";
import { losHandoff } from "./index";

/**
 * Returns a handoff token ready for step 3 (POST /auth/session).
 *
 * Standalone mode:  calls LOS /admin/dashboard-embed/handoff-token with the LOS token.
 * Embedded mode:   waits for the parent window to send CHAT_AUTH_HANDOFF via postMessage.
 *                  Requires VITE_LOS_WEB_ORIGIN to be set — throws immediately if missing.
 */
export async function getHandoff(losToken: string): Promise<string> {
  if (AUTH_MODE === "embedded") {
    return getHandoffEmbedded();
  }
  return losHandoff(losToken);
}

function getHandoffEmbedded(): Promise<string> {
  const LOS_WEB_ORIGIN = import.meta.env.VITE_LOS_WEB_ORIGIN;
  if (!LOS_WEB_ORIGIN) {
    return Promise.reject(
      new Error("VITE_LOS_WEB_ORIGIN must be set when VITE_AUTH_MODE=embedded"),
    );
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Handoff token timeout"));
    }, 10_000);

    function handler(event: MessageEvent) {
      if (event.origin !== LOS_WEB_ORIGIN) return;
      if (event.data?.type !== "CHAT_AUTH_HANDOFF") return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(event.data.token as string);
    }

    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "CHAT_READY" }, LOS_WEB_ORIGIN);
  });
}
