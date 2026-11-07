export { assets } from "./assets";
export { CHAT_API, LOS_API, LOS_HANDOFF_PATH, AUTH_MODE, TRANSPORT, isChatBackend } from "./env";

/** Step-1 feature flags. Set step2 = true when the backend supports it. */
export const features = {
  step2: false,
} as const;
