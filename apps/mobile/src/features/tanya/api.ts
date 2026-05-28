import type {
  AiMessageDto,
  AiSessionDto,
  CreateSessionResponse,
  ListMessagesResponse,
  ListSessionsResponse,
  SendMessageResponse,
} from '@rapih/shared';
import { apiRequest, getAccessToken } from '@/lib/api';
import { env } from '@/lib/env';

type ListData = ListSessionsResponse['data'];
type CreateData = CreateSessionResponse['data'];
type MessagesData = ListMessagesResponse['data'];
type SendData = SendMessageResponse['data'];

export async function listSessions(): Promise<AiSessionDto[]> {
  const data = await apiRequest<ListData>('/tanya/sessions');
  return data.sessions;
}

export async function createSession(title?: string): Promise<AiSessionDto> {
  const data = await apiRequest<CreateData>('/tanya/sessions', {
    method: 'POST',
    body: title ? { title } : {},
  });
  return data.session;
}

export async function deleteSession(id: string): Promise<void> {
  await apiRequest<unknown>(`/tanya/sessions/${id}`, { method: 'DELETE' });
}

export async function listMessages(sessionId: string): Promise<AiMessageDto[]> {
  const data = await apiRequest<MessagesData>(`/tanya/sessions/${sessionId}/messages`);
  return data.messages;
}

export async function sendMessage(
  sessionId: string,
  text: string
): Promise<{ user_message: AiMessageDto; job_id: string }> {
  const data = await apiRequest<SendData>(`/tanya/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: { text },
  });
  return data;
}

export function streamUrl(jobId: string): string {
  return `${env.apiUrl}/tanya/jobs/${jobId}/stream`;
}

export function streamHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
