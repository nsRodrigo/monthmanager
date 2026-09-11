import { ArrowLeftRight, ShieldCheck } from "lucide-react";
import { useViewingAs } from "@/store/account-view";

/** Aviso fixo — sempre visível enquanto se está "vendo" outra conta via concessão de acesso. */
export function AdminViewingBanner() {
  const [viewingAs, setViewingAs] = useViewingAs();
  if (!viewingAs) return null;

  return (
    <div className="flex items-center gap-2.5 border-b border-credit/30 bg-credit/10 px-4 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-credit/20 text-credit">
        <ShieldCheck className="h-3.5 w-3.5" />
      </span>
      <p className="min-w-0 flex-1 truncate text-xs font-semibold">
        Vendo a conta de <span className="text-credit">{viewingAs.name}</span>
      </p>
      <button
        type="button"
        onClick={() => setViewingAs(null)}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary"
      >
        <ArrowLeftRight className="h-3 w-3" /> Voltar para minha conta
      </button>
    </div>
  );
}
