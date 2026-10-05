import axios from 'axios';
import { BACKEND_URL } from '../config/constants';

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 20000,
});

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_GET_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let onUnauthorized = null;
let unauthorizedInFlight = false;

export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = typeof fn === 'function' ? fn : null;
};

function shouldSkipUnauthorized(error) {
  const config = error?.config;
  if (!config) return true;
  if (config.skipUnauthorized) return true;
  const url = String(config.url || '');
  // Auth attempts and push clear must not trigger session logout (avoids kick-out loops).
  if (/\/api\/auth\/(login|register|forgot-password|reset-password)/i.test(url)) return true;
  if (/\/push-token/i.test(url)) return true;
  return false;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    if (status === 401 && onUnauthorized && !unauthorizedInFlight && !shouldSkipUnauthorized(error)) {
      unauthorizedInFlight = true;
      try {
        await onUnauthorized(error);
      } catch {
        /* ignore */
      } finally {
        unauthorizedInFlight = false;
      }
    }

    const config = error?.config;
    const method = String(config?.method || '').toLowerCase();
    const isNetworkError = !error?.response;

    if (!config || method !== 'get') {
      return Promise.reject(error);
    }

    config.__retryCount = config.__retryCount || 0;
    const canRetry =
      config.__retryCount < MAX_GET_RETRIES &&
      (isNetworkError || RETRYABLE_STATUS.has(status));

    if (!canRetry) {
      return Promise.reject(error);
    }

    config.__retryCount += 1;
    const delayMs = 300 * Math.pow(2, config.__retryCount - 1);
    await sleep(delayMs);
    return api.request(config);
  }
);

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const extractErrorMessage = (error, fallback = 'Ndodhi një gabim') => {
  return (
    error?.response?.data?.msg ||
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

export const loginRequest = (email, password) => api.post('/api/auth/login', { email, password });
export const registerRequest = (payload) => api.post('/api/auth/register', payload);
export const forgotPasswordRequest = (email) => api.post('/api/auth/forgot-password', { email });
export const resetPasswordRequest = (token, password) => api.post('/api/auth/reset-password', { token, password });
export const meRequest = () => api.get('/api/auth/me');
export const oauthProvidersRequest = () => api.get('/api/auth/providers');
export const adminMediaListRequest = (params = {}) => api.get('/api/media/admin', { params });
export const adminMediaDeleteRequest = (id) => api.delete(`/api/media/${id}`);
export const postsRequest = (params = {}) => api.get('/api/posts', { params });
export const getPostRequest = (postId) => api.get(`/api/posts/${postId}`);
export const userPostsRequest = (userId) => api.get(`/api/posts/user/${userId}`);
export const createPostRequest = (payload = {}) => {
  const form = new FormData();
  if (payload.content) {
    form.append('content', String(payload.content));
  }
  if (payload.image) {
    form.append('image', payload.image);
  }
  if (payload.video) {
    form.append('video', payload.video);
  }
  return api.post('/api/posts', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const setPostSponsorsRequest = (postId, sponsorIds = []) =>
  api.post(`/api/posts/${postId}/sponsors`, { sponsorIds });
export const myProfileRequest = () => api.get('/api/profiles/me');
export const profileByIdRequest = (userId) => api.get(`/api/profiles/${userId}`);
export const publicProfileCvRequest = (userId) => api.get(`/api/profiles/cv/${userId}`);
export const profileTournamentSummaryRequest = (userId) =>
  api.get(`/api/profiles/${userId}/tournament-summary`);
export const profilesRequest = (params = {}) => api.get('/api/profiles', { params });
export const clubMembersRequestMembership = (payload) => api.post('/api/club-members/request', payload);
export const clubMembersByClubRequest = (clubId, status = 'approved') =>
  api.get(`/api/club-members/club/${clubId}`, { params: status ? { status } : {} });
export const createMyProfileRequest = (payload = {}) => api.post('/api/profiles/me', payload);
export const updateMyProfileRequest = (payload = {}) => {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'object' && value?.uri && value?.name && value?.type) {
      form.append(key, value);
      return;
    }
    if (typeof value === 'object') {
      form.append(key, JSON.stringify(value));
      return;
    }
    form.append(key, String(value));
  });
  return api.put('/api/profiles/me', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const likePostRequest = (postId) => api.post(`/api/likes/${postId}`);
export const unlikePostRequest = (postId) => api.delete(`/api/likes/${postId}`);
export const postCommentsRequest = (postId) => api.get(`/api/comments/${postId}`);
export const createCommentRequest = (postId, content) => api.post(`/api/comments/${postId}`, { content });
export const deletePostRequest = (postId) => api.delete(`/api/posts/${postId}`);
export const updatePostRequest = (postId, payload = {}) => {
  const form = new FormData();
  if (payload.content !== undefined) form.append('content', String(payload.content ?? ''));
  if (payload.location !== undefined) form.append('location', String(payload.location ?? ''));
  if (payload.removeImage) form.append('removeImage', 'true');
  if (payload.removeVideo) form.append('removeVideo', 'true');
  if (payload.image) form.append('image', payload.image);
  if (payload.video) form.append('video', payload.video);
  return api.put(`/api/posts/${postId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteCommentRequest = (commentId) => api.delete(`/api/comments/${commentId}`);
export const followUserRequest = (userId) => api.post(`/api/profiles/${userId}/follow`);
export const unfollowUserRequest = (userId) => api.delete(`/api/profiles/${userId}/unfollow`);
export const followStatusRequest = (userId) => api.get(`/api/profiles/${userId}/follow-status`);
export const followersListRequest = (userId) => api.get(`/api/profiles/${userId}/followers`);
export const followingListRequest = (userId) => api.get(`/api/profiles/${userId}/following`);
export const myGalleryRequest = () => api.get('/api/gallery');
export const userGalleryRequest = (userId) => api.get(`/api/gallery/user/${userId}`);
export const createGalleryItemRequest = (payload = {}) => {
  const form = new FormData();
  if (payload.title) form.append('title', String(payload.title));
  if (payload.description) form.append('description', String(payload.description));
  if (payload.type) form.append('type', String(payload.type));
  if (payload.file) form.append('image', payload.file);
  return api.post('/api/gallery', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteGalleryItemRequest = (itemId) => api.delete(`/api/gallery/${itemId}`);
export const createStreamRequest = (payload) => api.post('/api/streams', payload);
export const startStreamRequest = (streamId) => api.put(`/api/streams/${streamId}/start`);
export const heartbeatStreamRequest = (streamId, payload = {}) =>
  api.put(`/api/streams/${streamId}/heartbeat`, payload);
export const endStreamRequest = (streamId) => api.put(`/api/streams/${streamId}/end`);
export const streamsRequest = (params = {}) => api.get('/api/streams', { params });
export const uploadStreamRecordingRequest = ({ video, title, description, streamId }) => {
  const form = new FormData();
  form.append('video', video);
  if (title) form.append('title', String(title));
  if (description) form.append('description', String(description));
  if (streamId != null) form.append('streamId', String(streamId));
  return api.post('/api/streams/upload-recording', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
};
export const getStreamRequest = (streamId) => api.get(`/api/streams/${streamId}`);
export const joinStreamRequest = (streamId) => api.post(`/api/streams/${streamId}/join`);
export const leaveStreamRequest = (streamId) => api.post(`/api/streams/${streamId}/leave`);
export const createLiveKitTokenRequest = (payload) => api.post('/api/livekit/token', payload);
export const startAudioCallRequest = (receiverId) => api.post('/api/video-calls/start', { receiverId });
export const createVideoCallRequest = (participantId) => api.post('/api/video-calls/create', { participantId });
export const startVideoCallRequest = (receiverId) => api.post('/api/video-calls/start', { receiverId });
export const endVideoCallRequest = (callId) => api.put(`/api/video-calls/${callId}/end`);

export const conversationsRequest = () => api.get('/api/messaging/conversations');
export const createGroupConversationRequest = (name, memberIds) =>
  api.post('/api/messaging/conversations/group', { name, memberIds });
export const addGroupMembersRequest = (conversationId, memberIds) =>
  api.post(`/api/messaging/conversations/${conversationId}/members`, { memberIds });
export const leaveGroupRequest = (conversationId) =>
  api.post(`/api/messaging/conversations/${conversationId}/leave`);
export const conversationDetailRequest = (conversationId) =>
  api.get(`/api/messaging/conversations/detail/${conversationId}`);
export const messagingUnreadCountRequest = () => api.get('/api/messaging/unread-count');
export const getOrCreateConversationRequest = (userId) => api.get(`/api/messaging/conversations/user/${userId}`);
export const openPrioritySupportChatRequest = (force = false) =>
  api.post(`/api/support/priority-chat${force ? '?force=1' : ''}`);
export const conversationMessagesRequest = (conversationId, params = {}) =>
  api.get(`/api/messaging/conversations/${conversationId}/messages`, { params });
export const sendConversationMessageRequest = (conversationId, options = {}) => {
  const opts = typeof options === 'string' ? { content: options } : options || {};
  const fd = new FormData();
  if (opts.content) fd.append('content', String(opts.content));
  if (opts.replyToId != null) fd.append('replyToId', String(opts.replyToId));
  if (opts.file) fd.append('file', opts.file);
  const hasFile = !!opts.file;
  return api.post(`/api/messaging/conversations/${conversationId}/messages`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: hasFile ? 120000 : 30000,
  });
};
export const markConversationReadRequest = (conversationId) =>
  api.put(`/api/messaging/conversations/${conversationId}/read`);
export const editMessageRequest = (messageId, content) =>
  api.put(`/api/messaging/messages/${messageId}`, { content });
export const deleteMessageRequest = (messageId) => api.delete(`/api/messaging/messages/${messageId}`);
export const searchConversationMessagesRequest = (conversationId, params = {}) =>
  api.get(`/api/messaging/conversations/${conversationId}/messages/search`, { params });
export const toggleMessageReactionRequest = (messageId, emoji) =>
  api.post(`/api/messaging/messages/${messageId}/reactions`, { emoji });
export const forwardMessageRequest = (messageId, conversationId) =>
  api.post(`/api/messaging/messages/${messageId}/forward`, { conversationId });
export const ackMessageDeliveredRequest = (messageId) =>
  api.post(`/api/messaging/messages/${messageId}/delivered`);
export const updateGroupRequest = (conversationId, payload) =>
  api.put(`/api/messaging/conversations/${conversationId}`, payload);
export const removeGroupMemberRequest = (conversationId, userId) =>
  api.delete(`/api/messaging/conversations/${conversationId}/members/${userId}`);
export const setGroupMemberRoleRequest = (conversationId, userId, role) =>
  api.put(`/api/messaging/conversations/${conversationId}/members/${userId}/role`, { role });
export const transferGroupOwnerRequest = (conversationId, userId) =>
  api.post(`/api/messaging/conversations/${conversationId}/transfer`, { userId });
export const userOnlineStatusRequest = (userId) => api.get(`/api/users/${userId}/online`);

export const notificationsRequest = (params = {}) => api.get('/api/notifications', { params });
export const unreadNotificationsCountRequest = () => api.get('/api/notifications/unread-count');
export const markNotificationReadRequest = (notificationId) => api.put(`/api/notifications/${notificationId}/read`);
export const markNotificationUnreadRequest = (notificationId) => api.put(`/api/notifications/${notificationId}/unread`);
export const markAllNotificationsReadRequest = () => api.put('/api/notifications/mark-all-read');
export const deleteNotificationRequest = (notificationId) => api.delete(`/api/notifications/${notificationId}`);
export const notificationPreferencesRequest = () => api.get('/api/notifications/preferences');
export const updateNotificationPreferencesRequest = (preferences) =>
  api.put('/api/notifications/preferences', { preferences });

export const productsRequest = () => api.get('/api/products');
export const productByIdRequest = (id) => api.get(`/api/products/${id}`);
export const createProductRequest = (payload = {}) => {
  const form = new FormData();
  form.append('name', String(payload.name ?? ''));
  form.append('description', String(payload.description ?? ''));
  form.append('price', String(payload.price ?? ''));
  form.append('category', String(payload.category ?? 'gear'));
  if (payload.stock != null && payload.stock !== '') {
    form.append('stock', String(payload.stock));
  }
  if (payload.sellerId != null) {
    form.append('sellerId', String(payload.sellerId));
  }
  if (payload.image?.uri && payload.image?.name && payload.image?.type) {
    form.append('image', payload.image);
  }
  return api.post('/api/products', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const updateProductRequest = (productId, payload = {}) => {
  const form = new FormData();
  form.append('name', String(payload.name ?? ''));
  form.append('description', String(payload.description ?? ''));
  form.append('price', String(payload.price ?? ''));
  form.append('category', String(payload.category ?? 'gear'));
  if (payload.stock != null && payload.stock !== '') {
    form.append('stock', String(payload.stock));
  }
  if (payload.image?.uri && payload.image?.name && payload.image?.type) {
    form.append('image', payload.image);
  }
  return api.put(`/api/products/${productId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteProductRequest = (productId) => api.delete(`/api/products/${productId}`);

export const createOrderRequest = (payload, idempotencyKey) =>
  api.post('/api/orders', Array.isArray(payload) ? { products: payload } : payload, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined);
export const myOrdersRequest = () => api.get('/api/orders');
export const orderByIdRequest = (id) => api.get(`/api/orders/${id}`);
export const sellerOrdersRequest = () => api.get('/api/orders/selling');
export const sellerSummaryRequest = () => api.get('/api/orders/selling/summary');
export const acceptOrderRequest = (id) => api.post(`/api/orders/${id}/accept`);
export const rejectOrderRequest = (id) => api.post(`/api/orders/${id}/reject`);
export const refundOrderRequest = (id) => api.post(`/api/orders/${id}/refund`);
export const updateOrderStatusRequest = (id, status) => api.put(`/api/orders/${id}/status`, { status });
export const cancelOrderRequest = (id) => api.put(`/api/orders/${id}/status`, { status: 'cancelled' });

export const cartRequest = () => api.get('/api/cart');
export const addCartItemRequest = (productId, quantity) => api.post('/api/cart/items', { productId, quantity });
export const updateCartItemRequest = (productId, quantity) => api.patch(`/api/cart/items/${productId}`, { quantity });
export const removeCartItemRequest = (productId) => api.delete(`/api/cart/items/${productId}`);
export const clearCartRequest = () => api.delete('/api/cart');

function idempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const joncoinBalanceRequest = () => api.get('/api/joncoin/balance');
export const joncoinTransactionsRequest = (params) => api.get('/api/joncoin/transactions', { params });
export const joncoinPurchaseRequest = (amount) => api.post('/api/joncoin/purchase', { amount }, { headers: { 'Idempotency-Key': idempotencyKey('deposit') } });
export const joncoinWithdrawRequest = (amount) => api.post('/api/joncoin/withdraw', { amount }, { headers: { 'Idempotency-Key': idempotencyKey('withdraw') } });
export const joncoinTransferRequest = (toUserId, amount, description = '') =>
  api.post('/api/joncoin/transfer', { toUserId, amount, description }, { headers: { 'Idempotency-Key': idempotencyKey('transfer') } });

export const videosRequest = (params = {}) => api.get('/api/videos', { params });
export const userVideosRequest = (userId) => api.get(`/api/videos/user/${userId}`);
export const trendingVideosRequest = (params = {}) => api.get('/api/videos/trending', { params });
export const likeVideoRequest = (videoId) => api.post(`/api/videos/${videoId}/like`);
export const playerMediaRequest = (playerId, params = {}) =>
  api.get(`/api/players/${playerId}/media`, { params });
export const clubMediaRequest = (clubId, params = {}) =>
  api.get(`/api/clubs/${clubId}/media`, { params });
export const matchMediaRequest = (matchId, params = {}) =>
  api.get(`/api/matches/${matchId}/media`, { params });
export const createMediaRequest = (payload) => api.post('/api/media', payload);
export const deleteMediaRequest = (id) => api.delete(`/api/media/${id}`);
export const mediaEventRequest = (id, eventType) =>
  api.post(`/api/media/${id}/events`, { eventType });
export const uploadVideoRequest = (payload = {}) => {
  const form = new FormData();
  if (payload.title) form.append('title', String(payload.title));
  if (payload.description) form.append('description', String(payload.description));
  if (payload.category) form.append('category', String(payload.category));
  if (payload.tags) form.append('tags', String(payload.tags));
  if (payload.video) form.append('video', payload.video);
  return api.post('/api/videos/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const dashboardAnalyticsRequest = (period = 30) =>
  api.get('/api/analytics/dashboard', { params: { period } });
export const followerGrowthAnalyticsRequest = (period = 30) =>
  api.get('/api/analytics/follower-growth', { params: { period } });
export const engagementRateAnalyticsRequest = (period = 30) =>
  api.get('/api/analytics/engagement-rate', { params: { period } });

export const gamificationUserRequest = () => api.get('/api/gamification/user');
export const gamificationAchievementsRequest = () => api.get('/api/gamification/achievements');
export const transferHistoryByUserRequest = (userId) => api.get(`/api/transfer-history/user/${userId}`);
export const transferHistoryPendingForClubRequest = () => api.get('/api/transfer-history/pending-for-club');
export const addTransferHistoryRequest = (payload) => api.post('/api/transfer-history', payload);
export const updateTransferHistoryRequest = (transferId, payload) =>
  api.put(`/api/transfer-history/${transferId}`, payload);
export const confirmTransferHistoryRequest = (transferId) =>
  api.post(`/api/transfer-history/${transferId}/confirm`);
export const rejectTransferHistoryRequest = (transferId, reason) =>
  api.post(`/api/transfer-history/${transferId}/reject`, reason ? { reason } : {});
export const deleteTransferHistoryRequest = (transferId) => api.delete(`/api/transfer-history/${transferId}`);
export const clubStaffByClubRequest = (clubId, params = {}) =>
  api.get(`/api/club-staff/club/${clubId}`, { params });
export const updateClubStaffRequest = (staffMemberId, payload) =>
  api.patch(`/api/club-staff/${staffMemberId}`, payload);
export const removeClubStaffRequest = (staffMemberId) => api.delete(`/api/club-staff/${staffMemberId}`);
export const clubStaffAssignmentsRequest = (staffId) => api.get(`/api/club-staff/staff/${staffId}`);
export const gamificationBadgesRequest = () => api.get('/api/gamification/badges');
export const gamificationLeaderboardRequest = () => api.get('/api/gamification/leaderboard');

export const tournamentsRequest = () => api.get('/api/tournaments');
export const tournamentByIdRequest = (tournamentId) => api.get(`/api/tournaments/${tournamentId}`);
export const createTournamentRequest = (payload) => api.post('/api/tournaments', payload);
export const tournamentStandingsRequest = (tournamentId) => api.get(`/api/tournaments/${tournamentId}/standings`);
export const tournamentMatchesRequest = (tournamentId) => api.get(`/api/tournaments/${tournamentId}/matches`);
export const tournamentBracketRequest = (tournamentId) => api.get(`/api/tournaments/${tournamentId}/bracket`);
export const tournamentStatsRequest = (tournamentId) => api.get(`/api/tournaments/${tournamentId}/stats`);
export const tournamentMatchDetailRequest = (tournamentId, matchId) =>
  api.get(`/api/tournaments/${tournamentId}/matches/${matchId}`);
export const trendingTournamentsRequest = () => api.get('/api/tournaments/trending');
export const joinTournamentRequest = (tournamentId, payload = {}) =>
  api.post(`/api/tournaments/${tournamentId}/join`, payload);
export const tournamentSquadRequest = (tournamentId, clubUserId) =>
  api.get(`/api/tournaments/${tournamentId}/squad`, {
    params: clubUserId ? { clubUserId } : undefined,
  });
export const setTournamentSquadRequest = (tournamentId, athleteIds) =>
  api.put(`/api/tournaments/${tournamentId}/squad`, { athleteIds });
export const leaveTournamentRequest = (tournamentId) => api.delete(`/api/tournaments/${tournamentId}/leave`);
export const startTournamentRequest = (tournamentId) => api.post(`/api/tournaments/${tournamentId}/start`);
export const generateTournamentBracketRequest = (tournamentId) =>
  api.post(`/api/tournaments/${tournamentId}/bracket/generate`);
export const updateTournamentMatchScoreRequest = (matchId, payload) =>
  api.put(`/api/tournaments/matches/${matchId}/score`, payload);

export const acceptTournamentParticipantRequest = (tournamentId, userId) =>
  api.put(`/api/tournaments/${tournamentId}/participants/${userId}/accept`);

export const rejectTournamentParticipantRequest = (tournamentId, userId) =>
  api.put(`/api/tournaments/${tournamentId}/participants/${userId}/reject`);

export const publicConfigRequest = () => api.get('/api/config/public');

export const registerPushTokenRequest = (token, type = 'mobile', deviceId = null) =>
  api.post(
    '/api/profiles/me/push-token',
    { token: token || null, type, deviceId },
    { skipUnauthorized: true }
  );

export const premiumCheckoutRequest = (plan) => api.post('/api/premium/checkout', { plan });
export const premiumVerifySessionRequest = (sessionId) => api.get(`/api/premium/verify-session/${sessionId}`);

export const iapCatalogRequest = () => api.get('/api/iap/catalog');
export const verifyIapPurchaseRequest = (payload) => api.post('/api/iap/verify', payload);

export const scoutingRecommendationsRequest = (params = {}) =>
  api.get('/api/scouting/recommendations', { params });
export const scoutingDashboardRequest = () => api.get('/api/scouting/dashboard');
export const scoutingPlayersRequest = (params = {}) => api.get('/api/scouting/players', { params });
export const scoutingShortlistRequest = (params = {}) => api.get('/api/scouting/shortlist', { params });
export const scoutingAddShortlistRequest = (data) => api.post('/api/scouting/shortlist', data);
export const scoutingUpdateShortlistRequest = (id, data) => api.put(`/api/scouting/shortlist/${id}`, data);
export const scoutingRemoveShortlistRequest = (id) => api.delete(`/api/scouting/shortlist/${id}`);
export const scoutingWatchlistRequest = (params = {}) => api.get('/api/scouting/watchlist', { params });
export const scoutingAddWatchlistRequest = (data) => api.post('/api/scouting/watchlist', data);
export const scoutingRemoveWatchlistRequest = (id) => api.delete(`/api/scouting/watchlist/${id}`);
export const scoutingReportsRequest = (params = {}) => api.get('/api/scouting/reports', { params });
export const scoutingCreateReportRequest = (data) => api.post('/api/scouting/reports', data);
export const scoutingUpdateReportRequest = (id, data) => api.put(`/api/scouting/reports/${id}`, data);
export const scoutingRemoveReportRequest = (id) => api.delete(`/api/scouting/reports/${id}`);
export const scoutingCompareRequest = (params = {}) => api.get('/api/scouting/compare', { params });

export const searchEverythingRequest = (params = {}) => api.get('/api/search', { params });
export const searchUsersRequest = (params = {}) => api.get('/api/search/users', { params });
export const searchPostsRequest = (params = {}) => api.get('/api/search/posts', { params });
export const searchSuggestionsRequest = (params = {}) => api.get('/api/search/suggestions', { params });
export const trendingSearchUsersRequest = () => api.get('/api/search/trending/users');
export const trendingSearchPostsRequest = () => api.get('/api/search/trending/posts');
export const recommendedUsersRequest = (params = {}) =>
  api.get('/api/search/recommended', { params });
/** Browse people you don't follow — same backend as recommended (stable path). */
export const browseUsersRequest = (params = {}) =>
  api.get('/api/search/recommended', { params });

export const matchesRequest = () => api.get('/api/matches');
export const matchByIdRequest = (matchId) => api.get(`/api/matches/${matchId}`);
export const calendarRequest = (params) => api.get('/api/calendar', { params });
export const competitionPlayerStatsRequest = (tournamentId) =>
  api.get(`/api/tournaments/${tournamentId}/player-stats`);
export const createMatchRequest = (payload) => api.post('/api/matches', payload);
export const updateMatchRequest = (matchId, payload) => api.put(`/api/matches/${matchId}`, payload);
export const updateMatchScoreRequest = (matchId, payload) => api.put(`/api/matches/${matchId}/score`, payload);

export const adminAnalyticsRequest = () => api.get('/api/admin/analytics');
export const adminUsersRequest = (params = {}) => api.get('/api/admin/users', { params });
export const adminPostsRequest = (params = {}) => api.get('/api/admin/posts', { params });
export const adminTogglePremiumRequest = (userId) => api.post(`/api/admin/users/${userId}/premium`);
export const adminVerifyUserRequest = (userId) => api.post(`/api/admin/users/${userId}/verify`);
export const adminBanUserRequest = (userId, reason = 'Admin action') =>
  api.post(`/api/admin/users/${userId}/ban`, { reason });
export const adminUnbanUserRequest = (userId) => api.post(`/api/admin/users/${userId}/unban`);
export const adminDeleteUserRequest = (userId) => api.delete(`/api/admin/users/${userId}`);
export const adminUpdateUserRoleRequest = (userId, role) => api.put(`/api/admin/users/${userId}/role`, { role });
export const adminResetUserPasswordRequest = (userId, newPassword) =>
  api.post(`/api/admin/users/${userId}/reset-password`, { newPassword });
export const adminDeletePostRequest = (postId) => api.delete(`/api/admin/posts/${postId}`);
export const adminJoncoinPendingRequest = () => api.get('/api/admin/joncoin/pending');
export const adminJoncoinUpdateStatusRequest = (txId, status) =>
  api.patch(`/api/joncoin/transaction/${txId}`, { status });
export const adminReportsRequest = (params = {}) =>
  api.get('/api/moderation/admin/reports', { params });
export const adminReviewReportRequest = (reportId, status) =>
  api.put(`/api/moderation/admin/reports/${reportId}`, { status });
export const adminInvoicesRequest = (params = {}) => api.get('/api/admin/invoices', { params });
export const adminTournamentsRequest = (params = {}) => api.get('/api/admin/tournaments', { params });
export const adminUpdateTournamentRequest = (id, payload) =>
  api.put(`/api/admin/tournaments/${id}`, payload);
export const adminDeleteTournamentRequest = (id) => api.delete(`/api/admin/tournaments/${id}`);
export const adminStadiumsRequest = (params = {}) => api.get('/api/stadiums', { params });
export const adminDeleteStadiumRequest = (id) => api.delete(`/api/stadiums/${id}`);
export const adminCreateStadiumRequest = (payload = {}) => {
  const form = new FormData();
  form.append('name', String(payload.name || '').trim());
  form.append('city', String(payload.city || '').trim());
  form.append('country', String(payload.country || '').trim());
  form.append('capacity', payload.capacity === '' || payload.capacity == null ? '' : String(payload.capacity));
  form.append('address', String(payload.address || '').trim());
  form.append('featured', payload.featured === true || payload.featured === 'true' ? 'true' : 'false');
  if (payload.featured === true || payload.featured === 'true') {
    form.append('days', payload.days === '' || payload.days == null ? '7' : String(payload.days));
  }
  if (payload.photo && typeof payload.photo === 'object' && payload.photo.uri) {
    form.append('photo', payload.photo);
  } else if (typeof payload.photo === 'string' && payload.photo.trim()) {
    form.append('photo', payload.photo.trim());
  }
  if (payload.clearPhoto) form.append('clearPhoto', String(payload.clearPhoto));
  return api.post('/api/stadiums', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const adminUpdateStadiumRequest = (id, payload = {}) => {
  const form = new FormData();
  form.append('name', String(payload.name || '').trim());
  form.append('city', String(payload.city || '').trim());
  form.append('country', String(payload.country || '').trim());
  form.append('capacity', payload.capacity === '' || payload.capacity == null ? '' : String(payload.capacity));
  form.append('address', String(payload.address || '').trim());
  form.append('featured', payload.featured === true || payload.featured === 'true' ? 'true' : 'false');
  if (payload.featured === true || payload.featured === 'true') {
    form.append('days', payload.days === '' || payload.days == null ? '7' : String(payload.days));
  }
  if (payload.photo && typeof payload.photo === 'object' && payload.photo.uri) {
    form.append('photo', payload.photo);
  } else if (typeof payload.photo === 'string' && payload.photo.trim()) {
    form.append('photo', payload.photo.trim());
  }
  if (payload.clearPhoto) form.append('clearPhoto', String(payload.clearPhoto));
  return api.put(`/api/stadiums/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const clubRosterRequestsRequest = () => api.get('/api/club-roster/requests');
export const clubRosterPendingRequest = () => api.get('/api/club-roster/pending');
export const submitClubRosterRequest = (payload) => api.post('/api/club-roster/request', payload);
export const approveClubRosterRequest = (requestId) => api.put(`/api/club-roster/requests/${requestId}/approve`);
export const rejectClubRosterRequest = (requestId) => api.put(`/api/club-roster/requests/${requestId}/reject`);
export const removeClubRosterRequest = (requestId) => api.delete(`/api/club-roster/requests/${requestId}`);
export const clubRosterByClubRequest = (clubId) => api.get(`/api/club-roster/club/${clubId}`);

export const parentVerificationRequest = (parentEmail) =>
  api.post('/api/verification/parent-request', { parentEmail });

export const sponsorsRequest = () => api.get('/api/sponsors/all');
export const sponsorsByUserRequest = (userId) => api.get(`/api/sponsors/user/${userId}`);
export const updateSponsorRequest = (sponsorId, payload = {}) =>
  api.put(`/api/sponsors/${sponsorId}`, payload);
export const deleteSponsorRequest = (sponsorId) => api.delete(`/api/sponsors/${sponsorId}`);

export const createSponsorRequest = (payload = {}) => {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'object' && value?.uri && value?.name && value?.type) {
      form.append(key, value);
      return;
    }
    form.append(key, String(value));
  });
  return api.post('/api/sponsors', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const youtubeResolveChannelRequest = (url) =>
  api.get('/api/youtube/resolve', { params: { url } });

export const aiGenerateBioRequest = (payload = {}) => api.post('/api/ai/generate-bio', payload);
export const aiScoutSummaryRequest = (userId) => api.post(`/api/ai/scout-summary/${userId}`);
export const aiSuggestPostRequest = (payload = {}) => api.post('/api/ai/suggest-post', payload);
export const aiStatusRequest = () => api.get('/api/ai/status');

export const adsRequest = () => api.get('/api/ads');
export const createAdRequest = (payload = {}) => {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'object' && value?.uri && value?.name && value?.type) {
      form.append(key, value);
      return;
    }
    form.append(key, String(value));
  });
  return api.post('/api/ads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const createReportRequest = (payload) => api.post('/api/moderation/reports', payload);
export const blockUserRequest = (userId) => api.post(`/api/moderation/blocks/${userId}`);
export const unblockUserRequest = (userId) => api.delete(`/api/moderation/blocks/${userId}`);
export const blockStatusRequest = (userId) => api.get(`/api/moderation/blocks/${userId}/status`);
export const myBlocksRequest = () => api.get('/api/moderation/blocks');
export const deleteMyAccountRequest = (payload) => api.delete('/api/moderation/account', { data: payload });

export default api;
