import { create } from "zustand";
import type { CbSessionUser } from "@/shared/api";

export type SessionState = {
  /** The chat-backend access token. null = not signed in. */
  accessToken: string | null;
  /** When the chat-backend token expires (ms since epoch). */
  expiresAt: number | null;
  /** LOS access token — kept only long enough to get new handoffs. Never sent to chat-backend. */
  losToken: string | null;
  /** Signed-in staff user. */
  user: CbSessionUser | null;

  setSession: (token: string, expiresIn: string, user: CbSessionUser) => void;
  setLosToken: (token: string) => void;
  clear: () => void;
};

/** Parses "15m" / "3600s" / "2h" / "1d" / "3600" into milliseconds. */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])?$/);
  if (!match) return 15 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2] ?? "s";
  if (unit === "m") return value * 60 * 1000;
  if (unit === "h") return value * 60 * 60 * 1000;
  if (unit === "d") return value * 24 * 60 * 60 * 1000;
  return value * 1000;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  expiresAt: null,
  losToken: null,
  user: null,

  setSession: (token, expiresIn, user) => {
    const expiresAt = Date.now() + parseExpiresIn(expiresIn);
    set({ accessToken: token, expiresAt, user });
  },

  setLosToken: (token) => set({ losToken: token }),

  clear: () => set({ accessToken: null, expiresAt: null, losToken: null, user: null }),
}));
