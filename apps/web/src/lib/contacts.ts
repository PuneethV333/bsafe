import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EmergencyContactDto } from '@bsafe/shared-types';
import { apiClient } from './apiClient';

export const contactsQueryKey = ['contacts'];

export interface ContactInput {
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
}

export function useContacts() {
  return useQuery<EmergencyContactDto[]>({
    queryKey: contactsQueryKey,
    queryFn: async () => (await apiClient.get('/contacts')).data,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactInput) => {
      const res = await apiClient.post('/contacts', input);
      return res.data as EmergencyContactDto;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: contactsQueryKey }),
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ContactInput & { id: string }) => {
      const res = await apiClient.patch(`/contacts/${id}`, input);
      return res.data as EmergencyContactDto;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: contactsQueryKey }),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/contacts/${id}`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: contactsQueryKey }),
  });
}