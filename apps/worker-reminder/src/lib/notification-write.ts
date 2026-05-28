import { Prisma, type PrismaClient } from '@rapih/db';
import type { NotificationKind } from '@rapih/shared';

/**
 * Create a Notification row. Returns the inserted id (used as `notification_id`
 * in the Expo data payload so mobile can deep-link to it).
 */
export async function writeNotification(
  prisma: PrismaClient,
  args: {
    user_id: string;
    kind: NotificationKind;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<string> {
  const row = await prisma.notification.create({
    data: {
      user_id: args.user_id,
      kind: args.kind,
      title: args.title,
      body: args.body,
      data: (args.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
  return row.id;
}
