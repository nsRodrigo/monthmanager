# Finanças — Guia de execução local e build de aplicativo

Este guia explica como rodar o projeto fora da plataforma Lovable e como
gerar instaladores para Windows, macOS e Linux usando Electron.

---

## 1. Pré-requisitos

Instale os pacotes abaixo no seu computador:

- **Node.js 20+** (recomendado 20 LTS) — https://nodejs.org
- **npm** (já vem com o Node) ou **bun** (https://bun.sh) — opcional, mais rápido
- **Git** para clonar o repositório

Verifique:

```bash
node -v   # deve mostrar v20.x ou maior
npm -v
```

---

## 2. Clonar e instalar dependências

```bash
git clone <url-do-seu-repo>.git financas
cd financas
npm install
# ou, com bun:
# bun install
```

> O `npm install` baixa em torno de 400 MB de dependências (incluindo
> Electron). Demora 1–3 minutos na primeira vez.

---

## 3. Rodar o app no navegador (modo desenvolvimento)

```bash
npm run dev
```

Abre em `http://localhost:8080` (ou na porta indicada no terminal).
Hot-reload está ativo — toda alteração no código é refletida na hora.

### Build web para produção

```bash
npm run build
```

Gera a pasta `dist/` com os arquivos estáticos prontos para servir em qualquer
hospedagem (Cloudflare Pages, Vercel, Netlify, Nginx etc.).

Para testar o build localmente:

```bash
npm run preview
```

---

## 4. Rodar como aplicativo desktop (Electron)

O Electron empacota o app web num shell nativo, gerando `.exe` (Windows),
`.app` (macOS) ou binário Linux.

### 4.1 Instalar dependências do Electron (uma vez)

```bash
npm install --save-dev electron @electron/packager
```

> Baixa ~150 MB. Necessário apenas se você quiser empacotar como desktop.

### 4.2 Adicionar scripts ao `package.json`

Edite `package.json` e acrescente em `"scripts"`:

```json
"electron": "electron .",
"electron:build": "vite build && electron-packager . Financas --overwrite --out=electron-release --ignore=^/src --ignore=^/public --ignore=^/electron-release --ignore=node_modules"
```

E acrescente no nível raiz do `package.json`:

```json
"main": "electron/main.cjs"
```

> O arquivo `electron/main.cjs` já está no projeto. Não renomeie para `.js`
> — `package.json` usa `"type": "module"` e o Electron precisa de CommonJS.

### 4.3 Rodar em modo desktop

```bash
npm run build       # gera dist/
npm run electron    # abre a janela do app
```

### 4.4 Gerar instalador para a plataforma atual

```bash
npm run electron:build
```

A saída vai para `electron-release/Financas-<plataforma>-<arch>/`.
Basta zipar essa pasta e distribuir.

### 4.5 Build cross-platform

A partir do Linux ou macOS você pode gerar binários para outras plataformas:

**Windows (.exe):**

```bash
npx vite build && npx @electron/packager . Financas --platform=win32 --arch=x64 --out=electron-release --overwrite --ignore=^/src --ignore=^/public --ignore=^/electron-release --ignore=node_modules
```

A pasta `electron-release/Financas-win32-x64/` contém `Financas.exe`
e todos os arquivos necessários — basta zipar e enviar.

**macOS (.app):**

```bash
npx vite build && npx @electron/packager . Financas --platform=darwin --arch=x64 --out=electron-release --overwrite --ignore=^/src --ignore=^/public --ignore=^/electron-release --ignore=node_modules
```

> Para arquitetura Apple Silicon (M1/M2/M3) use `--arch=arm64`.

**Linux:**

```bash
npx vite build && npx @electron/packager . Financas --platform=linux --arch=x64 --out=electron-release --overwrite --ignore=^/src --ignore=^/public --ignore=^/electron-release --ignore=node_modules
```

---

## 5. Configuração do backend (Lovable Cloud / Supabase)

O app usa um backend gerenciado. As credenciais ficam no arquivo `.env` na
raiz do projeto e são preenchidas automaticamente pela Lovable. Para rodar
fora da plataforma você precisa de um arquivo `.env` com:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-anon-key
VITE_SUPABASE_PROJECT_ID=seu-id
```

> Estas chaves já existem no projeto atual no `.env`. Se for migrar para
> seu próprio Supabase, crie um projeto novo, rode as migrações em
> `supabase/migrations/` e atualize o `.env`.

Sem essas variáveis o app abre, mas autenticação e dados não funcionam.

---

## 6. Estrutura do projeto

```
financas/
├── electron/
│   └── main.cjs              # entry point do Electron desktop
├── src/
│   ├── components/           # componentes reutilizáveis
│   ├── routes/               # páginas (file-based routing)
│   ├── store/                # contextos e queries (auth, accounts, finance)
│   ├── integrations/supabase # cliente Supabase auto-gerado
│   └── styles.css            # design tokens (Tailwind v4)
├── supabase/
│   ├── config.toml           # ID do projeto Supabase
│   └── migrations/           # SQL de schema
├── package.json
└── vite.config.ts
```

---

## 7. Limitações e observações

- **Sem build automático de `.dmg` / `.AppImage` / instalador `.exe`:**
  o `@electron/packager` produz uma pasta executável. Para criar instaladores
  formais use `electron-builder` (mais complexo, requer dependências nativas).
- **Atualizações automáticas:** não estão configuradas. O usuário precisa
  baixar nova versão manualmente.
- **iOS / Android nativos:** este projeto é web/desktop. Para mobile nativo
  considere empacotar com Capacitor (Ionic) ou portar para React Native.

---

## 8. Resolução de problemas

| Sintoma | Solução |
| --- | --- |
| Janela do Electron abre em branco | Confirme `base: './'` em `vite.config.ts` |
| `__dirname is not defined` | O entry do Electron precisa terminar em `.cjs` |
| `Cannot find module 'electron'` | Rode `npm install --save-dev electron` |
| App roda mas não autentica | Verifique o `.env` e CORS no Supabase |
| Build trava em "vite build" | Apague `node_modules` e `dist`, reinstale |

Pronto! Com isso você tem o app rodando localmente e pacotes desktop prontos
para distribuir.
