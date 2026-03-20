import { AlertDialog } from "@base-ui/react/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warn";
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warn",
  onConfirm,
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="animate-overlay-fade-in fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <AlertDialog.Popup className="glass-panel fixed left-1/2 top-1/2 z-50 w-[min(90vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl border border-app-border">
          <AlertDialog.Title className="font-bold text-lg text-app-text mb-2">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-app-text-muted mb-6">
            {description}
          </AlertDialog.Description>
          <div className="flex gap-3">
            <AlertDialog.Close className="flex-1 py-2.5 rounded-xl border border-app-border-subtle text-app-text-muted text-sm font-medium transition-colors hover:border-app-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-border focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg">
              {cancelLabel}
            </AlertDialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg ${
                variant === "danger"
                  ? "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 focus-visible:ring-red-400"
                  : "bg-app-accent/20 border border-app-accent/50 text-app-accent hover:bg-app-accent/30 focus-visible:ring-app-accent"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
