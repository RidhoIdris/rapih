import { z } from 'zod';

export const AiRoleSchema = z.enum(['user', 'assistant', 'tool']);
export type AiRole = z.infer<typeof AiRoleSchema>;
