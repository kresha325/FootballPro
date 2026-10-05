import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { notificationsAPI } from '../services/api';
import { resolveNotificationNavigatePath } from '../utils/notificationLinks';

export default function NotificationBell({ unreadCount = 0 }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onDoc = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onIncoming = () => {
      if (open) load();
    };
    window.addEventListener('notification-received', onIncoming);
    return () => window.removeEventListener('notification-received', onIncoming);
  }, [open]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await notificationsAPI.getNotifications({ page: 1, limit: 6 });
      setItems(response.data.notifications || []);
    } catch (_err) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const openItem = async (notification) => {
    if (!notification.isRead) {
      try {
        await notificationsAPI.markAsRead(notification.id);
      } catch (_err) {
        /* navigation still proceeds */
      }
      window.dispatchEvent(new CustomEvent('notifications-unread-changed'));
    }
    setOpen(false);
    const path = resolveNotificationNavigatePath(notification);
    if (path) navigate(path);
  };

  const badge = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        className="relative grid h-11 w-11 place-items-center rounded-lg text-[var(--xt-color-text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--xt-color-gold-bright)]"
        aria-label="Njoftimet"
        aria-expanded={open}
      >
        <BellIcon className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[1.1rem] text-center">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-[var(--xt-color-surface)] p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-bold text-white">Njoftimet</p>
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs font-semibold text-[var(--xt-color-gold-bright)]">
              Shiko të gjitha
            </Link>
          </div>
          {loading ? (
            <p className="px-2 py-4 text-sm text-[var(--xt-color-text-muted)]">Po ngarkohen…</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-[var(--xt-color-text-muted)]">Nuk ka njoftime.</p>
          ) : (
            <ul className="max-h-80 overflow-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={`w-full rounded-lg px-2 py-2 text-left hover:bg-white/5 ${item.isRead ? '' : 'bg-[var(--xt-color-gold)]/10'}`}
                  >
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="line-clamp-2 text-xs text-[var(--xt-color-text-muted)]">{item.message}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
