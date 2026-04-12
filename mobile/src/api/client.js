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
export const myProfileRequest = () => api.get('/api/profiles/me');
export const likePostRequest = (postId) => api.post(`/api/likes/${postId}`);
export const unlikePostRequest = (postId) => api.delete(`/api/likes/${postId}`);
export const postCommentsRequest = (postId) => api.get(`/api/comments/${postId}`);
export const createCommentRequest = (postId, content) => api.post(`/api/comments/${postId}`, { content });
export const createStreamRequest = (payload) => api.post('/api/streams', payload);
export const startStreamRequest = (streamId) => api.put(`/api/streams/${streamId}/start`);
export const endStreamRequest = (streamId) => api.put(`/api/streams/${streamId}/end`);
export const streamsRequest = (params = {}) => api.get('/api/streams', { params });

export default api;
