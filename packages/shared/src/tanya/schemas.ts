import { z } from 'zod';
import { AiRoleSchema } from './enums.js';

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const AiSessionDto = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string(),
  last_message_at: z.string(),
});
export type AiSessionDto = z.infer<typeof AiSessionDto>;

export const AiMessageDto = z.object({
  id: z.string(),
  session_id: z.string(),
  role: AiRoleSchema,
  content: z.string(),
  tool_name: z.string().nullable(),
  tool_args: z.unknown().nullable(),
  tool_result: z.unknown().nullable(),
  created_at: z.string(),
});
export type AiMessageDto = z.infer<typeof AiMessageDto>;

// ─── Request bodies ───────────────────────────────────────────────────────

export const CreateSessionBody = z.object({
  title: z.string().max(120).optional(),
});
export type CreateSessionBody = z.infer<typeof CreateSessionBody>;

export const SendMessageBody = z.object({
  text: z.string().min(1).max(4000),
});
export type SendMessageBody = z.infer<typeof SendMessageBody>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const ListSessionsResponse = z.object({
  ok: z.literal(true),
  data: z.object({ sessions: z.array(AiSessionDto) }),
});
export type ListSessionsResponse = z.infer<typeof ListSessionsResponse>;

export const CreateSessionResponse = z.object({
  ok: z.literal(true),
  data: z.object({ session: AiSessionDto }),
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;

export const ListMessagesResponse = z.object({
  ok: z.literal(true),
  data: z.object({ messages: z.array(AiMessageDto) }),
});
export type ListMessagesResponse = z.infer<typeof ListMessagesResponse>;

export const SendMessageResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    user_message: AiMessageDto,
    job_id: z.string(),
  }),
});
export type SendMessageResponse = z.infer<typeof SendMessageResponse>;

export const DeleteSessionResponse = z.object({
  ok: z.literal(true),
});
export type DeleteSessionResponse = z.infer<typeof DeleteSessionResponse>;
