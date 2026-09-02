/**
 * Versão exibida na UI (login, bloqueio biométrico, Home) — só pra
 * conferir visualmente se um deploy novo já chegou no ar. Setada pelo CI
 * a cada push (ver .github/workflows/deploy.yml); em dev local cai no
 * fallback abaixo.
 */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";
