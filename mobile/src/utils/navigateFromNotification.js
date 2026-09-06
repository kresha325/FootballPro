import { getOrCreateConversationRequest, getPostRequest } from '../api/client';

function parsePostId(link, notification) {
  const fromLink = String(link || '').match(/[?&]post=(\d+)/i)?.[1];
  if (fromLink) return Number(fromLink);
  if (notification?.entityType === 'post' && notification?.entityId != null) {
    return Number(notification.entityId);
  }
  return null;
}

function parseProfileId(link, notification) {
  const fromLink = String(link || '').match(/\/profile\/(\d+)/i)?.[1];
  if (fromLink) return Number(fromLink);
  if (notification?.entityType === 'user' && notification?.entityId != null) {
    return Number(notification.entityId);
  }
  if (notification?.type === 'follow' && notification?.actorId != null) {
    return Number(notification.actorId);
  }
  return null;
}

function parseTournamentId(link, notification) {
  const fromLink = String(link || '').match(/\/tournaments\/(\d+)/i)?.[1];
  if (fromLink) return Number(fromLink);
  if (notification?.entityType === 'tournament' && notification?.entityId != null) {
    return Number(notification.entityId);
  }
  return null;
}

/** Tab navigator (Feed, Messages, More, …) from any nested screen. */
export function getRootTabNavigation(navigation) {
  let nav = navigation;
  for (let i = 0; i < 6 && nav; i += 1) {
    const state = nav.getState?.();
    if (state?.type === 'tab') return nav;
    nav = nav.getParent?.();
  }
  return navigation.getParent?.() || navigation;
}

/**
 * Navigate to the right screen for like, comment, message, follow, tournament, etc.
 */
export async function navigateFromNotification(notification, navigation) {
  const tabs = getRootTabNavigation(navigation);
  const type = String(notification?.type || '').toLowerCase();
  const link = String(notification?.link || '');

  if (type === 'message' || link.includes('/messaging')) {
    const existingConversationId = notification?.conversationId;
    if (existingConversationId != null) {
      tabs.navigate('Messages', {
        screen: 'Conversation',
        params: { conversationId: existingConversationId },
      });
      return true;
    }

    const peerId = notification?.actorId ?? notification?.entityId;
    tabs.navigate('Messages', { screen: 'MessagingHome' });
    if (peerId != null) {
      try {
        const res = await getOrCreateConversationRequest(peerId);
        const conv = res?.data;
        const conversationId = conv?.id ?? conv?.conversationId;
        if (conversationId) {
          tabs.navigate('Messages', {
            screen: 'Conversation',
            params: { conversationId },
          });
        }
      } catch (_e) {
        /* stay on messaging list */
      }
    }
    return true;
  }

  const postId = parsePostId(link, notification);
  if (type === 'like' || type === 'comment' || postId) {
    if (postId) {
      try {
        const res = await getPostRequest(postId);
        const post = res?.data;
        if (post) {
          tabs.navigate('Feed', {
            screen: 'FeedPostPager',
            params: { posts: [post], initialIndex: 0 },
          });
          return true;
        }
      } catch (_e) {
        /* fall through to feed home */
      }
    }
    tabs.navigate('Feed', { screen: 'FeedHome' });
    return true;
  }

  const profileId = parseProfileId(link, notification);
  if (type === 'follow' || profileId) {
    if (profileId) {
      tabs.navigate('Profile', {
        screen: 'PublicProfile',
        params: { userId: profileId },
      });
      return true;
    }
  }

  const tournamentId = parseTournamentId(link, notification);
  if (type === 'tournament' || type === 'match' || tournamentId) {
    if (tournamentId) {
      tabs.navigate('More', {
        screen: 'TournamentDetail',
        params: { tournamentId },
      });
      return true;
    }
    tabs.navigate('More', { screen: 'Tournaments' });
    return true;
  }

  return false;
}

export function getNotificationIcon(notification) {
  if (notification?.metadata?.type === 'missed_call') return '📞';
  switch (notification?.type) {
    case 'like':
      return '👍';
    case 'comment':
      return '💬';
    case 'follow':
      return '👤';
    case 'message':
      return '✉️';
    case 'tournament':
      return '🏆';
    case 'match':
      return '⚽';
    case 'achievement':
      return '🎖️';
    default:
      return '🔔';
  }
}
