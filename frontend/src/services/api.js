export const matchScorersAPI = {
  saveMatchScorers: (matchId, scorers) => API.post(`/matches/${matchId}/scorers`, { scorers }),
};
/* =========================
   MATCHES
========================= */
export const matchesAPI = {
  getMatches: () => API.get('/matches'),
  createMatch: (data) => API.post('/matches', data),
  updateMatchScore: (id, data) => API.put(`/matches/${id}/score`, data),
};
/* =========================
   USER MATCHES
========================= */
export const userMatchesAPI = {
  getStats: () => API.get('/user-matches/stats'),
};
/* =========================
   LIGA
========================= */
export const ligaAPI = {
  getAllLigas: (params) => API.get('/ligas', { params }),
  getLiga: (id) => API.get(`/ligas/${id}`),
  createLiga: (data) => API.post('/ligas', data, {
    headers: { 'Content-Type': 'application/json' }
  }),
  updateLiga: (data) => API.put('/ligas/me', data, {
    headers: { 'Content-Type': 'application/json' }
  }),
  deleteLiga: () => API.delete('/ligas/me'),
  joinLiga: (ligaUserId) => API.post(`/ligas/${ligaUserId}/join`),
  leaveLiga: (ligaUserId) => API.delete(`/ligas/${ligaUserId}/leave`),
  removeClub: (clubId) => API.delete(`/ligas/clubs/${clubId}`),
};
/* =========================
   STADIUMS
========================= */
export const stadiumsAPI = {
  getAll: (params) => API.get('/stadiums', { params }),
  getFeatured: () => API.get('/stadiums/featured'),
  getStadium: (id) => API.get(`/stadiums/${id}`),
  getMatches: (id, params) => API.get(`/stadiums/${id}/matches`, { params }),
};
import axios from 'axios';

const resolveApiBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.length > 0) {
    return envApiUrl.replace(/\/$/, '');
  }

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:10000/api';
  }

  return `${window.location.origin.replace(/\/$/, '')}/api`;
};

const API_BASE_URL = resolveApiBaseUrl();

const API = axios.create({
  baseURL: API_BASE_URL,
});

export const extractApiMessage = (error, fallback = 'Ndodhi një gabim') =>
  error?.response?.data?.msg ||
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

if (import.meta.env.DEV) {
  console.log('FRONTEND: API baseURL =', API_BASE_URL);
}

