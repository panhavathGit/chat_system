/** Typed access to Vite env vars. */

export const CHAT_API = import.meta.env.VITE_CHAT_API_URL ?? "http://localhost:3000";
export const LOS_API = import.meta.env.VITE_LOS_API_URL ?? "";
export const LOS_HANDOFF_PATH =
  import.meta.env.VITE_LOS_HANDOFF_PATH ?? "/admin/dashboard-embed/handoff-token";
export const AUTH_MODE: "standalone" | "embedded" =
  import.meta.env.VITE_AUTH_MODE === "embedded" ? "embedded" : "standalone";

/** "chat-backend" uses the real API + Socket.io; anything else uses the in-browser mock. */
export const TRANSPORT: "chat-backend" | "mock" =
  import.meta.env.VITE_TRANSPORT === "chat-backend" ? "chat-backend" : "mock";

export const isChatBackend = TRANSPORT === "chat-backend";
