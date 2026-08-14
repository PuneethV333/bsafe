import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  AlertDto,
  AlertListItemDto,
  AlertStatusUpdate,
  TriggerAlertInput,
  UpdateLocationInput,
} from '@bsafe/shared-types';
import { apiClient } from './apiClient';

export const alertsQueryKey = ['alerts'];

/** Fire a silent SOS. Deliberately low rate limit (5/min) server-side. */
export function useTriggerAlert() {
  return useMutation({
    mutationFn: async (input: TriggerAlertInput): Promise<AlertDto> => {
      const res = await apiClient.post('/alerts/trigger', input);
      return res.data as AlertDto;
    },
  });
}

/** Poll a single alert while it is active so status changes (ack/resolve) surface. */
export function useAlert(id: string | null) {
  return useQuery<AlertDto>({
    queryKey: ['alert', id],
    enabled: Boolean(id),
    queryFn: async () => (await apiClient.get(`/alerts/${id}`)).data as AlertDto,
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== 'resolved' ? 15_000 : false,
  });
}

export function useAlertList() {
  return useQuery<AlertListItemDto[]>({
    queryKey: alertsQueryKey,
    queryFn: async () => (await apiClient.get('/alerts')).data as AlertListItemDto[],
  });
}

export function useUpdateAlertStatus() {
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatusUpdate }) => {
      const res = await apiClient.patch(`/alerts/${id}/status`, { status });
      return res.data as AlertDto;
    },
  });
}

/** REST fallback for a location ping when the WebSocket is unavailable. */
export async function sendLocationViaREST(
  alertId: string,
  input: UpdateLocationInput,
): Promise<void> {
  await apiClient.post(`/alerts/${alertId}/location`, input);
}
