import { useAccounts } from "@/store/finance";
import { Field, inputClass } from "./Modal";

/**
 * Reusable account picker. Shows a friendly empty state if the user
 * has no accounts yet, instead of a useless empty <select>.
 */
export function AccountSelect({
  value,
  onChange,
  label = "Conta",
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const { data: accounts = [] } = useAccounts();
  if (accounts.length === 0) {
    return (
      <Field label={label}>
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Cadastre uma conta na aba Contas antes de criar lançamentos.
        </p>
      </Field>
    );
  }
  return (
    <Field label={label}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.type}
          </option>
        ))}
      </select>
    </Field>
  );
}
