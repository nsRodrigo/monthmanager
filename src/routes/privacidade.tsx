import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — Gestão Financeira" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="md" />
          <h1 className="text-2xl font-bold">Política de Privacidade</h1>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-foreground">
          <p>
            Este app ("Gestão Financeira") é uma ferramenta pessoal de controle financeiro.
            Seus dados (lançamentos, cartões, contas, investimentos) são armazenados de forma
            privada, vinculados exclusivamente à sua conta, e não são compartilhados com
            terceiros nem usados para qualquer finalidade além do funcionamento do próprio app.
          </p>

          <h2 className="text-lg font-semibold">Integração com Google Drive</h2>
          <p>
            Ao conectar sua conta do Google para o recurso de backup, o app solicita acesso
            apenas ao escopo <code className="rounded bg-secondary px-1 py-0.5">drive.file</code>,
            que permite ler e escrever exclusivamente os arquivos criados pelo próprio app —
            nenhum outro arquivo do seu Google Drive é acessado. Esse acesso é usado somente
            para salvar e restaurar backups dos seus dados financeiros.
          </p>

          <h2 className="text-lg font-semibold">Retenção e exclusão</h2>
          <p>
            Você pode excluir seus dados a qualquer momento dentro do próprio app. Para
            revogar o acesso ao Google Drive, isso pode ser feito diretamente nas
            configurações da sua conta Google (Segurança → Apps de terceiros com acesso).
          </p>

          <h2 className="text-lg font-semibold">Contato</h2>
          <p>
            Dúvidas sobre esta política podem ser enviadas para{" "}
            <a className="text-primary underline" href="mailto:rodrigo.nascim.silva@gmail.com">
              rodrigo.nascim.silva@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
