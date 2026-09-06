import { navigationRef } from '../navigation/navigationRef';
import { navigateFromNotification } from '../utils/navigateFromNotification';

const TAB_ROOT = {
  getState: () => ({ type: 'tab' }),
  getParent: () => undefined,
  navigate: (name, params) => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('Main', { screen: name, params });
  },
};

async function waitForNavigation(maxMs = 2500) {
  const started = Date.now();
  while (!navigationRef.isReady() && Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return navigationRef.isReady();
}

/**
 * Open the right screen from an Expo push `data` payload.
 */
export async function handlePushOpen(data = {}) {
  const ready = await waitForNavigation();
  if (!ready) return false;

  const type = String(data?.type || '').toLowerCase();

  if (type === 'call' || type === 'incoming_call' || type === 'scheduled_call') {
    // Ringing UI comes from socket + IncomingCallListener (needs SDP/from).
    // Opening the app is enough; avoid IncomingCall without pending payload.
    if (navigationRef.isReady()) {
      navigationRef.navigate('Main');
    }
    return true;
  }

  if (type === 'missed_call') {
    TAB_ROOT.navigate('Messages', { screen: 'MessagingHome' });
    return true;
  }

  if (data?.streamId != null && (type === 'live' || type === 'stream')) {
    TAB_ROOT.navigate('More', {
      screen: 'LiveViewer',
      params: { streamId: data.streamId },
    });
    return true;
  }

  return navigateFromNotification(
    {
      type: data.type,
      link: data.link,
      entityType: data.entityType,
      entityId: data.entityId ?? data.followerId ?? data.postId,
      actorId: data.actorId ?? data.followerId ?? data.senderId,
      conversationId: data.conversationId,
      metadata: data.metadata,
    },
    TAB_ROOT
  );
}
