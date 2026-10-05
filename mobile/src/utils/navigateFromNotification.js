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
  const raw = String(link || '');
  const fromQuery = raw.match(/[?&]tournamentId=(\d+)/i)?.[1];
  if (fromQuery) return Number(fromQuery);
  const fromLink = raw.match(/\/tournaments\/(\d+)/i)?.[1];
  if (fromLink) return Number(fromLink);
  const meta =
    notification?.metadata?.tournamentId ?? notification?.metadata?.tournament_id;
  if (meta != null && String(meta).trim() !== '') return Number(meta);
  if (
    (notification?.entityType === 'tournament' || notification?.type === 'tournament') &&
    notification?.entityId != null
  ) {
    return Number(notification.entityId);
  }
  return null;
}

export function tournamentIdFromNotification(notification) {
  return parseTournamentId(notification?.link, notification);
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

  const entityType = String(notification?.entityType || '').toLowerCase();
  const eventType = String(notification?.eventType || notification?.metadata?.eventType || '').toUpperCase();
  const entityId = notification?.entityId != null ? Number(notification.entityId) : null;

  if (entityType === 'match' || eventType.startsWith('MATCH_')) {
    if (entityId) {
      tabs.navigate('More', { screen: 'MatchDetail', params: { matchId: entityId } });
      return true;
    }
    tabs.navigate('More', { screen: 'Matches' });
    return true;
  }

  if (entityType === 'stream' || eventType.startsWith('STREAM_') || eventType === 'REPLAY_AVAILABLE' || link.includes('/live/')) {
    const streamId = entityId || Number(link.match(/\/live\/(\d+)/)?.[1]);
    if (streamId) {
      tabs.navigate('More', { screen: 'LiveViewer', params: { streamId } });
      return true;
    }
    tabs.navigate('More', { screen: 'Streams' });
    return true;
  }

  if (entityType === 'order' || eventType.startsWith('ORDER_') || eventType === 'PAYMENT_STATUS' || eventType === 'REFUND') {
    tabs.navigate('Marketplace', { screen: 'MarketplaceHome', params: { orderId: entityId || undefined } });
    return true;
  }

  if (entityType === 'wallet' || entityType === 'transaction' || eventType.startsWith('WALLET_') || link.includes('/wallet')) {
    tabs.navigate('More', { screen: 'Wallet' });
    return true;
  }

  if (entityType === 'scouting' || eventType.startsWith('SCOUT_') || link.includes('/scouting')) {
    tabs.navigate('More', { screen: 'Scouting' });
    return true;
  }

  if (entityType === 'club' && entityId) {
    tabs.navigate('Profile', { screen: 'PublicProfile', params: { userId: entityId } });
    return true;
  }

  if (entityType === 'player' && entityId) {
    tabs.navigate('Profile', { screen: 'PublicProfile', params: { userId: entityId } });
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

  if (
    link.includes('/club-roster') ||
    notification?.metadata?.kind === 'club_membership_request' ||
    notification?.entityType === 'club_member' ||
    notification?.entityType === 'club_roster_request'
  ) {
    const tabMatch = link.match(/[?&]tab=([a-z_]+)/i)?.[1];
    const tab = tabMatch === 'staff' || tabMatch === 'pending' || tabMatch === 'approved'
      ? tabMatch
      : 'pending';
    tabs.navigate('More', {
      screen: 'ClubRoster',
      params: { tab },
    });
    return true;
  }

  return false;
}

export function getNotificationIcon(notification) {
  if (notification?.metadata?.type === 'missed_call') return '📞';
  if (
    notification?.metadata?.kind === 'club_membership_request' ||
    String(notification?.link || '').includes('/club-roster')
  ) {
    return '👥';
  }
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
    case 'system': {
      const eventType = String(notification?.eventType || notification?.metadata?.eventType || '');
      if (eventType.startsWith('ORDER_')) return '📦';
      if (eventType.startsWith('WALLET_')) return '🪙';
      if (eventType.startsWith('SCOUT_')) return '🔎';
      if (eventType.startsWith('STREAM_') || eventType === 'REPLAY_AVAILABLE') return '📺';
      return '🔔';
    }
    default:
      return '🔔';
  }
}
