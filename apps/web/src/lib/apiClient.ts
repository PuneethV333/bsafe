import axios from 'axios';
import { auth } from './firebase';

export const apiClient = axios.create({ baseURL: '/api' });

apiClient.interceptors.request.use(async (config) => {
  const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
  // Later phases (FirebaseAuthGuard on the API) rely on this header.
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
