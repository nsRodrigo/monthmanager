import { Modal } from "./Modal";
import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirmar ação",
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
}) {
  const handle = async () => {
    await onConfirm();
  };
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {variant === "destructive" && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="text-xs text-foreground">
              <p className="font-semibold text-destructive">Esta ação é irreversível.</p>
              <div className="mt-1 text-muted-foreground">{description}</div>
            </div>
          </div>
        )}
        {variant !== "destructive" && (
          <div className="text-sm text-foreground">{description}</div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 ${
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {loading ? "Processando…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
