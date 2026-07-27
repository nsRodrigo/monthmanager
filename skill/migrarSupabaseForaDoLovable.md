# Guia — Tirar o monthmanager do Lovable (Supabase + hospedagem + PWA)

> Este arquivo existe para dar contexto a uma IA (ou a você) numa sessão
> futura, quando for a hora de efetivamente sair do Lovable. Foi escrito em
> 2026-07-26 depois de investigar o repo (package.json, vite.config.ts,
> wrangler.jsonc, supabase/migrations, src/integrations/lovable,
> src/lib/webauthn.functions.ts, src/lib/push.functions.ts). Ainda não foi
> executado — é o plano, não o log de uma migração feita.

---

## Contexto: o que é do Lovable de verdade vs. o que já é portável

| Peça | É do Lovable? | Observação |
|---|---|---|
| Banco (Supabase) | Não — só provisionado pelo Lovable | Supabase é produto próprio (supabase.com). O projeto já existe como projeto Supabase de verdade (`project_id` em `supabase/config.toml`). |
| Migrations (`supabase/migrations/*.sql`) | Não | Já versionadas no repo, já rodam via `supabase db push` normal. |
| Hospedagem (Cloudflare Workers, `wrangler.jsonc`) | Não | App já é TanStack Start rodando como Cloudflare Worker (`main: "@tanstack/react-start/server-entry"`, `nodejs_compat`). Cloudflare é conta separada do Lovable — dá pra fazer `wrangler deploy` direto. |
| PWA (`public/manifest.webmanifest`, `sw.js`, ícones) | Não | Já pronto, nada a mudar. |
| `vite.config.ts` (`@lovable.dev/vite-tanstack-config`) | **Sim** | Wrapper que embrulha vários plugins padrão (ver comentário no próprio arquivo). Precisa ser substituído por um `defineConfig` explícito. |
| `@lovable.dev/cloud-auth-js` (`src/integrations/lovable/index.ts`) | **Sim** | Usado em UM lugar só: botão "Entrar com Google" em `src/routes/auth.tsx:90`. Login por email/senha é Supabase puro, não depende disso. |
| WebAuthn (`src/lib/webauthn.functions.ts`) | Não | RP ID e origin são derivados do header `Origin`/`Referer` da própria requisição em runtime — não tem config fixa de domínio no código, só precisa servir em HTTPS com o domínio real. |
| Push notifications (VAPID) | Não | Chave pública fixa em `src/server/push.server.ts`; privada vem de env (`VAPID_PRIVATE_KEY`). |

Conclusão: **não tem lock-in real de plataforma**. É meio dia de trabalho de configuração, não reescrita.

---

## Passo 1 — Banco de dados novo (Supabase)

1. Criar projeto em supabase.com (escolher região, senha do banco).
2. Rodar TODAS as migrations de `supabase/migrations/` **na ordem do nome
   do arquivo** (algumas dependem de tabelas criadas antes):
   - Com CLI: `supabase link --project-ref <ref>` → `supabase db push`.
   - Sem CLI: colar cada `.sql` no SQL Editor, um de cada vez, na ordem.
3. Isso já cria sozinho, sem passo manual extra:
   - Todas as tabelas + RLS (`accounts`, `cards`, `purchases`,
     `installments`, `debits`, `incomes`, `investments`, `card_payments`,
     `irpf_documents`, `irpf_entries`, `irpf_year_snapshots`,
     `recurring_deletions`, `amount_adjustments`, `whitelist`,
     `user_roles`, etc.)
   - O bucket de storage privado `irpf-docs` + suas policies (migration
     `20260505122127_...sql`).
   - A lógica de whitelist/admin (migration `20260505004440_...sql`):
     função `is_email_whitelisted`, `has_role`, e a trigger
     `enforce_whitelist_on_signup` — **o primeiro usuário a se cadastrar no
     projeto novo vira admin automaticamente e entra na whitelist**. Não
     precisa inserir nada manualmente, só garantir que a PRIMEIRA pessoa a
     se cadastrar é você mesmo.
4. Se a v2/v3 desta sessão de bugfix (ver `historicoMudancas.md`) ainda não
   tiver sido aplicada no projeto ANTIGO, ela já vai estar incluída no
   projeto novo automaticamente (está no `supabase/migrations/`).

## Passo 2 — Auth

- Email/senha: habilitado por padrão. Decidir em *Authentication → Settings*
  se quer exigir confirmação de e-mail (o app não depende de nenhum dos
  dois jeitos — a trigger de whitelist dispara no INSERT em `auth.users`,
  não espera confirmação).
- **Site URL** e **Redirect URLs** (*Authentication → URL Configuration*):
  apontar para o domínio novo onde o app vai ficar. Sem isso, reset de
  senha e afins quebram.
