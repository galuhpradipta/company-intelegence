import { createBrowserRouter, redirect } from "react-router";
import { useAuthStore } from "./shared/store/authStore.ts";
import { apiFetch, loadOr } from "./shared/utils/apiFetch.ts";
import Layout from "./components/Layout.tsx";

function requireAuth() {
  const token = useAuthStore.getState().token;
  if (!token) throw redirect("/login");
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: async () => {
      const { default: Component } = await import("./features/auth/LoginPage.tsx");
      return { Component };
    },
  },
  {
    path: "/register",
    lazy: async () => {
      const { default: Component } = await import("./features/auth/RegisterPage.tsx");
      return { Component };
    },
  },
  {
    loader: requireAuth,
    Component: Layout,
    children: [
      {
        index: true,
        loader: () => loadOr(() => apiFetch("/notes"), [] as unknown[]),
        lazy: async () => {
          const { default: Component } = await import("./routes/HomePage.tsx");
          return { Component };
        },
      },
      {
        path: "notes/new",
        loader: () => null,
        lazy: async () => {
          const { default: Component } = await import("./features/notes/NoteFormPage.tsx");
          return { Component };
        },
      },
      {
        path: "notes/:id",
        loader: ({ params }) => loadOr(() => apiFetch(`/notes/${params.id}`), null),
        lazy: async () => {
          const { default: Component } = await import("./features/notes/NoteDetailPage.tsx");
          return { Component };
        },
      },
      {
        path: "notes/:id/edit",
        loader: ({ params }) => loadOr(() => apiFetch(`/notes/${params.id}`), null),
        lazy: async () => {
          const { default: Component } = await import("./features/notes/NoteFormPage.tsx");
          return { Component };
        },
      },
    ],
  },
  {
    path: "*",
    lazy: async () => {
      const { default: Component } = await import("./routes/NotFoundPage.tsx");
      return { Component };
    },
  },
]);
