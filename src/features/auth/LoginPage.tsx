import { useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router";
import { Cube } from "@phosphor-icons/react";
import { useAuthStore } from "../../shared/store/authStore.ts";
import { usePageTitle } from "../../shared/hooks/usePageTitle.ts";
import { APP_NAME } from "../../shared/config.ts";

export default function LoginPage() {
  usePageTitle("Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const submitButton = (e.currentTarget as HTMLFormElement).querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Signing in…";
    }
    flushSync(() => {
      setError("");
      setLoading(true);
    });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      setAuth(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col flex-1 items-center justify-center px-6 py-12 app-bg min-h-svh">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-app-surface border border-app-border flex items-center justify-center mb-4">
            <Cube size={32} weight="fill" className="text-app-accent" />
          </div>
          <h1 className="font-bold text-2xl text-app-text">Welcome back</h1>
          <p className="text-app-text-muted text-sm mt-1">Sign in to {APP_NAME}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-app-text-muted uppercase tracking-wide">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-app-surface border border-app-border-subtle text-app-text placeholder:text-app-text-dim focus:outline-none focus:border-app-accent/50 transition-colors"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-app-text-muted uppercase tracking-wide">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-app-surface border border-app-border-subtle text-app-text placeholder:text-app-text-dim focus:outline-none focus:border-app-accent/50 transition-colors"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p role="alert" className="text-app-red text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-app-accent text-white font-bold text-base disabled:opacity-50 transition-opacity mt-1"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-app-text-muted text-sm mt-6">
          No account?{" "}
          <Link to="/register" className="text-app-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
