/**
 * Holds the feed page the pager should show.
 * Navigation params stay small (id + index) so tab switches do not clone the post list.
 */
const session = {
  posts: [],
  onUpdated: null,
};

export function publishFeedPagerSession(posts, onUpdated) {
  session.posts = Array.isArray(posts) ? posts : [];
  session.onUpdated = typeof onUpdated === 'function' ? onUpdated : null;
}

export function readFeedPagerSession() {
  return session;
}
