import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useUnreadNotificationsCount } from "@/store/notifications";

/**
 * Sino com contador de não lidas, fixo no topo direito — só na Home, e só no
 * mobile (no desktop a sidebar já mostra o mesmo link com contador). Extraído
 * de `AccountSettingsFab` (removido) pra sobreviver independente da troca do
 * mecanismo de FAB por `ConfigurableFab`.
 */
export function NotificationBellButton() {
  const navigate = useNavigate();
  const unreadCount = useUnreadNotificationsCount();

  return (
    <button
      type="button"
      onClick={() => navigate({ to: "/notificacoes" })}
      aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : "Notificações"}
      className="fixed top-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-elevated md:hidden"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
