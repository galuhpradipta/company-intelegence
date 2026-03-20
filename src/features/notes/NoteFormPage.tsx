import { useState, type FormEvent } from "react";
import { useLoaderData, useNavigate, Link, useParams } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import { useApi } from "../../shared/hooks/useApi.ts";
import { usePageTitle } from "../../shared/hooks/usePageTitle.ts";
import { useToastStore } from "../../shared/store/toastStore.ts";

type Note = {
  id: string;
  title: string;
  content: string;
};

export default function NoteFormPage() {
  const existing = useLoaderData() as Note | null;
  const { id } = useParams();
  const isEdit = !!id;
  usePageTitle(isEdit ? "Edit note" : "New note");

  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [loading, setLoading] = useState(false);
  const { post, put } = useApi();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await put(`/notes/${id}`, { title, content });
        addToast("Note updated", "success");
        navigate(`/notes/${id}`);
      } else {
        const note = await post<{ id: string }>("/notes", { title, content });
        addToast("Note created", "success");
        navigate(`/notes/${note.id}`);
      }
    } catch {
      // error toast from useApi
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Link
          to={isEdit ? `/notes/${id}` : "/"}
          className="flex items-center gap-1.5 text-app-text-muted hover:text-app-text transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <h1 className="font-bold text-lg text-app-text">
          {isEdit ? "Edit note" : "New note"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-app-text-muted uppercase tracking-wide">
            Title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-app-surface border border-app-border-subtle text-app-text placeholder:text-app-text-dim focus:outline-none focus:border-app-accent/50 transition-colors"
            placeholder="Note title"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-app-text-muted uppercase tracking-wide">
            Content
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 rounded-xl bg-app-surface border border-app-border-subtle text-app-text placeholder:text-app-text-dim focus:outline-none focus:border-app-accent/50 transition-colors resize-none"
            placeholder="Write something…"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-app-accent text-white font-bold text-base disabled:opacity-50 transition-opacity"
        >
          {loading ? "Saving…" : isEdit ? "Save changes" : "Create note"}
        </button>
      </form>
    </div>
  );
}
