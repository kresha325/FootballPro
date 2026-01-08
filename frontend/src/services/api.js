/* =========================
   SPONSORS
========================= */
export const sponsorAPI = {
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
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://192.168.100.57:5098/api',
});
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
};

/* =========================
   POSTS / FEED ✅ FIX
========================= */
export const postsAPI = {
  getPosts: () => API.get('/posts'),
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
  getProfile: (id) => API.get(`/profiles/${id}`),
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
  search: (query) => API.get(`/search?q=${query}`),
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
};

/* =========================
   NOTIFICATIONS
========================= */
export const notificationsAPI = {
  getNotifications: (params) => API.get('/notifications', { params }),
  getUnreadCount: () => API.get('/notifications/unread-count'),
  markAsRead: (id) => API.put(`/notifications/${id}/read`),
  markAllAsRead: () => API.put('/notifications/mark-all-read'),
  deleteNotification: (id) => API.delete(`/notifications/${id}`),
};

/* =========================
   STREAMS
========================= */
export const streamsAPI = {
  getStreams: () => API.get('/streams'),
  createStream: (data) => API.post('/streams', data),
};

/* =========================
   MARKETPLACE
========================= */
export const marketplaceAPI = {
  getProducts: () => API.get('/products'),
  getProduct: (id) => API.get(`/products/${id}`),
};

/* =========================
   ORDERS
========================= */
export const ordersAPI = {
  createOrder: (data) => API.post('/orders', data),
  getMyOrders: () => API.get('/orders'),
};

/* =========================
   SCOUTING
========================= */
export const scoutingAPI = {
  getScouts: () => API.get('/scouting'),
  createReport: (data) => API.post('/scouting', data),
};

/* =========================
   SUBSCRIPTIONS / FOLLOW
========================= */
export const subscriptionsAPI = {
  follow: (userId) => API.post(`/subscriptions/${userId}`),
  unfollow: (userId) => API.delete(`/subscriptions/${userId}`),
  getFollowing: () => API.get('/subscriptions'),
  getFollowers: (userId) => API.get(`/subscriptions/followers/${userId}`),
};

/* =========================
   GAMIFICATION
========================= */
export const gamificationAPI = {
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

/* =========================
   VIDEO CALL (mock)
========================= */
export const videoCallAPI = {
  startCall: () => Promise.resolve({ data: true }),
};

/* =========================
   CLUB MEMBERS
========================= */
export const clubMembersAPI = {
  getClubMembers: (clubId, status) => API.get(`/club-members/club/${clubId}${status ? `?status=${status}` : ''}`),
  getAthleteMemberships: (athleteId) => API.get(`/club-members/athlete/${athleteId}`),
  requestMembership: (data) => API.post('/club-members/request', data),
  updateMembershipStatus: (membershipId, status) => API.put(`/club-members/${membershipId}/status`, { status }),
  updateMember: (membershipId, data) => API.patch(`/club-members/${membershipId}`, data),
  removeMember: (membershipId) => API.delete(`/club-members/${membershipId}`),
};

/* =========================
   TRANSFER HISTORY
========================= */
export const transferHistoryAPI = {
  getUserTransfers: (userId) => API.get(`/transfer-history/user/${userId}`),
  getClubTransfers: (clubName) => API.get(`/transfer-history/club/${clubName}`),
  addTransfer: (data) => API.post('/transfer-history', data),
  updateTransfer: (transferId, data) => API.put(`/transfer-history/${transferId}`, data),
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

export default API;