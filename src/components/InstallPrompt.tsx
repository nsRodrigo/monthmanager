import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "install-prompt-dismissed-at";
const DISMISS_DAYS = 7;

function wasRecentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ts = parseInt(v, 10);
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore - iOS Safari
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    // Android/Desktop Chrome/Edge
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari — mostrar instruções após 2s
    if (isIOS() && isSafari()) {
      const t = setTimeout(() => {
        setShowIosTip(true);
        setVisible(true);
      }, 2000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
      setDeferred(null);
      setVisible(false);
      markDismissed();
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur md:left-auto md:right-4 md:bottom-4 md:mx-0"
    >
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>

      {showIosTip ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary">
              <Download className="h-4 w-4 text-primary-foreground" />
            </div>
            <h3 className="text-sm font-semibold">Instalar na tela inicial</h3>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Tenha o app sempre à mão, sem barra do navegador.
          </p>
          <ol className="space-y-2 text-xs">
            <li className="flex items-center gap-2">
              <span className="font-semibold">1.</span> Toque no botão
              <Share className="inline h-3.5 w-3.5" aria-label="Compartilhar" />
              <span className="text-muted-foreground">(Compartilhar)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold">2.</span> Escolha
              <Plus className="inline h-3.5 w-3.5" />
              <strong>Adicionar à Tela de Início</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold">3.</span> Toque em <strong>Adicionar</strong>
            </li>
          </ol>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary">
              <Download className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Instalar Gestão Financeira</h3>
              <p className="truncate text-xs text-muted-foreground">
                Acesso rápido, em tela cheia.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 rounded-lg bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
            >
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              Agora não
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
