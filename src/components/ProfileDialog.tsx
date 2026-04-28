import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useProfile, useUpdateProfile } from "@/store/profile";
import { useTheme, type Theme } from "@/store/theme";
import { useAuth } from "@/store/auth";
import { User, Sun, Moon, Contrast, Check } from "lucide-react";
import { PasskeyManager } from "./PasskeyManager";

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");

  useEffect(() => {
    if (open) {
      setName(profile?.displayName ?? "");
      setAvatar(profile?.avatarUrl ?? "");
    }
  }, [open, profile]);

  const save = () => {
    update.mutate(
      {
        displayName: name.trim() || null,
        avatarUrl: avatar.trim() || null,
      },
      { onSuccess: () => onClose() },
    );
  };

  const initials = (name || profile?.displayName || user?.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const themes: { value: Theme; label: string; icon: typeof Sun; description: string }[] = [
    { value: "light", label: "Claro", icon: Sun, description: "Fundo branco" },
    { value: "dark", label: "Escuro", icon: Moon, description: "Padrão" },
    { value: "high-contrast", label: "Alto contraste", icon: Contrast, description: "WCAG AAA" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Meu perfil">
      <div className="space-y-5">
        {/* Avatar + email */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-primary text-xl font-bold text-primary-foreground shadow-glow">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              initials || <User className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile?.displayName ?? "Sem nome"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <Field label="Nome de exibição">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como devemos te chamar?"
            className={inputClass}
            maxLength={80}
          />
        </Field>

        <Field label="URL do avatar (opcional)">
          <input
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://…"
            className={inputClass}
            maxLength={500}
            inputMode="url"
          />
        </Field>

        {/* Tema */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tema do app
          </p>
          <div role="radiogroup" aria-label="Tema do app" className="grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const Icon = t.icon;
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(t.value)}
                  className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {active && (
                    <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-primary" />
                  )}
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{t.label}</span>
                  <span className="text-[10px] text-muted-foreground">{t.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Segurança / Biometria */}
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Segurança
          </p>
          <PasskeyManager />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={update.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {update.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
