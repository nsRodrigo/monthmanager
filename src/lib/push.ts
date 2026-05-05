// Helpers para Web Push no cliente

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isPreviewIframe() {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  return (
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com")
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerServiceWorker() {
  if (!isPushSupported() || isPreviewIframe()) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export async function subscribeToPush(vapidPublicKey: string) {
  if (!isPushSupported() || isPreviewIframe()) {
    throw new Error("Push não suportado neste ambiente. Instale o app (PWA) e use no app instalado.");
  }
  const reg = await registerServiceWorker();
  if (!reg) throw new Error("Service worker indisponível.");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permissão de notificações negada.");

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing.toJSON();

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return sub.toJSON();
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}
