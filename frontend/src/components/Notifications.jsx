import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { notificationsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

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
      setUnreadCount(response.data.count || 0);
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
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(notifications.map(notif => ({ ...notif, isRead: true })));
      setUnreadCount(0);
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

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like': return '👍';
      case 'comment': return '💬';
      case 'follow': return '👤';
      case 'message': return '✉️';
      case 'tournament': return '🏆';
      case 'match': return '⚽';
      case 'achievement': return '🎖️';
      default: return '🔔';
    }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Njoftime</h1>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <>
              <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full font-semibold">
                {unreadCount} të palexuara
              </span>
              <button
                onClick={markAllAsRead}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
              >
                Shëno të gjitha si të lexuara
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border-l-4 cursor-pointer transition-all hover:shadow-lg ${
                notification.isRead 
                  ? 'border-gray-300 dark:border-gray-600' 
                  : 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="text-3xl flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <p className={`text-gray-900 dark:text-white mb-1 ${
                    !notification.isRead ? 'font-bold' : 'font-semibold'
                  }`}>
                    {notification.title}
                  </p>

                  {/* Message */}
                  <p className={`text-sm text-gray-700 dark:text-gray-300 mb-2 ${
                    !notification.isRead ? 'font-medium' : ''
                  }`}>
                    {notification.message}
                  </p>

                  {/* Time */}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getTimeAgo(notification.createdAt)}
                  </p>
                </div>

                {/* Mark as read button */}
                {!notification.isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm ml-2 flex-shrink-0"
                  >
                    ✓
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-16">
            <div className="text-6xl mb-4">🔔</div>
            <p className="text-xl font-semibold mb-2">Nuk ka njoftime</p>
            <p className="text-sm">Njoftimet do të shfaqen këtu kur dikush ndërvepron me përmbajtjen tënde</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;