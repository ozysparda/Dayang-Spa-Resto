import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface Notif {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Track mount state and the in-flight request so we never call setState
  // (or keep polling) after the component unmounts — e.g. when the user
  // navigates backward / exits to /login. Layout unmounts here, and without
  // this guard the polling fetch resolved setState on an unmounted component,
  // which is what surfaced as "back/exit → error".
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchNotifications = async () => {
    if (!mountedRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const res = await api.get('/notifications?limit=20', { signal: controller.signal });
      // Only update state if still mounted and the request wasn't aborted.
      if (mountedRef.current && !controller.signal.aborted) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') {
        return;
      }
      // Swallow other errors silently (e.g. auth redirect) to avoid noise.
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();
    const poll = setInterval(fetchNotifications, 20000);
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      clearInterval(poll);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      // ignore
    }
  };

  const handleClick = (n: Notif) => {
    // Mark single as read (best-effort)
    if (!n.isRead) {
      api.patch(`/notifications/${n.id}/read`).catch(() => {});
    }
    setOpen(false);
    if (n.type === 'ANNOUNCEMENT') {
      navigate('/announcements');
    } else if (n.type?.includes('BOOKING')) {
      navigate('/bookings');
    }
  };

  const formatTime = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          if (!open) fetchNotifications();
          setOpen(!open);
        }}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 ${n.isRead ? 'opacity-70' : 'bg-blue-50'}`}
                >
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatTime(n.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
