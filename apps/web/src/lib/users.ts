import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDto } from '@bsafe/shared-types';
import { apiClient } from './apiClient';
import { useAuth } from './useAuth';

export function useProfile() {
  const { user } = useAuth();

  return useQuery<UserDto>({
    queryKey: ['profile', user?.uid],
    enabled: Boolean(user),
    queryFn: async () => (await apiClient.get('/users/me')).data,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: { name?: string; phone?: string | null }) => {
      const res = await apiClient.patch('/users/me', dto);
      return res.data as UserDto;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
    },
  });
}