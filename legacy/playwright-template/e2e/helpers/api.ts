import type { APIRequestContext, Page } from "@playwright/test";

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type RegisteredUser = {
  email: string;
  password: string;
  displayName: string;
  user: AuthUser;
  token: string;
};

export type StoredAuthSession = {
  user: AuthUser;
  token: string;
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function installAuthState(page: Page, session: StoredAuthSession) {
  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem(
        "vcs-auth",
        JSON.stringify({ state: { user, token }, version: 0 }),
      );
    },
    { user: session.user, token: session.token },
  );
}

export async function registerUser(
  request: APIRequestContext,
  overrides: { email?: string; password?: string; displayName?: string } = {},
): Promise<RegisteredUser> {
  const ts = Date.now();
  const email = overrides.email ?? `user-${ts}@playwright.test`;
  const password = overrides.password ?? "testpass123";
  const displayName = overrides.displayName ?? "Tester";

  const res = await request.post("/api/auth/register", {
    data: { email, password, displayName },
  });
  const data = await res.json();
  return { email, password, displayName, ...data };
}

export async function createNote(
  request: APIRequestContext,
  token: string,
  note: { title: string; content?: string },
) {
  const res = await request.post("/api/notes", {
    headers: authHeaders(token),
    data: note,
  });
  return res.json() as Promise<{ id: string; title: string; content: string }>;
}

export async function deleteNote(
  request: APIRequestContext,
  token: string,
  noteId: string,
) {
  return request.delete(`/api/notes/${noteId}`, {
    headers: authHeaders(token),
  });
}
