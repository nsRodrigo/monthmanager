export type Tone = "debit" | "income" | "primary" | "credit" | "destructive";

export const toneText: Record<Tone, string> = {
  debit: "text-debit",
  income: "text-success",
  credit: "text-credit",
  primary: "text-primary",
  destructive: "text-destructive",
};
export const toneBg: Record<Tone, string> = {
  debit: "bg-debit/15",
  income: "bg-success/15",
  credit: "bg-credit/15",
  primary: "bg-primary/15",
  destructive: "bg-destructive/15",
};
/** Leve lavagem de cor para o cabeçalho da seção (mais sutil que toneBg, usado nos chips). */
export const toneWash: Record<Tone, string> = {
  debit: "bg-debit/[0.06]",
  income: "bg-success/[0.06]",
  credit: "bg-credit/[0.06]",
  primary: "bg-primary/[0.06]",
  destructive: "bg-destructive/[0.06]",
};

export function FabAction({
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: Tone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-4 pr-1.5 shadow-elevated transition-colors hover:border-primary/50"
    >
      <span className="whitespace-nowrap text-xs font-semibold">{label}</span>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneBg[tone]} ${toneText[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
    </button>
  );
}
