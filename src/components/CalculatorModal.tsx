import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Calculator } from "./Calculator";

/**
 * Calculadora dentro de um Modal — usada tanto como complemento de um campo
 * Valor (`onUse` preenche o campo e fecha) quanto avulsa, pelo FAB/menu
 * lateral (sem `onUse`: o botão principal vira "Copiar resultado").
 */
export function CalculatorModal({
  open,
  onClose,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  onUse?: (value: number) => void;
}) {
  const [result, setResult] = useState<number | null>(0);

  async function handlePrimary() {
    if (result === null) return;
    if (onUse) {
      onUse(result);
      onClose();
    } else {
      try {
        await navigator.clipboard.writeText(String(result).replace(".", ","));
        toast.success("Resultado copiado.");
      } catch {
        toast.error("Não deu pra copiar — copie manualmente.");
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Calculadora">
      <Calculator onResultChange={setResult} />
      <button
        type="button"
        onClick={handlePrimary}
        disabled={result === null}
        className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {onUse ? "Usar este valor" : "Copiar resultado"}
      </button>
    </Modal>
  );
}
