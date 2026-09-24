import { Link } from "@tanstack/react-router";
import { Search, User } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useProfile } from "@/store/profile";
import { searchPalette } from "@/store/search";

/** Busca (Ctrl K) e atalho do perfil — canto direito do cabeçalho de cada tela. */
export function HeaderActions() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const displayName = profile?.displayName || user?.email?.split("@")[0] || "Você";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={searchPalette.open}
        aria-label="Buscar (Ctrl K)"
        title="Buscar — Ctrl K"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
      <Link
        to="/perfil"
        aria-label="Meu perfil"
        title="Meu perfil"
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-bold text-primary transition-colors hover:border-ring/40"
      >
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          initials || <User className="h-4 w-4" aria-hidden="true" />
        )}
      </Link>
    </div>
  );
}
