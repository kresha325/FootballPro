import { useState, useEffect, useMemo } from 'react';
import ListSearchBar from './ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import { notificationsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { BellIcon, PhoneIcon, UserGroupIcon, HandThumbUpIcon, ChatBubbleLeftRightIcon, UserIcon, EnvelopeIcon, TrophyIcon, FlagIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

const notificationDateGroup = (date) => {
  if (Number.isNaN(date.getTime())) return 'Më herët';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayAge = Math.floor((today - itemDay) / 86400000);
  return dayAge < 1 ? 'Sot' : dayAge === 1 ? 'Dje' : 'Më herët';
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [listSearch, setListSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  // Rifresko njoftimet sa herë që ndryshon unreadCount
  useEffect(() => {
    fetchNotifications();
  }, [unreadCount]);

  const fetchNotifications = async () => {
    try {
      const response = await notificationsAPI.getNotifications();
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      const count = Number(response.data.count || 0);
      setUnreadCount(count);
      window.dispatchEvent(new CustomEvent('notifications-unread-changed', { detail: { count } }));
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(notifications.map(notif =>
        notif.id === id ? { ...notif, isRead: true } : notif
      ));
      setUnreadCount(prev => {
        const next = Math.max(0, prev - 1);
        window.dispatchEvent(new CustomEvent('notifications-unread-changed', { detail: { count: next } }));
        return next;
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(notifications.map(notif => ({ ...notif, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('notifications-unread-changed', { detail: { count: 0 } }));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    console.log('Notification clicked:', notification);
    console.log('Link:', notification.link);

    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      console.log('Navigating to:', notification.link);
      navigate(notification.link);
    } else {
      console.warn('No link in notification');
    }
  };

  const getNotificationIcon = (notification) => {
    if (notification?.metadata?.type === 'missed_call') return PhoneIcon;
    if (
      notification?.metadata?.kind === 'club_membership_request' ||
      String(notification?.link || '').includes('/club-roster')
    ) {
      return UserGroupIcon;
    }
    switch (notification?.type) {
      case 'like': return HandThumbUpIcon;
      case 'comment': return ChatBubbleLeftRightIcon;
      case 'follow': return UserIcon;
      case 'message': return EnvelopeIcon;
      case 'tournament': return TrophyIcon;
      case 'match': return FlagIcon;
      case 'achievement': return CheckBadgeIcon;
      default: return BellIcon;
    }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (!Number.isFinite(seconds)) return '';
    if (seconds < 60) return 'Tani';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min më parë`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} orë më parë`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ditë më parë`;
    const weeks = Math.floor(days / 7);
    return `${weeks} javë më parë`;
  };

  const filteredNotifications = useMemo(
    () =>
      filterBySearch(notifications, listSearch, (n) => [
        n.title,
        n.message,
        n.type,
        n.body,
      ]),
    [notifications, listSearch]
  );

  const groupedNotifications = useMemo(() => {
    const groups = new Map();
    filteredNotifications.forEach((notification) => {
      const date = new Date(notification.createdAt);
      const label = notificationDateGroup(date);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(notification);
    });
    return [...groups.entries()];
  }, [filteredNotifications]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[var(--xt-color-canvas)]">
        <div className="xt-skeleton h-12 w-12 rounded-full" aria-label="Po ngarkohen njoftimet" />
      </div>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-5 bg-[var(--xt-color-canvas)] px-4 py-5 pb-24 text-[var(--xt-color-text)] sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold-bright)]">X TALENTI · Aktivitet</p><h1 className="mt-1 text-3xl font-black text-white">Njoftime</h1><p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">Përditësime për llogarinë dhe komunitetin tënd.</p></div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <>
              <span className="xt-badge xt-badge-gold">
                {unreadCount} të palexuara
              </span>
              <button
                onClick={markAllAsRead}
                className="btn btn-quiet min-h-10 text-sm"
              >
                Shëno të gjitha si të lexuara
              </button>
            </>
          )}
        </div>
      </div>

      <ListSearchBar
        value={listSearch}
        onChange={setListSearch}
        placeholder="Kërko njoftime…"
      />

      {/* Notifications List */}
      <div className="space-y-5">
        {groupedNotifications.length > 0 ? (
          groupedNotifications.map(([group, groupItems]) => <section key={group} className="space-y-2"><h2 className="px-1 text-xs font-bold uppercase tracking-[.14em] text-[var(--xt-color-text-subtle)]">{group}</h2>{groupItems.map((notification) => {
            const Icon = getNotificationIcon(notification);
            return (
            <article
              key={notification.id}
              className={`xt-card flex min-h-20 cursor-pointer items-center gap-3 border p-4 transition hover:border-[var(--xt-color-gold)]/50 ${
                notification.isRead
                  ? 'border-[var(--xt-color-border)]'
                  : 'border-[var(--xt-color-gold)]/50 bg-[var(--xt-color-gold)]/[.06]'
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <button type="button" onClick={() => handleNotificationClick(notification)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <div className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-full ${notification.isRead ? 'bg-white/5 text-[var(--xt-color-text-muted)]' : 'bg-[var(--xt-color-gold)]/10 text-[var(--xt-color-gold-bright)]'}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <p className={`mb-1 text-[var(--xt-color-text)] ${
                    !notification.isRead ? 'font-bold' : 'font-semibold'
                  }`}>
                    {notification.title}
                  </p>

                  {/* Message */}
                  <p className={`mb-2 text-sm text-[var(--xt-color-text-muted)] ${
                    !notification.isRead ? 'font-medium' : ''
                  }`}>
                    {notification.message}
                  </p>

                  {/* Time */}
                  <p className="text-xs text-[var(--xt-color-text-subtle)]">
                    {getTimeAgo(notification.createdAt)}
                  </p>
                </div>
                </button>

                {/* Mark as read button */}
                {!notification.isRead && (
                  <button
                    onClick={() => {
                      markAsRead(notification.id);
                    }}
                    className="btn btn-quiet min-h-10 ml-auto flex-shrink-0 px-3 text-xs"
                  >
                    ✓
                  </button>
                )}
              </div>
            </article>
          );})}</section>)
        ) : (
          <div className="xt-empty-state xt-card">
            <BellIcon className="h-12 w-12 text-[var(--xt-color-gold)]" />
            <p className="text-xl font-semibold">Nuk ka njoftime</p>
            <p className="text-sm">Njoftimet do të shfaqen këtu kur dikush ndërvepron me përmbajtjen tënde</p>
          </div>
        )}
      </div>
    </main>
  );
};

export default Notifications;
