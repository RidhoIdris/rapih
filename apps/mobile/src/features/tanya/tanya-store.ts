import type { AiMessageDto, AiSessionDto } from '@rapih/shared';
import { create } from 'zustand';
import * as api from './api';
import { openSse, type SseHandle } from './sse-client';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type StreamingState = { text: string; toolCall: { name: string } | null };

type State = {
  status: Status;
  error: string | null;
  sessions: AiSessionDto[];
  activeSessionId: string | null;
  messages: AiMessageDto[];
  streaming: StreamingState | null;
  sse: SseHandle | null;

  loadSessions: () => Promise<void>;
  createNewSession: () => Promise<string | null>;
  selectSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  send: (text: string) => Promise<void>;
  cleanupSse: () => void;
};

export const useTanyaStore = create<State>((set, get) => ({
  status: 'idle',
  error: null,
  sessions: [],
  activeSessionId: null,
  messages: [],
  streaming: null,
  sse: null,

  loadSessions: async () => {
    set({ status: 'loading', error: null });
    try {
      const sessions = await api.listSessions();
      set({ sessions, status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'unknown' });
    }
  },

  createNewSession: async () => {
    try {
      const session = await api.createSession();
      set((s) => ({
        sessions: [session, ...s.sessions],
        activeSessionId: session.id,
        messages: [],
      }));
      return session.id;
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'unknown' });
      return null;
    }
  },

  selectSession: async (id) => {
    get().cleanupSse();
    set({ activeSessionId: id, messages: [], streaming: null });
    await get().loadMessages();
  },

  removeSession: async (id) => {
    try {
      await api.deleteSession(id);
      set((s) => {
        const remaining = s.sessions.filter((x) => x.id !== id);
        const active =
          s.activeSessionId === id ? (remaining[0]?.id ?? null) : s.activeSessionId;
        return {
          sessions: remaining,
          activeSessionId: active,
          messages: active === s.activeSessionId ? s.messages : [],
        };
      });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'unknown' });
    }
  },

  loadMessages: async () => {
    const id = get().activeSessionId;
    if (!id) return;
    try {
      const messages = await api.listMessages(id);
      set({ messages });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'unknown' });
    }
  },

  send: async (text) => {
    const id = get().activeSessionId;
    if (!id) return;
    const tempId = `temp-${Date.now()}`;
    const optimisticUser: AiMessageDto = {
      id: tempId,
      session_id: id,
      role: 'user',
      content: text,
      tool_name: null,
      tool_args: null,
      tool_result: null,
      created_at: new Date().toISOString(),
    };
    set((s) => ({
      messages: [...s.messages, optimisticUser],
      streaming: { text: '', toolCall: null },
    }));

    try {
      const { user_message, job_id } = await api.sendMessage(id, text);
      set((s) => ({
        messages: s.messages.map((m) => (m.id === tempId ? user_message : m)),
      }));

      const handle = await openSse(
        api.streamUrl(job_id),
        api.streamHeaders(),
        (e) => {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(e.data) as Record<string, unknown>;
          } catch {
            return;
          }
          const type = parsed.type as string | undefined;
          if (type === 'token') {
            const text = (parsed.text as string) ?? '';
            set((s) =>
              s.streaming
                ? { streaming: { text: s.streaming.text + text, toolCall: s.streaming.toolCall } }
                : {}
            );
          } else if (type === 'tool_call') {
            const name = (parsed.name as string) ?? '';
            set((s) =>
              s.streaming ? { streaming: { text: s.streaming.text, toolCall: { name } } } : {}
            );
          } else if (type === 'tool_result') {
            set((s) =>
              s.streaming ? { streaming: { text: s.streaming.text, toolCall: null } } : {}
            );
          } else if (type === 'done') {
            const message_id = (parsed.message_id as string) ?? `tmp-${Date.now()}`;
            const sessionId = get().activeSessionId ?? id;
            const assistant: AiMessageDto = {
              id: message_id,
              session_id: sessionId,
              role: 'assistant',
              content: get().streaming?.text ?? '',
              tool_name: null,
              tool_args: null,
              tool_result: null,
              created_at: new Date().toISOString(),
            };
            set((s) => ({
              messages: [...s.messages, assistant],
              streaming: null,
            }));
            get().cleanupSse();
          } else if (type === 'error') {
            const sessionId = get().activeSessionId ?? id;
            const fallback: AiMessageDto = {
              id: `err-${Date.now()}`,
              session_id: sessionId,
              role: 'assistant',
              content: 'Maaf, terjadi kesalahan.',
              tool_name: null,
              tool_args: null,
              tool_result: null,
              created_at: new Date().toISOString(),
            };
            set((s) => ({
              messages: [...s.messages, fallback],
              streaming: null,
            }));
            get().cleanupSse();
          }
        },
        () => {
          set({ streaming: null });
          get().cleanupSse();
        }
      );
      set({ sse: handle });
    } catch (err) {
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== tempId),
        streaming: null,
        error: err instanceof Error ? err.message : 'unknown',
      }));
    }
  },

  cleanupSse: () => {
    const sse = get().sse;
    if (sse) {
      sse.close();
      set({ sse: null });
    }
  },
}));
