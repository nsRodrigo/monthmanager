export const formatCurrency = (value: number) => {
  // Clamp tiny float noise and normalize -0 → 0 so "-R$ 0,00" never leaks.
  const v = Math.abs(value) < 0.005 ? 0 : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
};

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const MONTHS_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

export const formatDate = (iso: string) => {
  // Trata "YYYY-MM-DD" literalmente para evitar deslocamento de fuso horário
  // (new Date("2025-07-07") = UTC midnight → em UTC-3 vira 06/07).
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(iso).toLocaleDateString("pt-BR");
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
