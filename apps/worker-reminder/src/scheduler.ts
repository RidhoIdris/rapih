import { logger } from './lib/logger.js';
import { getReminderQueue } from './queues/reminder.js';

const TZ = 'Asia/Jakarta';

type Schedule = { name: string; cron: string };

const SCHEDULES: Schedule[] = [
  { name: 'recurring-create', cron: '5 0 * * *' }, // 00:05 daily
  { name: 'due-push', cron: '0 9 * * *' }, // 09:00 daily
  { name: 'streak-nudge', cron: '0 20 * * *' }, // 20:00 daily
  { name: 'weekly-review', cron: '0 22 * * 0' }, // Sunday 22:00
];

export async function registerSchedules(): Promise<Schedule[]> {
  const queue = getReminderQueue();
  for (const s of SCHEDULES) {
    await queue.upsertJobScheduler(
      `scheduler:${s.name}`,
      { pattern: s.cron, tz: TZ },
      { name: s.name, data: {} }
    );
    logger.info({ name: s.name, cron: s.cron, tz: TZ }, 'scheduler registered');
  }
  return SCHEDULES;
}

export function listSchedules(): Schedule[] {
  return SCHEDULES;
}
