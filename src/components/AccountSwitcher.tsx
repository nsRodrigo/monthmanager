import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, ChevronDown, Clock, KeyRound, User, X } from "lucide-react";
import { inputClass } from "@/components/Modal";
import { useAuth } from "@/store/auth";
import { useProfile } from "@/store/profile";
import { useViewingAs } from "@/store/account-view";
import { useOutgoingGrants, useRequestAccess, useCancelAccessRequest } from "@/store/account-access";
import { supabase } from "@/integrations/supabase/client";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Busca o nome de exibição de outra conta (uma vez, ao trocar — não é um hook). */
async function fetchDisplayName(userId: string, fallback: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
  return data?.display_name?.trim() || fallback;
}

/**
 * Seletor de conta — "Sua conta" + contas com acesso liberado (concedidas via
 * pedido em `useRequestAccess`) + formulário pra pedir acesso a mais uma.
 * `variant="dropdown"` é o chip de perfil da sidebar (clica pra abrir por
 * cima); `variant="inline"` é a mesma lista sempre visível, usada em
 * `/perfil` (que não tem essa sidebar).
 */
export function AccountSwitcher({ variant }: { variant: "dropdown" | "inline" }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [viewingAs, setViewingAs] = useViewingAs();
  const { data: outgoing = [] } = useOutgoingGrants();
  const requestAccess = useRequestAccess();
  const cancelRequest = useCancelAccessRequest();
  const navigate = useNavigate();

  const [open, setOpen] = useState(variant === "inline");
  const [formOpen, setFormOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function computePos() {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = 288;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPos({ left, bottom: window.innerHeight - rect.top + 6, width });
  }

  function openDropdown() {
    computePos();
    setOpen(true);
  }

  // Painel roda num portal (fora da sidebar, que tem overflow-hidden — sem
  // isso o dropdown ficava cortado na borda da coluna). Por estar fora da
  // subárvore do trigger, "clique fora" precisa checar os dois refs.
  useEffect(() => {
    if (variant !== "dropdown" || !open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onResize() {
      computePos();
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("resize", onResize);
    };
  }, [variant, open]);

  if (!user) return null;

  const ownName = profile?.displayName?.trim() || user.email?.split("@")[0] || "Você";
  const activeName = viewingAs?.name ?? ownName;
  const activeEmail = viewingAs?.email ?? user.email ?? "";
  const granted = outgoing.filter((g) => g.status === "active");
  const pending = outgoing.filter((g) => g.status === "pending");

  async function selectOwnAccount() {
    setViewingAs(null);
    setOpen(false);
  }

  async function selectGranted(ownerId: string, ownerEmail: string) {
    const name = await fetchDisplayName(ownerId, ownerEmail);
    setViewingAs({ userId: ownerId, email: ownerEmail, name });
    setOpen(false);
  }

  async function submitRequest() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    try {
      await requestAccess.mutateAsync(trimmed);
      toast.success(`Pedido enviado para ${trimmed}.`);
      setEmail("");
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar o pedido.");
    }
  }

  const list = (
    <div>
      <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        Sua conta
      </p>
      <button
        type="button"
        onClick={selectOwnAccount}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
          {initialsOf(ownName) || <User className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{ownName}</p>
          <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
        </span>
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
            !viewingAs ? "bg-gradient-primary text-primary-foreground" : "border border-border"
          }`}
        >
          {!viewingAs && <Check className="h-3 w-3" />}
        </span>
      </button>

      <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        Contas com acesso liberado
      </p>
      {granted.length === 0 ? (
        <p className="px-3 pb-2 text-xs text-muted-foreground">
          Peça acesso a outra conta que já use o app abaixo.
        </p>
      ) : (
        granted.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => selectGranted(g.ownerId, g.ownerEmail)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-secondary text-[10px] font-bold">
              {initialsOf(g.ownerEmail.split("@")[0])}
            </span>
            <span className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{g.ownerEmail}</p>
              <p className="truncate text-[10px] text-muted-foreground">Acesso concedido</p>
            </span>
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                viewingAs?.userId === g.ownerId ? "bg-gradient-primary text-primary-foreground" : "border border-border"
              }`}
            >
              {viewingAs?.userId === g.ownerId && <Check className="h-3 w-3" />}
            </span>
          </button>
        ))
      )}

      {pending.length > 0 && (
        <>
          <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Pedidos enviados
          </p>
          {pending.map((g) => (
            <div key={g.id} className="flex items-center gap-2.5 px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                {initialsOf(g.ownerEmail.split("@")[0])}
              </span>
              <span className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{g.ownerEmail}</p>
                <p className="flex items-center gap-1 truncate text-[10px] text-warning">
                  <Clock className="h-3 w-3" /> Aguardando confirmação
                </p>
              </span>
              <button
                type="button"
                onClick={() => cancelRequest.mutate(g.id)}
                disabled={cancelRequest.isPending}
                aria-label="Cancelar pedido"
                title="Cancelar pedido"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </>
      )}

      <div className="px-3 py-2">
        {!formOpen ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
          >
            <KeyRound className="h-3.5 w-3.5" /> Pedir acesso a outra conta
          </button>
        ) : (
          <div className="space-y-2 rounded-lg border border-border bg-background p-2.5">
            <label className="block text-[10px] font-semibold text-muted-foreground">
              E-mail de quem já usa o app
            </label>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@exemplo.com"
              className={`${inputClass} py-1.5 text-xs`}
            />
            {error && <p className="text-[11px] text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setError(null);
                }}
                className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitRequest}
                disabled={requestAccess.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                Enviar pedido
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate({ to: "/perfil" });
          }}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <User className="h-3.5 w-3.5" /> Meu perfil
        </button>
      </div>
    </div>
  );

  if (variant === "inline") {
    return <div className="rounded-xl border border-border bg-card overflow-hidden">{list}</div>;
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        aria-label="Trocar de conta"
        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-secondary"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
          {viewingAs ? (
            initialsOf(activeName)
          ) : profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          ) : (
            initialsOf(ownName) || <User className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold whitespace-nowrap">{activeName}</p>
          <p className="truncate text-[10px] text-muted-foreground whitespace-nowrap">{activeEmail}</p>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[100] overflow-hidden rounded-xl border border-border bg-popover shadow-elevated"
            style={{ left: pos.left, bottom: pos.bottom, width: pos.width }}
          >
            {list}
          </div>,
          document.body,
        )}
    </div>
  );
}
