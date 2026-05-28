import { apiRequest } from '@/lib/api';
import type {
  MarkReadBody,
  MarkReadResponse,
  NotificationDto,
  NotificationKind,
  NotificationListResponse,
} from '@rapih/shared';

type ListData = NotificationListResponse['data'];
type MarkData = MarkReadResponse['data'];

export type ListOpts = {
  unread?: boolean;
  kind?: NotificationKind;
  limit?: number;
};

export async function listNotifications(opts: ListOpts = {}): Promise<NotificationDto[]> {
  const params = new URLSearchParams();
  if (opts.unread) params.set('unread', 'true');
  if (opts.kind) params.set('kind', opts.kind);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const data = await apiRequest<ListData>(`/notifications${qs ? `?${qs}` : ''}`);
  return data.notifications;
}

export async function markRead(ids: string[]): Promise<number> {
  const body: MarkReadBody = { ids };
  const data = await apiRequest<MarkData>('/notifications/mark-read', {
    method: 'POST',
    body,
  });
  return data.updated;
}

export async function markAllRead(): Promise<number> {
  const body: MarkReadBody = { all: true };
  const data = await apiRequest<MarkData>('/notifications/mark-read', {
    method: 'POST',
    body,
  });
  return data.updated;
}
