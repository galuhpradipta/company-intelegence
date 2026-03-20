import { redirect } from "react-router";
import { useAuthStore } from "../store/authStore.ts";
import { useToastStore } from "../store/toastStore.ts";

const BASE = "/api";

export async function apiFetch<T = unknown>(path: string): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers });

  if (res.status === 401) {
    useToastStore.getState().addToast("Session expired. Please sign in again.", "info");
    useAuthStore.getState().clearAuth();
    throw redirect("/login");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export async function loadOr<T>(fetcher: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fetcher();
  } catch (e) {
    if (e instanceof Response) throw e;
    return fallback;
  }
}
