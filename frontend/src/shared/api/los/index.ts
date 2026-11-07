export { getHandoff } from "./get-handoff";
import { LOS_API, LOS_HANDOFF_PATH } from "@/shared/config";

export type LosUser = {
  id: number;
  username: string;
  type: string;
  role: string;
  fullName: string;
};

export type LosLoginResult = {
  accessToken: string;
  user: LosUser;
};

/** Step 1 of sign-in: exchange LOS staff credentials for a LOS access token. */
export async function losLogin(username: string, password: string): Promise<LosLoginResult> {
  const res = await fetch(`${LOS_API}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message: string = body?.message ?? body?.error?.message ?? `LOS login failed (${res.status})`;
    throw new Error(message);
  }
  const body = await res.json();
  return body.data as LosLoginResult;
}

/** Step 2 of sign-in: exchange a LOS access token for a short-lived handoff token. */
export async function losHandoff(losToken: string): Promise<string> {
  const res = await fetch(`${LOS_API}${LOS_HANDOFF_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${losToken}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message: string = body?.message ?? body?.error?.message ?? `Handoff request failed (${res.status})`;
    throw new Error(message);
  }
  const body = await res.json();
  return body.data.token as string;
}