- Google OAuth (opcional — só se for manter o botão "Entrar com Google"):
  criar client OAuth no Google Cloud Console, colocar Client ID/Secret em
  *Authentication → Providers → Google*, redirect URI
  `https://<projeto>.supabase.co/auth/v1/callback`. Se não usar, dá pra
  simplesmente não chamar `lovable.auth.signInWithOAuth` (ver Passo 4).

## Passo 3 — Variáveis de ambiente

Cliente (build, pode ser público — é a chave anon):
```
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=<projeto>
```

Servidor (usadas em `src/lib/*.functions.ts` e `client.server.ts`):
```
SUPABASE_URL=https://<projeto>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # SECRETO — nunca em .env versionado
VAPID_PRIVATE_KEY=<...>
VAPID_SUBJECT=mailto:seuemail@exemplo.com
```

`SUPABASE_SERVICE_ROLE_KEY` é usada em `src/integrations/supabase/client.server.ts`
(bypassa RLS, só pra server functions administrativas) e em
`src/lib/webauthn.functions.ts`. Configurar como secret do host de deploy
(ex. Cloudflare: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`), nunca
num `.env` que vai pro bundle do cliente.

VAPID: a chave PÚBLICA está fixa em `src/server/push.server.ts`
(`VAPID_PUBLIC_KEY`). Duas opções:
- Manter o par de chaves atual (pegar o valor privado correspondente de
  onde estiver guardado hoje) — push continua funcionando igual.
- Gerar um par novo (`npx web-push generate-vapid-keys`) — nesse caso
  também precisa atualizar a constante `VAPID_PUBLIC_KEY` no código, já
  que pública e privada têm que ser o mesmo par. Inscrições de push
  antigas (se houver) param de funcionar até o usuário reabrir o app e
  re-inscrever.

## Passo 4 — Código: remover dependência do Lovable

1. **`vite.config.ts`**: trocar
   ```ts
   import { defineConfig } from "@lovable.dev/vite-tanstack-config";
   export default defineConfig();
   ```
   por um `defineConfig` do `vite` normal, incluindo manualmente os plugins
   que o comentário do arquivo já lista: `tanstackStart`, `viteReact`,
   `@tailwindcss/vite`, `vite-tsconfig-paths`, `@cloudflare/vite-plugin`
   (build), alias `@` → `src`. Todos já são dependências do projeto
   (`package.json`), só não estão explícitos no vite.config ainda.
2. **`@lovable.dev/cloud-auth-js`** (`src/integrations/lovable/index.ts`,
   usado só em `src/routes/auth.tsx:90` pro botão Google): se for manter
   login com Google, trocar por `supabase.auth.signInWithOAuth({ provider:
   "google" })` direto (Supabase já suporta OAuth nativamente, sem
   precisar de wrapper). Se não for usar Google, só remover o botão e essa
   importação.
3. Remover as duas dependências do `package.json` depois de trocadas:
   `@lovable.dev/vite-tanstack-config`, `@lovable.dev/cloud-auth-js`.
4. `.lovable/` (pasta com skills/config do editor Lovable) pode ser
   apagada — não é lida pelo app em runtime, só pelo editor do Lovable.

## Passo 5 — Hospedagem

App já está pronto pra Cloudflare Workers (`wrangler.jsonc` já existe,
`main: "@tanstack/react-start/server-entry"`, `nodejs_compat`). Caminho
mais direto:
1. Conta Cloudflare própria (separada do Lovable).
2. `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (e outros secrets do
   Passo 3) no projeto do Worker.
3. Variáveis não-secretas (`VITE_SUPABASE_URL` etc.) via `[vars]` no
   `wrangler.jsonc` ou no dashboard da Cloudflare.
4. `npx wrangler deploy`.

Se preferir NÃO usar Cloudflare, TanStack Start também roda em Node/Vercel/
outros — mas aí precisa trocar o build target (`@cloudflare/vite-plugin`)
pelo adapter correspondente. Caminho de menor esforço é ficar em
Cloudflare já que tudo já está configurado pra isso.

## Passo 6 — PWA

Nada a fazer — `public/manifest.webmanifest`, `public/sw.js` e os ícones
(`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) já existem e
funcionam independente de onde o app for hospedado. Só confirmar que o
domínio novo serve tudo via HTTPS (obrigatório pra service worker e
WebAuthn funcionarem).

## Ordem sugerida de execução

1. Banco novo + migrations (Passo 1) — pode ser feito e testado isolado,
   sem mexer no código ainda.
2. Cadastrar-se no projeto novo primeiro (vira admin automático).
3. Trocar env vars do build pra apontar pro projeto novo, testar local
   (`vite dev` ou `wrangler dev`) ainda hospedado onde estiver hoje.
4. Só depois de confirmar que auth + CRUD básico funcionam no banco novo,
   mexer no vite.config/cloud-auth-js (Passo 4) e migrar a hospedagem
   (Passo 5).

Fazer nessa ordem separa "trocar de banco" de "trocar de plataforma de
código/host" — se algo quebrar, dá pra saber em qual das duas etapas foi.
