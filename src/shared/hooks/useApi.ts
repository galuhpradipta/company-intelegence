import { useCallback } from "react";
import { useAuthStore } from "../store/authStore.ts";
import { useToastStore } from "../store/toastStore.ts";

const BASE = "/api";

export function useApi() {
  const { token } = useAuthStore();

  const request = useCallback(async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const message = (err as { error?: string }).error ?? res.statusText;
      useToastStore.getState().addToast(message, "error");
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  }, [token]);

  const get = useCallback(<T>(path: string) => request<T>("GET", path), [request]);
  const post = useCallback(<T>(path: string, body: unknown) => request<T>("POST", path, body), [request]);
  const put = useCallback(<T>(path: string, body: unknown) => request<T>("PUT", path, body), [request]);
  const del = useCallback(<T>(path: string) => request<T>("DELETE", path), [request]);

  return { get, post, put, del };
}
