import { useState } from "react";
import { useLoaderData, useNavigate, Link } from "react-router";
import { PencilSimple, Trash, ArrowLeft } from "@phosphor-icons/react";
import { useApi } from "../../shared/hooks/useApi.ts";
import { usePageTitle } from "../../shared/hooks/usePageTitle.ts";
import { useToastStore } from "../../shared/store/toastStore.ts";
import ConfirmDialog from "../../components/ConfirmDialog.tsx";

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export default function NoteDetailPage() {
  const note = useLoaderData() as Note;
  usePageTitle(note?.title);
  const { del } = useApi();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleDelete() {
    try {
      await del(`/notes/${note.id}`);
      addToast("Note deleted", "success");
      navigate("/");
    } catch {
      // error toast from useApi
    }
  }

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-app-text-muted">Note not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-app-text-muted hover:text-app-text transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/notes/${note.id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-surface border border-app-border-subtle text-app-text-muted hover:text-app-text text-sm transition-colors"
          >
            <PencilSimple size={14} />
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-surface border border-app-border-subtle text-app-text-dim hover:text-app-red text-sm transition-colors"
          >
            <Trash size={14} />
            Delete
          </button>
        </div>
      </div>

      <h1 className="font-bold text-2xl text-app-text">{note.title}</h1>

      {note.content ? (
        <p className="text-app-text-muted text-sm leading-relaxed whitespace-pre-wrap">
          {note.content}
        </p>
      ) : (
        <p className="text-app-text-dim text-sm italic">No content.</p>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete this note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
