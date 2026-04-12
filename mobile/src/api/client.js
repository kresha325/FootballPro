import axios from 'axios';
import { BACKEND_URL } from '../config/constants';

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15000,
});

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
export const meRequest = () => api.get('/api/auth/me');
export const postsRequest = () => api.get('/api/posts');
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
export const myProfileRequest = () => api.get('/api/profiles/me');
export const profileByIdRequest = (userId) => api.get(`/api/profiles/${userId}`);
export const profilesRequest = (params = {}) => api.get('/api/profiles', { params });
export const createMyProfileRequest = (payload = {}) => api.post('/api/profiles/me', payload);
export const updateMyProfileRequest = (payload = {}) => {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
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

export const conversationsRequest = () => api.get('/api/messaging/conversations');
export const conversationMessagesRequest = (conversationId, params = {}) =>
  api.get(`/api/messaging/conversations/${conversationId}/messages`, { params });
export const sendConversationMessageRequest = (conversationId, content) =>
  api.post(`/api/messaging/conversations/${conversationId}/messages`, { content });
export const markConversationReadRequest = (conversationId) =>
  api.put(`/api/messaging/conversations/${conversationId}/read`);

export const notificationsRequest = (params = {}) => api.get('/api/notifications', { params });
export const unreadNotificationsCountRequest = () => api.get('/api/notifications/unread-count');
export const markNotificationReadRequest = (notificationId) => api.put(`/api/notifications/${notificationId}/read`);
export const markAllNotificationsReadRequest = () => api.put('/api/notifications/mark-all-read');

export default api;
