import { useAccounts } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { Building2, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Global account selector. Sits in the side nav (desktop) and on top of pages on mobile.
 * Sets the global filter that drives data filtering across the app.
 */
export function AccountSwitcher({ compact = false }: { compact?: boolean }) {
  const { data: accounts = [] } = useAccounts();
  const { accountId, setAccountId } = useAccountFilter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // If selected account is removed elsewhere, fall back to "all".
  useEffect(() => {
    if (accountId && accounts.length > 0 && !accounts.find((a) => a.id === accountId)) {
      setAccountId(null);
    }
  }, [accountId, accounts, setAccountId]);

  const current = accountId ? accounts.find((a) => a.id === accountId) : null;
  const label = current?.name ?? "Todas as contas";
  const color = current?.color ?? "var(--primary)";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {current ? (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        ) : (
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate font-medium">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-elevated">
          <button
            onClick={() => {
              setAccountId(null);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-secondary ${
              !accountId ? "bg-secondary font-semibold" : ""
            }`}
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Todas as contas
          </button>
          {accounts.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">Nenhuma conta cadastrada.</p>
          )}
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAccountId(a.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-secondary ${
                accountId === a.id ? "bg-secondary font-semibold" : ""
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
              <span className="flex-1 truncate text-left">{a.name}</span>
              <span className="text-[10px] uppercase text-muted-foreground">{a.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
