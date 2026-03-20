import { useState } from "react";
import { useLoaderData, Link, useRevalidator } from "react-router";
import { NotePencil, Trash, ArrowRight } from "@phosphor-icons/react";
import { useAuthStore } from "../shared/store/authStore.ts";
import { useApi } from "../shared/hooks/useApi.ts";
import { usePageTitle } from "../shared/hooks/usePageTitle.ts";
import { useToastStore } from "../shared/store/toastStore.ts";
import ConfirmDialog from "../components/ConfirmDialog.tsx";

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function HomePage() {
  usePageTitle("Home");
  const user = useAuthStore((s) => s.user);
  const notes = useLoaderData() as Note[];
  const { del } = useApi();
  const revalidator = useRevalidator();
  const addToast = useToastStore((s) => s.addToast);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setDeletingId(id);
    try {
      await del(`/notes/${id}`);
      addToast("Note deleted", "success");
      revalidator.revalidate();
    } catch {
      // error toast from useApi
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl text-app-text">
            Hey, {user?.displayName?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-app-text-muted text-sm mt-0.5">Your notes</p>
        </div>
        <Link
          to="/notes/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-white text-sm font-semibold"
        >
          <NotePencil size={16} weight="fill" />
          New
        </Link>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <NotePencil size={40} className="text-app-text-dim animate-float" />
          <p className="text-app-text-muted text-sm">No notes yet.</p>
          <Link
            to="/notes/new"
            className="px-5 py-2.5 rounded-xl bg-app-accent text-white font-bold text-sm"
          >
            Create your first note
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-app-surface border border-app-border-subtle"
            >
              <Link
                to={`/notes/${note.id}`}
                className="flex-1 flex items-center justify-between hover:opacity-80 transition-opacity min-w-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-app-text truncate">{note.title}</p>
                  {note.content && (
                    <p className="text-xs text-app-text-muted truncate mt-0.5">{note.content}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs text-app-text-dim">{formatDate(note.updatedAt)}</span>
                  <ArrowRight size={14} className="text-app-text-dim" />
                </div>
              </Link>
              <button
                onClick={() => setPendingDeleteId(note.id)}
                disabled={deletingId === note.id}
                className="p-1.5 rounded-lg text-app-text-dim hover:text-app-red transition-colors disabled:opacity-50"
                aria-label="Delete note"
              >
                <Trash size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="Delete this note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
