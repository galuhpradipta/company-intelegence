import { X, CheckCircle, WarningCircle, Info } from "@phosphor-icons/react";
import { useToastStore } from "../shared/store/toastStore.ts";

const TypeIcon = ({ type }: { type: "success" | "error" | "info" }) => {
  if (type === "success") return <CheckCircle size={16} weight="fill" className="shrink-0" />;
  if (type === "error") return <WarningCircle size={16} weight="fill" className="shrink-0" />;
  return <Info size={16} weight="fill" className="shrink-0" />;
};

export default function Toast() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-24 left-0 right-0 flex flex-col gap-2 px-4 z-50 max-w-[430px] mx-auto pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`glass-panel flex items-center justify-between gap-3 px-4 py-3 rounded-xl border animate-slide-up pointer-events-auto ${
            toast.type === "error"
              ? "border-app-red/30 text-app-red"
              : toast.type === "success"
                ? "border-app-green/30 text-app-green"
                : "border-app-accent/20 text-app-text"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <TypeIcon type={toast.type} />
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss"
            className="text-app-text-muted hover:text-app-text transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
