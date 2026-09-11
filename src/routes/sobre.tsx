import { Link, createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Wallet, CreditCard, PiggyBank, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Gestão Financeira — Controle de gastos, cartões e investimentos" },
      {
        name: "description",
        content:
          "Gestão Financeira é um app pessoal para controlar contas, cartões de crédito, parcelamentos, recebimentos e investimentos por conta bancária.",
      },
    ],
  }),
  component: SobrePage,
});

const features = [
  {
    icon: Wallet,
    title: "Contas e saldo real",
    text: "Acompanhe o saldo de cada conta bancária com base no que já foi efetivamente pago ou recebido.",
  },
  {
    icon: CreditCard,
    title: "Cartões e parcelamentos",
    text: "Controle faturas, compras parceladas e recorrentes por cartão, mês a mês.",
  },
  {
    icon: PiggyBank,
    title: "Investimentos",
    text: "Registre aportes, inclusive parcelados ou recorrentes, e acompanhe a evolução do seu patrimônio.",
  },
  {
    icon: ShieldCheck,
    title: "Seus dados, sua conta",
    text: "Cada usuário só acessa os próprios lançamentos. Backup opcional para o seu Google Drive.",
  },
];

function SobrePage() {
  return (
    <div className="min-h-dvh bg-background px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <h1 className="text-2xl font-bold">Gestão Financeira</h1>
          <p className="text-sm text-muted-foreground">
            Controle detalhado de gastos, cartões, parcelamentos e investimentos por conta bancária.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-4">
              <f.icon className="mb-2 h-5 w-5 text-primary" />
              <h2 className="mb-1 text-sm font-semibold">{f.title}</h2>
              <p className="text-xs text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Entrar
          </Link>
          <Link to="/privacidade" className="text-xs text-muted-foreground underline">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
