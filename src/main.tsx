import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./index.css";
import { router } from "./router.ts";

import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import Toast from "./components/Toast.tsx";

// eslint-disable-next-line react-refresh/only-export-components
function PageLoader() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-1 items-center justify-center">
      <div className="animate-pulse-accent w-8 h-8 rounded-full border-2 border-app-accent/40" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toast />
    </ErrorBoundary>
  </StrictMode>,
);
