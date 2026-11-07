import { useState, type FormEvent } from "react";
import { losLogin } from "@/shared/api";
import { apiCreateSession } from "@/shared/api";
import { useSessionStore, scheduleRenewal, wireSessionToFetchClient } from "@/entities/session";
import { getHandoff } from "../model/get-handoff";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      // Step 1: LOS login
      const losResult = await losLogin(username.trim(), password);
      const losToken = losResult.accessToken;
      useSessionStore.getState().setLosToken(losToken);

      // Steps 2 + 3: handoff → chat session
      const handoffToken = await getHandoff(losToken);
      const session = await apiCreateSession(handoffToken);

      // Persist session and start renewal timer
      useSessionStore.getState().setSession(session.accessToken, session.expiresIn, session.user);
      wireSessionToFetchClient();
      scheduleRenewal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="sign-in-page">
      <div className="sign-in-card">
        <h1>Sign in with LOS</h1>
        <form onSubmit={handleSubmit} className="sign-in-form">
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>
          {error && <p className="sign-in-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
