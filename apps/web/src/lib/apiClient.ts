import axios from 'axios';
import { auth } from './firebase';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: API_ORIGIN ? `${API_ORIGIN}/api` : '/api',
});

apiClient.interceptors.request.use(async (config) => {
  const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
  // Later phases (FirebaseAuthGuard on the API) rely on this header.
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
