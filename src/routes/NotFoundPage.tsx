import { Link } from "react-router";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { usePageTitle } from "../shared/hooks/usePageTitle.ts";

export default function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <main className="flex flex-col flex-1 items-center justify-center gap-4 px-6 text-center app-bg min-h-svh">
      <MagnifyingGlass size={48} className="text-app-text-dim animate-float" />
      <h1 className="font-bold text-3xl text-app-text">Page not found</h1>
      <p className="text-app-text-muted">That page doesn't exist.</p>
      <Link
        to="/"
        className="px-5 py-2.5 rounded-xl bg-app-accent text-white font-bold text-sm mt-2"
      >
        Back to home
      </Link>
    </main>
  );
}
