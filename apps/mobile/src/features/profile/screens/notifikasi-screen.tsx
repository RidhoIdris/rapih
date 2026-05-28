import { useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { NotificationDto, NotificationKind } from '@rapih/shared';
import { palette, tint } from '@/theme';
import { BackButton, Screen, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useNotificationStore } from '@/features/notification/notification-store';

type Variant = 'ai' | 'budget' | 'tx' | 'streak' | 'goal' | 'review';

const KIND_TO_VARIANT: Record<NotificationKind, Variant> = {
  recurring_due: 'tx',
  goal_deadline: 'goal',
  streak_nudge: 'streak',
  weekly_review: 'review',
};

const TYPE_META: Record<Variant, { c: string; bg: string; emoji: string }> = {
  ai: { c: palette.moss, bg: palette.limeSoft, emoji: '✦' },
  budget: { c: palette.coral, bg: tint.peach, emoji: '◷' },
  tx: { c: palette.ink, bg: palette.sand, emoji: '↗' },
  streak: { c: tint.goldInk, bg: tint.amber, emoji: '🔥' },
  goal: { c: palette.cool, bg: palette.limeSoft, emoji: '◇' },
  review: { c: tint.irisInk, bg: tint.iris, emoji: '☼' },
};

function groupByDate(items: NotificationDto[]): { h: string; items: NotificationDto[] }[] {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - (dayOfWeek - 1));

  const today: NotificationDto[] = [];
  const week: NotificationDto[] = [];
  const older: NotificationDto[] = [];

  for (const n of items) {
    const t = new Date(n.created_at);
    if (t >= startToday) today.push(n);
    else if (t >= startWeek) week.push(n);
    else older.push(n);
  }
  const out: { h: string; items: NotificationDto[] }[] = [];
  if (today.length) out.push({ h: 'Hari ini', items: today });
  if (week.length) out.push({ h: 'Minggu ini', items: week });
  if (older.length) out.push({ h: 'Lebih lama', items: older });
  return out;
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  const week = (now.getTime() - d.getTime()) / 86400000 < 7;
  if (week) return `${DAYS[d.getDay()]}, ${hh}:${mm}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function NotifikasiScreen() {
  const router = useRouter();
  const { status, items, fetch, markRead, markAllRead } = useNotificationStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const groups = useMemo(() => groupByDate(items), [items]);

  return (
    <Screen background={palette.bg} bottomInset={28}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 22,
        }}>
        <BackButton
          onPress={() => {
            haptics.tap();
            if (router.canGoBack()) router.back();
          }}
        />
        <Text variant="figureS" style={{ fontSize: 22, letterSpacing: -0.5, lineHeight: 24 }}>
          Notifikasi
        </Text>
        <Pressable
          onPress={() => {
            haptics.tap();
            markAllRead();
          }}
          hitSlop={8}>
          <Text variant="bodySm" color={palette.cool} style={{ fontSize: 12, fontWeight: '600' }}>
            Baca semua
          </Text>
        </Pressable>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={fetch} />}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}>
        {status === 'ready' && items.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 32 }}>
            <Text variant="figureS" style={{ fontSize: 18 }}>
              Belum ada notifikasi
            </Text>
            <Text
              variant="bodySm"
              color={palette.inkSoft}
              style={{ fontSize: 13, textAlign: 'center', marginTop: 6 }}>
              Catat pengeluaran biar Rapih bisa kirim insight & pengingat tagihan.
            </Text>
          </View>
        )}

        {status === 'loading' && items.length === 0 && (
          <View style={{ marginHorizontal: 18, marginTop: 22, gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  height: 56,
                  backgroundColor: palette.card,
                  borderRadius: 22,
                  opacity: 0.5,
                }}
              />
            ))}
          </View>
        )}

        {groups.map((g) => (
          <View key={g.h} style={{ marginHorizontal: 18, marginTop: 22 }}>
            <Text
              variant="label"
              color={palette.inkMute}
              style={{
                fontSize: 11,
                letterSpacing: 1.4,
                fontWeight: '700',
                paddingHorizontal: 4,
                paddingBottom: 8,
              }}>
              {g.h}
            </Text>
            <View
              style={{
                backgroundColor: palette.card,
                borderRadius: 22,
                borderCurve: 'continuous',
              }}>
              {g.items.map((n, i) => {
                const variant = KIND_TO_VARIANT[n.kind];
                const m = TYPE_META[variant];
                const isNew = n.read_at === null;
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => {
                      haptics.tap();
                      if (isNew) markRead([n.id]);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderBottomWidth: i < g.items.length - 1 ? 1 : 0,
                      borderBottomColor: palette.inkFaint,
                    }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        borderCurve: 'continuous',
                        backgroundColor: m.bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                      <Text color={m.c} style={{ fontSize: 14, fontWeight: '700' }}>
                        {m.emoji}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}>
                        <Text
                          variant="bodySm"
                          style={{
                            flex: 1,
                            fontSize: 13.5,
                            fontWeight: '600',
                            letterSpacing: -0.2,
                          }}>
                          {n.title}
                        </Text>
                        <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5 }}>
                          {formatTime(n.created_at)}
                        </Text>
                      </View>
                      <Text
                        variant="bodySm"
                        color={palette.inkSoft}
                        style={{ fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                        {n.body}
                      </Text>
                    </View>
                    {isNew && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 18,
                          right: 14,
                          width: 7,
                          height: 7,
                          borderRadius: 7,
                          backgroundColor: palette.coral,
                        }}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
