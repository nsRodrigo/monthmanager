import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Palette } from "lucide-react";
import { useTheme, type Theme } from "@/store/theme";
import { HeaderBand } from "@/components/HeaderBand";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/aparencia")({
  head: () => ({ meta: [{ title: "Aparência — Finanças" }] }),
  component: AparenciaPage,
});

const THEMES: {
  value: Theme;
  label: string;
  description: string;
  accent: string;
  bg: string;
}[] = [
  { value: "dark", label: "Esmeralda Noite", description: "Verde profundo — padrão", accent: "#3ddc97", bg: "#0a0f0e" },
  { value: "indigo", label: "Índigo Grafite", description: "Azul-noite, mais frio", accent: "#7c9cff", bg: "#0b0d14" },
  { value: "grafite", label: "Grafite Marfim", description: "Neutro, cor só nos dados", accent: "#e8dfc8", bg: "#0d0d0c" },
  { value: "light", label: "Claro", description: "Fundo branco", accent: "#1f9d6b", bg: "#fafcfb" },
  { value: "high-contrast", label: "Alto contraste", description: "WCAG AAA", accent: "#e6ff00", bg: "#000000" },
];

/**
 * Tela própria para o tema visual do app — antes era uma seção dentro de
 * "Meu perfil", junto de dados pessoais e segurança, com dois botões
 * diferentes (o avatar do cabeçalho e "Sistema visual" no Mais) levando pro
 * mesmo lugar. Agora cada um leva pra sua própria tela: o avatar continua
 * indo para "Meu perfil" (dados/segurança/contas), e "Aparência" no Mais
 * leva só até aqui.
 */
function AparenciaPage() {
  const { theme, setTheme, navSystemBg, setNavSystemBg } = useTheme();
  const navigate = useNavigate();

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background">
        <HeaderBand title="Aparência" onBack={() => navigate({ to: "/mais" })} />
      </div>
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-24 sm:px-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Palette className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-display text-[15px] font-semibold">Tema</h2>
          </div>
          <div role="radiogroup" aria-label="Tema do app" className="grid grid-cols-2 gap-2.5">
            {THEMES.map((t) => {
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(t.value)}
                  className={`flex flex-col gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-ring/40"
                  }`}
                >
                  <span className="flex gap-1.5" aria-hidden="true">
                    <i className="h-6 w-6 rounded-lg" style={{ background: t.accent }} />
                    <i className="h-6 flex-1 rounded-lg border border-white/10" style={{ background: t.bg }} />
                  </span>
                  <span>
                    <span className="flex items-center gap-1 text-[13px] font-semibold">
                      {t.label}
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">{t.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">Barra inferior no tom do sistema</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                Fundo preto (ou branco, no claro) igual à faixa de gestos do celular, em vez da cor deste tema.
              </span>
            </span>
            <Switch checked={navSystemBg} onCheckedChange={setNavSystemBg} />
          </label>
        </section>
      </div>
    </div>
  );
}
