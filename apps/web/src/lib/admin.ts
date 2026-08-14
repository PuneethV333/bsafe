import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminAlertRowDto, AdminReportDto } from '@bsafe/shared-types';
import { apiClient } from './apiClient';

export interface AdminAlertsQuery {
  status?: 'sent' | 'acknowledged' | 'resolved';
}

export function useAdminAlerts(query: AdminAlertsQuery = {}) {
  return useQuery<AdminAlertRowDto[]>({
    queryKey: ['admin', 'alerts', query],
    queryFn: async () => (await apiClient.get('/admin/alerts', { params: query })).data,
    staleTime: 15_000,
  });
}

export function useAdminReports() {
  return useQuery<AdminReportDto>({
    queryKey: ['admin', 'reports'],
    queryFn: async () => (await apiClient.get('/admin/reports')).data,
    staleTime: 30_000,
  });
}

export function useRetryAlert(alertId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ requeued: number }> =>
      (await apiClient.post(`/notifications/${alertId}/retry`)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'alerts'] });
    },
  });
}