// Interceptor për Authorization header
API.interceptors.request.use(config => {
  // Merr token-in nga localStorage (ose nga context nëse ke)
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* =========================
   SPONSORS
========================= */
export const sponsorAPI = {
  getAllSponsors: () => API.get('/sponsors/all'),
  getSponsorsByUser: (userId) => API.get(`/sponsors/user/${userId}`),
  createSponsor: (data) => {
    // If FormData, set multipart headers
    if (data instanceof FormData) {
      return API.post('/sponsors', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return API.post('/sponsors', data);
  },
  updateSponsor: (id, data) => API.put(`/sponsors/${id}`, data),
  deleteSponsor: (id) => API.delete(`/sponsors/${id}`),
};
/* =========================
   ADS
========================= */
export const adsAPI = {
  getAds: () => API.get('/ads'),
  createAd: (data) => {
    // data: FormData (title, text, color, days, image)
    return API.post('/ads', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

/**
 * Attach JWT token automatically
 */
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
/* =========================
AUTH
========================= */
export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  register: (data) => API.post('/auth/register', data),
  me: () => API.get('/auth/me'),
  forgotPassword: (email) => API.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => API.post('/auth/reset-password', { token, password }),
  oauthProviders: () => API.get('/auth/providers'),
};

/* =========================
   VERIFICATION
========================= */
export const verificationAPI = {
  parentRequest: (data) => API.post('/verification/parent-request', data),
  parentConfirm: (token) => API.get(`/verification/parent-confirm?token=${token}`),
};

/* =========================
   POSTS / FEED ✅ FIX
========================= */
export const postsAPI = {
  getPosts: (params) => API.get('/posts', { params }),
  getUserPosts: (userId) => API.get(`/posts/user/${userId}`),
  createPost: (data) => {
    // Check if data is FormData (for file uploads) or regular object
    if (data instanceof FormData) {
      return API.post('/posts', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return API.post('/posts', data);
  },
  deletePost: (id) => API.delete(`/posts/${id}`),
  updatePost: (id, data) => {
    if (data instanceof FormData) {
      return API.put(`/posts/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return API.put(`/posts/${id}`, data);
  },
  likePost: (id) => API.post(`/likes/${id}`),
  unlikePost: (id) => API.delete(`/likes/${id}`),
  getComments: (postId) => API.get(`/comments/${postId}`),
  commentPost: (id, data) => API.post(`/comments/${id}`, data),
  deleteComment: (commentId) => API.delete(`/comments/${commentId}`),
};

/* =========================
   PROFILE
========================= */
export const profileAPI = {
  getAllProfiles: (params) => API.get('/profiles', { params }),
  getLandingShowcase: (params) => API.get('/profiles/showcase', { params }),
  getMyProfile: () => API.get('/profiles/me'),
  getProfile: (id) => API.get(`/profiles/${id}`),
  getPublicCv: (id) => API.get(`/profiles/cv/${id}`),
  getProfileTournamentSummary: (userId) => API.get(`/profiles/${userId}/tournament-summary`),
  createProfile: (data) => API.post(`/profiles/me`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateProfile: (data) => API.put(`/profiles/me`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  followUser: (userId) => API.post(`/profiles/${userId}/follow`),
  unfollowUser: (userId) => API.delete(`/profiles/${userId}/unfollow`),
  getFollowers: (userId) => API.get(`/profiles/${userId}/followers`),
  getFollowing: (userId) => API.get(`/profiles/${userId}/following`),
  checkFollowStatus: (userId) => API.get(`/profiles/${userId}/follow-status`),
};

/* =========================
   GALLERY
========================= */
export const galleryAPI = {
  getGallery: () => API.get('/gallery'),
  getUserGallery: (userId) => API.get(`/gallery/user/${userId}`),
  uploadMedia: (data) => API.post('/gallery', data),
  deleteMedia: (id) => API.delete(`/gallery/${id}`),
};

/* =========================
   SEARCH
========================= */
export const searchAPI = {
  search: (query) => API.get('/search', { params: { q: query } }),
  searchUsers: (params) => API.get('/search/users', { params }),
  searchPosts: (params) => API.get('/search/posts', { params }),
  getSuggestions: (q, type = 'all') => API.get('/search/suggestions', { params: { q, type } }),
  getTrendingPosts: () => API.get('/search/trending/posts'),
  getTrendingUsers: () => API.get('/search/trending/users'),
  getRecommended: (params) => API.get('/search/recommended', { params }),
  getBrowseUsers: (params) => API.get('/search/recommended', { params }),
};

/* =========================
   MESSAGING
========================= */
export const messagingAPI = {
  getConversations: () => API.get('/messaging/conversations'),
  getOrCreateConversation: (userId) => API.get(`/messaging/conversations/user/${userId}`),
  getConversationMessages: (conversationId) => API.get(`/messaging/conversations/${conversationId}/messages`),
  sendConversationMessage: (conversationId, data) => API.post(`/messaging/conversations/${conversationId}/messages`, data),
  markAsRead: (conversationId) => API.put(`/messaging/conversations/${conversationId}/read`),
  // Legacy endpoints (keep for backwards compatibility)
  getMessages: (id) => API.get(`/messaging/${id}`),
  sendMessage: (id, data) => API.post(`/messaging/${id}`, data),
  getUnreadCount: () => API.get('/messaging/unread-count'),
};

export const supportAPI = {
  openPriorityChat: (opts = {}) =>
    API.post(`/support/priority-chat${opts.force ? '?force=1' : ''}`, opts.body || {}),
};

/* =========================
   NOTIFICATIONS
========================= */
export const notificationsAPI = {
  getNotifications: (params) => API.get('/notifications', { params }),
  getUnreadCount: (params) => API.get('/notifications/unread-count', { params }),
  markAsRead: (id) => API.put(`/notifications/${id}/read`),
  markAsUnread: (id) => API.put(`/notifications/${id}/unread`),
  markAllAsRead: () => API.put('/notifications/mark-all-read'),
  deleteNotification: (id) => API.delete(`/notifications/${id}`),
  getPreferences: () => API.get('/notifications/preferences'),
  updatePreferences: (preferences) => API.put('/notifications/preferences', { preferences }),
};

/* =========================
   STREAMS
========================= */
export const streamsAPI = {
  getStreams: (params) => API.get('/streams', { params: params || {} }),
  discovery: (params) => API.get('/streams/discovery', { params: params || {} }),
  getStream: (streamId) => API.get(`/streams/${streamId}`),
  createStream: (data) => API.post('/streams', data),
  startStream: (streamId) => API.put(`/streams/${streamId}/start`),
  heartbeatStream: (streamId, data = {}) => API.put(`/streams/${streamId}/heartbeat`, data),
  endStream: (streamId) => API.put(`/streams/${streamId}/end`),
  cancelStream: (streamId) => API.put(`/streams/${streamId}/cancel`),
  joinStream: (streamId) => API.post(`/streams/${streamId}/join`),
  leaveStream: (streamId) => API.post(`/streams/${streamId}/leave`),
  uploadTemp: (formData) => API.post('/streams/upload-temp', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteTemp: (filename) => API.delete(`/streams/temp/${filename}`),
  finalize: (data) => API.post('/streams/finalize', data),
  uploadRecording: (formData) =>
    API.post('/streams/upload-recording', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  saveReplay: (streamId, data) => API.post(`/streams/${streamId}/save-replay`, data),
};

export const liveStreamAPI = {
  start: (data) => API.post('/live-stream/start', data),
  end: (streamId) => API.post(`/live-stream/${streamId}/end`),
  getActive: () => API.get('/live-stream/active'),
};

export const livekitAPI = {
  createToken: (payload) => API.post('/livekit/token', payload),
};

/* =========================
   MARKETPLACE
========================= */
export const marketplaceAPI = {
  getProducts: (params) => API.get('/products', { params }),
  getProduct: (id) => API.get(`/products/${id}`),
  getMine: () => API.get('/products/mine'),
};

export const cartAPI = {
  get: () => API.get('/cart'),
  add: (productId, quantity) => API.post('/cart/items', { productId, quantity }),
  update: (productId, quantity) => API.patch(`/cart/items/${productId}`, { quantity }),
  remove: (productId) => API.delete(`/cart/items/${productId}`),
  clear: () => API.delete('/cart'),
  quote: (products) => API.post('/cart/quote', { products }),
};

/* =========================
   ORDERS
========================= */
export const ordersAPI = {
  createOrder: (data, idempotencyKey) => API.post('/orders', data, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined),
  getMyOrders: () => API.get('/orders'),
  getSellerOrders: () => API.get('/orders/selling'),
  getSellerSummary: () => API.get('/orders/selling/summary'),
  getOrder: (id) => API.get(`/orders/${id}`),
  acceptOrder: (id) => API.post(`/orders/${id}/accept`),
  rejectOrder: (id) => API.post(`/orders/${id}/reject`),
  refundOrder: (id) => API.post(`/orders/${id}/refund`),
  updateStatus: (id, status) => API.put(`/orders/${id}/status`, { status }),
  cancelOrder: (id) => API.put(`/orders/${id}/status`, { status: 'cancelled' }),
};

/* =========================
   SCOUTING
========================= */
export const scoutingAPI = {
  getMeta: () => API.get('/scouting/meta'),
  getDashboard: (config = {}) => API.get('/scouting/dashboard', config),
  getRecommendations: (params, config = {}) => API.get('/scouting/recommendations', { ...config, params }),
  getPlayers: (params, config = {}) => API.get('/scouting/players', { ...config, params }),
  getPlayer: (id, config = {}) => API.get(`/scouting/players/${id}`, config),
  getPreferences: () => API.get('/scouting/preferences'),
  savePreferences: (data) => API.put('/scouting/preferences', data),
  getShortlist: (params) => API.get('/scouting/shortlist', { params }),
  addShortlist: (data) => API.post('/scouting/shortlist', data),
  updateShortlist: (id, data) => API.put(`/scouting/shortlist/${id}`, data),
  removeShortlist: (id) => API.delete(`/scouting/shortlist/${id}`),
  getWatchlist: (params) => API.get('/scouting/watchlist', { params }),
  addWatchlist: (data) => API.post('/scouting/watchlist', data),
  removeWatchlist: (id) => API.delete(`/scouting/watchlist/${id}`),
  getReports: (params) => API.get('/scouting/reports', { params }),
  createReport: (data) => API.post('/scouting/reports', data),
  updateReport: (id, data) => API.put(`/scouting/reports/${id}`, data),
  removeReport: (id) => API.delete(`/scouting/reports/${id}`),
  getCandidates: (params) => API.get('/scouting/candidates', { params }),
  comparePlayers: (params) => API.get('/scouting/compare', { params }),
};

/* =========================
   GAMIFICATION
========================= */
export const gamificationAPI = {
  getUserStatus: (userId) => API.get(`/gamification/user${userId ? `/${userId}` : ''}`),
  getAchievements: () => API.get('/gamification/achievements'),
  getBadges: () => API.get('/gamification/badges'),
  getLeaderboard: () => API.get('/gamification/leaderboard'),
};

/* =========================
   ANALYTICS
========================= */
export const analyticsAPI = {
  getDashboard: (period) => API.get(`/analytics/dashboard?period=${period}`),
  getFollowerGrowth: (period) => API.get(`/analytics/follower-growth?period=${period}`),
  getEngagementRate: (period) => API.get(`/analytics/engagement-rate?period=${period}`),
};
// Stream-related API removed

/* =========================
   CLUB MEMBERS
========================= */
export const clubMembersAPI = {
  getClubMembers: (clubId, status) => API.get(`/club-members/club/${clubId}${status ? `?status=${status}` : ''}`),
  getAthleteMemberships: (athleteId) => API.get(`/club-members/athlete/${athleteId}`),
  requestMembership: (data) => API.post('/club-members/request', data),
  updateMembershipStatus: (membershipId, status, extra = {}) =>
    API.put(`/club-members/${membershipId}/status`, { status, ...extra }),
  updateMember: (membershipId, data) => API.patch(`/club-members/${membershipId}`, data),
  removeMember: (membershipId) => API.delete(`/club-members/${membershipId}`),
};

/* =========================
   TRANSFER HISTORY
========================= */
export const transferHistoryAPI = {
  getUserTransfers: (userId) => API.get(`/transfer-history/user/${userId}`),
  getClubTransfers: (clubName) => API.get(`/transfer-history/club/${clubName}`),
  getPendingForClub: () => API.get('/transfer-history/pending-for-club'),
  addTransfer: (data) => API.post('/transfer-history', data),
  updateTransfer: (transferId, data) => API.put(`/transfer-history/${transferId}`, data),
  confirmTransfer: (transferId) => API.post(`/transfer-history/${transferId}/confirm`),
  rejectTransfer: (transferId, reason) =>
    API.post(`/transfer-history/${transferId}/reject`, reason ? { reason } : {}),
  deleteTransfer: (transferId) => API.delete(`/transfer-history/${transferId}`),
};

/* =========================
   CLUB STAFF
========================= */
export const clubStaffAPI = {
  getClubStaff: (clubId, params) => API.get(`/club-staff/club/${clubId}`, { params }),
  getStaffAssignments: (staffId) => API.get(`/club-staff/staff/${staffId}`),
  addStaff: (data) => API.post('/club-staff', data),
  updateStaff: (staffMemberId, data) => API.patch(`/club-staff/${staffMemberId}`, data),
  removeStaff: (staffMemberId) => API.delete(`/club-staff/${staffMemberId}`),
};

/* =========================
   NATIONAL TEAMS
========================= */
export const nationalTeamsAPI = {
  getSquad: (nationalTeamId, params) => API.get(`/national-teams/${nationalTeamId}`, { params }),
  getPlayerNationalTeams: (playerId) => API.get(`/national-teams/player/${playerId}`),
  addPlayer: (data) => API.post('/national-teams', data),
  updatePlayer: (memberId, data) => API.patch(`/national-teams/${memberId}`, data),
  removePlayer: (memberId) => API.delete(`/national-teams/${memberId}`),
};

/* =========================
   AI
========================= */
export const aiAPI = {
  status: () => API.get('/ai/status'),
  generateBio: (data) => API.post('/ai/generate-bio', data),
  scoutSummary: (userId) => API.post(`/ai/scout-summary/${userId}`),
  suggestPost: (data) => API.post('/ai/suggest-post', data),
};

export const youtubeAPI = {
  resolveChannel: (url) => API.get('/youtube/resolve', { params: { url } }),
};

export const mediaAPI = {
  list: (params) => API.get('/media', { params }),
  get: (id) => API.get(`/media/${id}`),
  create: (data) => API.post('/media', data),
  update: (id, data) => API.put(`/media/${id}`, data),
  remove: (id) => API.delete(`/media/${id}`),
  trackEvent: (id, eventType) => API.post(`/media/${id}/events`, { eventType }),
  listPlayer: (playerId, params) => API.get(`/players/${playerId}/media`, { params }),
  listClub: (clubId, params) => API.get(`/clubs/${clubId}/media`, { params }),
  listMatch: (matchId, params) => API.get(`/matches/${matchId}/media`, { params }),
  adminList: (params) => API.get('/media/admin', { params }),
};

export default API;
export { API };
