import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useLang } from '../stores/languageStore';

interface Notif {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  relatedId?: string;
}

// Shared across the mobile + desktop bell instances so we never double-poll
// or surface the same browser notification twice.
let pollingStarted = false;
const shownNative = new Set<string>();

// Route a notification click to the relevant page (assignment → workflow).
const routeForType = (n: Notif): string | null => {
  const t = (n.type || '').toUpperCase();
  if (t === 'ANNOUNCEMENT') return '/announcements';
  if (t === 'TREATMENT_ASSIGNED') return '/treatment-input';
  if (t.includes('BOOKING')) return '/bookings';
  if (n.relatedId) return '/bookings';
  return null;
};

const typeLabel = (type: string | undefined, t: (key: string) => string) => {
  if (!type) return '';
  if (type.includes('BOOKING')) return t('notif.types.newBooking');
  if (type === 'TREATMENT_ASSIGNED') return t('notif.types.treatmentAssigned');
  if (type === 'ANNOUNCEMENT') return t('notif.types.announcement');
  if (type === 'SYSTEM') return t('notif.types.system');
  return type.replace(/_/g, ' ');
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useLang();
  const notifsRef = useRef<Notif[]>([]);
  const { permission, subscribed, subscribe, ensurePermission } = usePushNotifications();
  const [pushAvailable, setPushAvailable] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=30');
      const list: Notif[] = res.data?.notifications || [];
      notifsRef.current = list;
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.isRead).length);
    } catch {}
  };

  // Permission + real push subscription (best-effort, once per browser session).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!('Notification' in window)) { setPushAvailable(false); return; }
      const perm = await ensurePermission();
      if (cancelled) return;
      if (perm !== 'granted') { setPushAvailable(false); return; }
      try {
        const keyRes = await api.get('/push/vapid-public-key');
        if (keyRes.data?.publicKey) await subscribe(keyRes.data.publicKey);
        else setPushAvailable(false);
      } catch { setPushAvailable(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Shared polling — single interval across the two bell instances.
  useEffect(() => {
    if (!pollingStarted) pollingStarted = true;
    fetchNotifications();
    const poll = setInterval(fetchNotifications, 30000);
    return () => clearInterval(poll);
  }, []);

  // Native browser notification for new unread items when push isn't subscribed.
  useEffect(() => {
    if (permission !== 'granted' || subscribed) return;
    for (const n of notifsRef.current) {
      if (!n.isRead && !shownNative.has(n.id)) {
        shownNative.add(n.id);
        try {
          const notif = new Notification(n.title || t('app.name'), { body: n.message, icon: '/vite.svg' });
          notif.onclick = () => { const r = routeForType(n); if (r) navigate(r, { replace: true }); };
        } catch {}
      }
    }
  }, [notifications, permission, subscribed, navigate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try { await api.patch('/notifications/read-all'); setUnreadCount(0); setNotifications((p) => p.map((n) => ({ ...n, isRead: true }))); } catch {}
  };

  const markOneRead = (id: string) => {
    api.patch(`/notifications/${id}/read`).catch(() => {});
    setUnreadCount((c) => Math.max(0, c - 1));
    setNotifications((p) => p.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleClick = (n: Notif) => {
    if (!n.isRead) markOneRead(n.id);
    shownNative.delete(n.id);
    setOpen(false);
    const route = routeForType(n);
    if (route) navigate(route, { replace: true });
  };

  const enableNotifications = async () => {
    const perm = await ensurePermission();
    if (perm === 'granted') {
      try { const keyRes = await api.get('/push/vapid-public-key'); if (keyRes.data?.publicKey) await subscribe(keyRes.data.publicKey); else setPushAvailable(false); }
      catch { setPushAvailable(false); }
    }
  };

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: string) => {
    const date = new Date(d);
    return date.toDateString() === new Date().toDateString() ? 'Today' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

    return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { if (!open) fetchNotifications(); setOpen(!open); }}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 touch-target"
        aria-label={t('notif.title')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-gray-900">{t('notif.title')}</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">{t('notif.markAllRead')}</button>
            )}
          </div>

          {/* Permission / push status banners */}
          {permission === 'denied' && (
            <div className="p-3 mx-3 my-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
              <p className="font-medium text-yellow-800">{t('notif.blocked')}</p>
              <p className="text-yellow-700">{t('notif.blockedDesc')}</p>
            </div>
          )}
          {permission === 'default' && (
            <div className="p-3 mx-3 my-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
              <p className="font-medium text-blue-800 mb-2">{t('notif.turnOn')}</p>
              <p className="text-blue-700 mb-2">{t('notif.turnOnDesc')}</p>
              <button onClick={enableNotifications} className="btn-xs btn-primary touch-target">{t('notif.enable')}</button>
            </div>
          )}
          {permission === 'granted' && !pushAvailable && (
            <div className="p-3 mx-3 my-2 bg-gray-50 border border-gray-200 rounded-lg text-xs">
              <p className="font-medium text-gray-700">{t('notif.inappActive')}</p>
              <p className="text-gray-500">{t('notif.inappDesc')}</p>
            </div>
          )}

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">{t('notif.empty')}</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 ${n.isRead ? 'opacity-70' : 'bg-blue-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{typeLabel(n.type, t)} — {n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{fmtDate(n.createdAt)} · {fmtTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
