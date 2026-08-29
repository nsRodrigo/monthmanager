import { Wallet } from "lucide-react";

const SIZES = {
  sm: { box: "h-9 w-9 rounded-xl", icon: "h-5 w-5" },
  md: { box: "h-12 w-12 rounded-2xl", icon: "h-6 w-6" },
  lg: { box: "h-16 w-16 rounded-2xl", icon: "h-8 w-8" },
} as const;

/**
 * Selo do app (ícone Wallet em box com o gradiente primário) — antes
 * duplicado em cada tela que precisava exibir a marca.
 */
export function Logo({ size = "sm" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-primary shadow-glow ${s.box}`}
    >
      <Wallet className={`text-primary-foreground ${s.icon}`} aria-hidden="true" />
    </div>
  );
}
