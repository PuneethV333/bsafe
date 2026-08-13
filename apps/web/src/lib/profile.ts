import { useQuery } from '@tanstack/react-query';
import type { UserDto } from '@bsafe/shared-types';
import { apiClient } from './apiClient';
import { useAuth } from './useAuth';
import { auth } from './firebase';

/**
 * The current user's profile from the API. On first login the backend creates
 * or links the local `users` row (upsert by firebase_uid), so POST /auth/sync
 * is idempotent and safe to call on every load.
 */
export function useProfile() {
  const { user } = useAuth();

  return useQuery<UserDto>({
    queryKey: ['profile', user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
      if (!token) throw new Error('Not authenticated');
      const res = await apiClient.post('/auth/sync', null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as UserDto;
    },
  });
}