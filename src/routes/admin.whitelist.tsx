import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Trash2, Plus, ShieldCheck } from "lucide-react";
import { useIsAdmin, useMyRoles, useWhitelist, useAddToWhitelist, useRemoveFromWhitelist } from "@/store/roles";

export const Route = createFileRoute("/admin/whitelist")({
  head: () => ({ meta: [{ title: "Whitelist — Admin" }] }),
  component: WhitelistAdmin,
});

function WhitelistAdmin() {
  const { isLoading } = useMyRoles();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const { data: list = [], isLoading: loadingList } = useWhitelist();
  const addMut = useAddToWhitelist();
  const removeMut = useRemoveFromWhitelist();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/" });
  }, [isLoading, isAdmin, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    try {
      await addMut.mutateAsync(email);
      setEmail("");
    } catch (err: any) {
      setError(err?.message ?? "Erro ao adicionar.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 md:py-12">
      <Link to="/" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Home
      </Link>

      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Whitelist</h1>
          <p className="text-sm text-muted-foreground">Apenas e-mails listados podem se cadastrar.</p>
        </div>
      </header>

      <form onSubmit={onAdd} className="flex gap-2 rounded-2xl border border-border bg-card p-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@dominio.com"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={addMut.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className="mt-6 space-y-2">
        {loadingList ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Nenhum e-mail na whitelist ainda.
          </p>
        ) : (
          list.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="truncate text-sm">{w.email}</span>
              <button
                onClick={() => removeMut.mutate(w.id)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
