import axios from 'axios';
import { BACKEND_URL } from '../config/constants';

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15000,
});

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_GET_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    const method = String(config?.method || '').toLowerCase();
    const status = error?.response?.status;
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

export const extractErrorMessage = (error, fallback = 'Something went wrong') => {
  return (
    error?.response?.data?.msg ||
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
export const deleteCommentRequest = (commentId) => api.delete(`/api/comments/${commentId}`);
export const followUserRequest = (userId) => api.post(`/api/profiles/${userId}/follow`);
export const unfollowUserRequest = (userId) => api.delete(`/api/profiles/${userId}/unfollow`);
export const followStatusRequest = (userId) => api.get(`/api/profiles/${userId}/follow-status`);
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
export const startAudioCallRequest = (receiverId) => api.post('/api/video-calls/start', { receiverId });
export const createVideoCallRequest = (participantId) => api.post('/api/video-calls/create', { participantId });

export const conversationsRequest = () => api.get('/api/messaging/conversations');
export const conversationDetailRequest = (conversationId) =>
  api.get(`/api/messaging/conversations/detail/${conversationId}`);
export const messagingUnreadCountRequest = () => api.get('/api/messaging/unread-count');
export const getOrCreateConversationRequest = (userId) => api.get(`/api/messaging/conversations/user/${userId}`);
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

export const notificationsRequest = (params = {}) => api.get('/api/notifications', { params });
export const unreadNotificationsCountRequest = () => api.get('/api/notifications/unread-count');
export const markNotificationReadRequest = (notificationId) => api.put(`/api/notifications/${notificationId}/read`);
export const markAllNotificationsReadRequest = () => api.put('/api/notifications/mark-all-read');
export const deleteNotificationRequest = (notificationId) => api.delete(`/api/notifications/${notificationId}`);

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

export const createOrderRequest = (products) => api.post('/api/orders', { products });
export const myOrdersRequest = () => api.get('/api/orders');

export const joncoinBalanceRequest = () => api.get('/api/joncoin/balance');
export const joncoinTransactionsRequest = () => api.get('/api/joncoin/transactions');
export const joncoinPurchaseRequest = (amount) => api.post('/api/joncoin/purchase', { amount });
export const joncoinWithdrawRequest = (amount) => api.post('/api/joncoin/withdraw', { amount });
export const joncoinTransferRequest = (toUserId, amount, description = '') =>
  api.post('/api/joncoin/transfer', { toUserId, amount, description });

export const videosRequest = (params = {}) => api.get('/api/videos', { params });
export const userVideosRequest = (userId) => api.get(`/api/videos/user/${userId}`);
export const trendingVideosRequest = (params = {}) => api.get('/api/videos/trending', { params });
export const likeVideoRequest = (videoId) => api.post(`/api/videos/${videoId}/like`);
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
export const addTransferHistoryRequest = (payload) => api.post('/api/transfer-history', payload);
export const updateTransferHistoryRequest = (transferId, payload) =>
  api.put(`/api/transfer-history/${transferId}`, payload);
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
export const joinTournamentRequest = (tournamentId) => api.post(`/api/tournaments/${tournamentId}/join`);
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

export const registerPushTokenRequest = (token, type = 'mobile') =>
  api.post('/api/profiles/me/push-token', { token, type });

export const premiumCheckoutRequest = (plan) => api.post('/api/premium/checkout', { plan });
export const premiumVerifySessionRequest = (sessionId) => api.get(`/api/premium/verify-session/${sessionId}`);

export const scoutingRecommendationsRequest = (params = {}) =>
  api.get('/api/scouting/recommendations', { params });

export const searchEverythingRequest = (params = {}) => api.get('/api/search', { params });
export const searchUsersRequest = (params = {}) => api.get('/api/search/users', { params });
export const searchPostsRequest = (params = {}) => api.get('/api/search/posts', { params });
export const searchSuggestionsRequest = (params = {}) => api.get('/api/search/suggestions', { params });
export const trendingSearchUsersRequest = () => api.get('/api/search/trending/users');
export const trendingSearchPostsRequest = () => api.get('/api/search/trending/posts');
export const recommendedUsersRequest = () => api.get('/api/search/recommended');

export const matchesRequest = () => api.get('/api/matches');
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
export const adminDeleteUserRequest = (userId) => api.delete(`/api/admin/users/${userId}`);
export const adminUpdateUserRoleRequest = (userId, role) => api.put(`/api/admin/users/${userId}/role`, { role });
export const adminResetUserPasswordRequest = (userId, newPassword) =>
  api.post(`/api/admin/users/${userId}/reset-password`, { newPassword });
export const adminDeletePostRequest = (postId) => api.delete(`/api/admin/posts/${postId}`);

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

export default api;
