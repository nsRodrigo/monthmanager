# Finanças — Guia completo

App de gestão financeira pessoal. Controla cartões de crédito (com parcelas
calculadas pela **data de fatura**), débitos da conta corrente, recebimentos
parcelados e dinheiro físico em carteira. Multi-conta (Itaú, Nubank,
Mercado Pago, etc.) com filtro global.

Teste
---

## 🌐 Acesso pelo navegador

### 1. Versão publicada (mais simples)

Após cada deploy, o app fica disponível em uma URL `*.lovable.app`. Basta
abrir no navegador do celular ou computador e usar — funciona como um app web
normal.

### 2. Instalar como app (PWA)

O projeto já vem com `manifest.webmanifest` e ícone, então é
**instalável direto pelo navegador**:

- **Chrome / Edge (desktop)**: ícone "Instalar" na barra de endereço
- **Safari (iPhone/iPad)**: Compartilhar → "Adicionar à Tela de Início"
- **Chrome (Android)**: menu ⋮ → "Instalar app"

Após instalado, o app abre em janela própria, sem barra do navegador.
Funciona online (não tem cache offline — para offline use Electron).

> O service worker foi propositalmente omitido para evitar conflitos com o
> preview da Lovable. PWA puramente como "ícone instalável" + manifest.

---

## 💻 Rodar fora da plataforma (local)

### Pré-requisitos

- **Node.js 20+** (https://nodejs.org)
- **Git**

```bash
node -v   # v20.x ou maior
npm -v
```

### Instalação

```bash
git clone <url-do-seu-repo>.git financas
cd financas
npm install
```

### Modo desenvolvimento (hot reload)

```bash
npm run dev
```

Abre em `http://localhost:8080`.

### Build de produção (web)

```bash
npm run build       # gera dist/
npm run preview     # serve dist/ em http://localhost:4173
```

A pasta `dist/` é estática e roda em qualquer servidor (Nginx, Apache,
Cloudflare Pages, Vercel, Netlify, GitHub Pages, etc.).

---

## ☁️ Deploy em produção

Como é um SPA puro com TanStack Start, qualquer host estático serve.
Precisa apenas das variáveis `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID` no painel do
provedor.

### Vercel

1. Conecte o repositório no painel da Vercel
2. Build command: `npm run build`
3. Output directory: `dist`
4. Adicione as variáveis `VITE_*` em **Settings → Environment Variables**
5. Deploy

### Netlify

1. New site from Git → escolha o repositório
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Adicione as variáveis em **Site settings → Build & deploy → Environment**

### Cloudflare Pages

1. Pages → Create project → conecte o repositório
2. Build command: `npm run build`
3. Output: `dist`
4. Variáveis de ambiente em **Settings → Environment variables**

### Servidor próprio (Nginx)

```nginx
server {
  root /var/www/financas/dist;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;   # SPA fallback
  }
}
```

---

## 🖥️ Aplicativo desktop (Electron)

O Electron empacota o app web num shell nativo (`.exe`, `.app`, binário
Linux). Não cria APK Android.

### Instalar Electron (uma vez)

```bash
npm install --save-dev electron @electron/packager
```

### Adicionar scripts em `package.json`

```json
"main": "electron/main.cjs",
"scripts": {
  "electron": "electron .",
  "electron:build": "vite build && electron-packager . Financas --overwrite --out=electron-release --ignore=^/src --ignore=^/public --ignore=^/electron-release --ignore=node_modules"
}
```

> O arquivo `electron/main.cjs` já existe. Mantenha extensão `.cjs`.

### Rodar e empacotar

```bash
npm run build       # gera dist/
npm run electron    # abre janela do app
npm run electron:build   # gera pasta executável da plataforma atual
```

### Cross-platform

```bash
# Windows (.exe)
npx vite build && npx @electron/packager . Financas \
  --platform=win32 --arch=x64 \
  --out=electron-release --overwrite \
  --ignore=^/src --ignore=^/public --ignore=^/electron-release --ignore=node_modules

# macOS (.app) — use --arch=arm64 para Apple Silicon
npx vite build && npx @electron/packager . Financas \
  --platform=darwin --arch=x64 \
  --out=electron-release --overwrite \
  --ignore=^/src --ignore=^/public --ignore=^/electron-release --ignore=node_modules

# Linux
npx vite build && npx @electron/packager . Financas \
  --platform=linux --arch=x64 \
  --out=electron-release --overwrite \
  --ignore=^/src --ignore=^/public --ignore=^/electron-release --ignore=node_modules
```

A pasta `electron-release/Financas-<plat>-<arch>/` contém o executável.
Basta zipar e distribuir.

---

## ⚙️ Backend (Lovable Cloud / Supabase)

O `.env` já vem preenchido pela plataforma com:

```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=ey...
VITE_SUPABASE_PROJECT_ID=...
```

Para usar seu próprio Supabase:

1. Crie um projeto em https://supabase.com
2. Rode todas as migrações em `supabase/migrations/` (em ordem cronológica)
3. Substitua as 3 variáveis no `.env`
4. Habilite **Email auth** (configurações de Auth → Providers)

Sem essas variáveis o app abre, mas autenticação e dados não funcionam.

---

## 🧠 Conceitos importantes

### Mês de fatura (regra crítica do crédito)

Compras no cartão **NÃO** entram no mês da compra — entram no mês em que a
**fatura vence**.

Exemplo (cartão fecha dia 25 e vence dia 5):

- Compra em **20 de abril** → fatura fecha 25/abr → vence **5 de maio**
  → aparece no mês de **maio**
- Compra em **27 de abril** (após o fechamento) → fatura fecha 25/mai →
  vence **5 de junho** → aparece no mês de **junho**

A regra é aplicada automaticamente quando o cartão tem `closing_day` e
`due_day` configurados. Débitos e recebimentos continuam usando a data
informada — para esses, a data já é o evento real.

### Multi-conta

Toda entidade (cartão, débito, recebimento, investimento) pertence a uma
conta. Há um seletor global no topo (mobile) ou na sidebar (desktop) para:

- **Todas as contas** → consolidado
- **Conta específica** → filtro isolado

### Estrutura de abas

- **Início** — Dashboard com saldo previsto e 4 cards de categoria
- **Crédito** — Cartões e faturas
- **Débito** — Gastos da conta corrente + Investimentos
- **Recebimentos** — Salário e parcelas a receber
- **Carteira** — Dinheiro físico (contas tipo "carteira")
- **Visão mensal** — Detalhamento mês a mês
- **Contas** — Cadastro de bancos/carteiras
- **Cartões + invest.** — Cadastro de cartões e investimentos
- **Importar** — CSV em massa

---

## 🐛 Resolução de problemas

| Sintoma | Solução |
| --- | --- |
| Janela do Electron abre em branco | Confirme `base: './'` em `vite.config.ts` |
| `__dirname is not defined` | Use `electron/main.cjs` (não `.js`) |
| `Cannot find module 'electron'` | `npm install --save-dev electron` |
| App roda mas não autentica | Verifique `.env` e CORS no Supabase |
| Build trava em "vite build" | Apague `node_modules` e `dist`, reinstale |
| 404 ao recarregar `/credito` | Servidor sem SPA fallback — use config Nginx acima |

---

Pronto! Você tem o app rodando localmente, no navegador, instalável como
PWA, hospedado em qualquer provedor estático e empacotado como desktop.
