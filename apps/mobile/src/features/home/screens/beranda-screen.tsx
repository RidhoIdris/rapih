import type { HomeRecentTx } from '@rapih/shared';
import { type Href, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Monogram } from '@/components/brand';
import { Icon } from '@/components/icons/icon';
import { Glow, Screen, Skeleton, TabBar, Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/auth-store';
import { timeLabel } from '@/features/activity/display';
import { appIcons } from '@/lib/app-icons';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette, tint } from '@/theme';
import { useHomeStore } from '../home-store';
import { BerandaEmpty } from '../components/beranda-empty';

const ONDARK = palette.onDark;
const N = (s: string) => Number(s);

function greet(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

type QuickItem = { l: string; icon: number; to?: string };
const QUICK: QuickItem[] = [
  { l: 'Scan struk', icon: appIcons.scan, to: '/(app)/scan-struk' },
  { l: 'Dompet', icon: appIcons.dompet, to: '/(app)/dompet' },
  { l: 'Transaksi', icon: appIcons.transaksi, to: '/(app)/transaksi' },
  { l: 'Aset', icon: appIcons.aset, to: '/(app)/aset' },
  { l: 'Tagihan', icon: appIcons.tagihan, to: '/(app)/transaksi?mode=rutin' },
  { l: 'Goal', icon: appIcons.goal, to: '/(app)/budget?mode=goal' },
];

function HeaderBtn({ name, onPress, dot }: { name: 'search' | 'bell'; onPress: () => void; dot?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 38,
        height: 38,
        borderRadius: 38,
        backgroundColor: palette.card,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 1px 2px rgba(10,10,14,0.04), 0 0 0 1px rgba(10,10,14,0.04)`,
      }}>
      <Icon name={name} size={16} color={palette.ink} />
      {dot && (
        <View
          style={{
            position: 'absolute',
            top: 9,
            right: 10,
            width: 7,
            height: 7,
            borderRadius: 7,
            backgroundColor: palette.coral,
            borderWidth: 1.5,
            borderColor: palette.card,
          }}
        />
      )}
    </Pressable>
  );
}

function TxRow({ t, onPress, divider }: { t: HomeRecentTx; onPress: () => void; divider: boolean }) {
  const amt = t.kind === 'income' ? N(t.amount) : -N(t.amount);
  const sub = [t.category_name, timeLabel(t.transacted_at), t.wallet_name].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: palette.inkFaint,
      }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: palette.sand,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text variant="bodySm" color={palette.ink} style={{ fontSize: 13, fontWeight: '600' }}>
          {t.title.trim()[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" numberOfLines={1} style={{ fontSize: 14, fontWeight: '500', letterSpacing: -0.2 }}>
          {t.title}
        </Text>
        <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11.5, marginTop: 1 }}>
          {sub}
        </Text>
      </View>
      <Text
        variant="mono"
        color={amt > 0 ? palette.cool : palette.ink}
        style={{ fontSize: 13, fontWeight: '500' }}>
        {rupiah(amt, { short: true }).replace('Rp ', '')}
      </Text>
    </Pressable>
  );
}

export function BerandaScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { home, status, fetch } = useHomeStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    void fetch();
  }, []);

  const name = user?.profile?.nickname || user?.name || 'kamu';

  // ── loading (first load) ──────────────────────────────────────────────────
  if (!home && status !== 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <Screen background={palette.bg} bottomInset={96}>
          <View style={{ paddingHorizontal: 18, gap: 14, marginTop: 8 }}>
            <Skeleton height={150} borderRadius={24} />
            <Skeleton height={200} borderRadius={22} />
            <Skeleton height={120} borderRadius={22} />
          </View>
        </Screen>
        <TabBar active="beranda" />
      </View>
    );
  }

  // ── new user (no wallet) → onboarding checklist ─────────────────────────────
  if (home && home.wallet_count === 0) {
    return <BerandaEmpty name={name} />;
  }

  const m = home?.month;
  const daily = m?.daily_expense.map(N) ?? [];
  const avg = m ? N(m.avg_per_day) : 0;
  const maxBar = Math.max(1, ...daily, avg);
  const goAdd = (to: string) => {
    haptics.tap();
    router.push(to as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={() => void fetch()} />}>
        <Screen background={palette.bg} bottomInset={96}>
          {/* top bar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 22,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Monogram initials={name.slice(0, 2).toUpperCase()} bg={palette.moss} fg={palette.lime} size={38} />
              <View>
                <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11 }}>
                  {greet()}, {name}
                </Text>
                <Text variant="figureS" style={{ fontSize: 18, lineHeight: 20, letterSpacing: -0.5, marginTop: 1 }}>
                  {rupiah(N(home?.total_balance ?? '0'), { short: true })}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <HeaderBtn name="search" onPress={() => haptics.tap()} />
              <HeaderBtn name="bell" dot onPress={() => goAdd('/(app)/notifikasi')} />
            </View>
          </View>

          {/* quick access */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 22 }}
            contentContainerStyle={{ paddingHorizontal: 18, gap: 8, flexDirection: 'row' }}>
            {QUICK.map((s) => (
              <Pressable
                key={s.l}
                onPress={() => s.to && goAdd(s.to)}
                style={{ minWidth: 68, alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 10,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Image source={s.icon} resizeMode="contain" style={{ width: 48, height: 48 }} />
                </View>
                <Text
                  variant="bodySm"
                  color={palette.inkSoft}
                  style={{ fontSize: 10.5, fontWeight: '600', letterSpacing: -0.1 }}>
                  {s.l}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* pengeluaran bulan ini */}
          <View
            style={{
              marginHorizontal: 18,
              marginTop: 22,
              paddingHorizontal: 4,
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}>
            <View>
              <Text variant="label" color={palette.inkMute} style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: '600' }}>
                PENGELUARAN BULAN INI
              </Text>
              <Text variant="figureS" style={{ marginTop: 2, fontSize: 20 }}>
                {rupiah(N(m?.expense ?? '0'), { short: true })}{' '}
                <Text variant="figureS" color={palette.inkMute} style={{ fontSize: 20 }}>
                  · {m?.days_elapsed ?? 0} hari
                </Text>
              </Text>
            </View>
            <Pressable onPress={() => goAdd('/(app)/transaksi')}>
              <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 12 }}>
                Detail →
              </Text>
            </Pressable>
          </View>

          {/* daily bars + stats */}
          <View
            style={{
              marginHorizontal: 18,
              marginTop: 12,
              padding: 18,
              paddingBottom: 16,
              borderRadius: 22,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90 }}>
              {daily.map((v, i) => {
                const isFuture = i >= (m?.days_elapsed ?? 0);
                const isToday = i === (m?.days_elapsed ?? 0) - 1;
                const h = isFuture ? (avg / maxBar) * 100 : (v / maxBar) * 100;
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.max(2, h)}%`,
                      borderRadius: 2,
                      backgroundColor: isFuture ? palette.sand : isToday ? palette.lime : palette.moss,
                      opacity: isFuture ? 0.6 : 1,
                      borderWidth: isFuture ? 1 : 0,
                      borderColor: palette.sandDeep,
                      borderStyle: isFuture ? 'dashed' : 'solid',
                    }}
                  />
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              {['1', '7', '14', '21', '28'].map((n) => (
                <Text key={n} variant="mono" color={palette.inkMute} style={{ fontSize: 10 }}>
                  {n}
                </Text>
              ))}
            </View>
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: palette.inkFaint,
              }}>
              {[
                { l: 'Rata-rata/hari', v: rupiah(avg, { short: true }), c: palette.ink },
                { l: 'Proyeksi bulan', v: rupiah(N(m?.projection ?? '0'), { short: true }), c: palette.cool },
              ].map((s) => (
                <View key={s.l} style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label" color={palette.inkMute} style={{ fontSize: 9.5, letterSpacing: 1, fontWeight: '700' }}>
                      {s.l}
                    </Text>
                    <Text variant="mono" color={s.c} style={{ fontSize: 13, marginTop: 2, fontWeight: '600' }}>
                      {s.v}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: palette.inkFaint }} />
                </View>
              ))}
              <View style={{ flex: 1 }}>
                <Text variant="label" color={palette.inkMute} style={{ fontSize: 9.5, letterSpacing: 1, fontWeight: '700' }}>
                  vs Bulan lalu
                </Text>
                {m?.delta_pct == null ? (
                  <Text variant="mono" color={palette.inkMute} style={{ fontSize: 13, marginTop: 2, fontWeight: '600' }}>
                    —
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <Icon name={m.delta_pct >= 0 ? 'arrowUp' : 'arrowDn'} size={12} color={m.delta_pct >= 0 ? palette.coral : palette.cool} />
                    <Text variant="mono" color={m.delta_pct >= 0 ? palette.coral : palette.cool} style={{ fontSize: 13, fontWeight: '600' }}>
                      {Math.abs(Math.round(m.delta_pct * 100))}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* cash flow + savings rate */}
          <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 10 }}>
            <View
              style={{
                flex: 1.4,
                padding: 16,
                borderRadius: 20,
                borderCurve: 'continuous',
                backgroundColor: palette.moss,
                overflow: 'hidden',
              }}>
              <Glow size={110} color={palette.lime} opacity={0.18} fadeAt={0.7} position={{ top: -30, right: -30 }} />
              <Text variant="label" color={palette.lime} style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
                Arus kas
              </Text>
              <Text variant="figureM" color={ONDARK} style={{ marginTop: 6 }}>
                {N(m?.net ?? '0') >= 0 ? '+' : '−'}
                {rupiah(Math.abs(N(m?.net ?? '0')), { short: true }).replace('Rp ', 'Rp ')}
              </Text>
              <Text variant="bodySm" color="rgba(240,240,232,0.55)" style={{ fontSize: 10.5, marginTop: 2 }}>
                Masuk {rupiah(N(m?.income ?? '0'), { short: true })} · keluar {rupiah(N(m?.expense ?? '0'), { short: true })}
              </Text>
              <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 4, height: 8 }}>
                <View style={{ flex: Math.max(0.05, N(m?.income ?? '0')), height: 6, borderRadius: 3, backgroundColor: palette.lime }} />
                <View
                  style={{
                    flex: Math.max(0.05, N(m?.expense ?? '0')),
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.22)',
                  }}
                />
              </View>
            </View>
            <View
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 20,
                borderCurve: 'continuous',
                backgroundColor: palette.card,
              }}>
              <Text variant="label" color={palette.inkMute} style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
                Savings rate
              </Text>
              <Text
                variant="figureM"
                style={{ fontSize: 28, lineHeight: 38, letterSpacing: -1, includeFontPadding: false, paddingVertical: 2 }}>
                {Math.round((m?.savings_rate ?? 0) * 100)}%
              </Text>
              <View style={{ height: 8, borderRadius: 8, backgroundColor: palette.sand, overflow: 'hidden', marginTop: 4 }}>
                <View
                  style={{
                    height: '100%',
                    width: `${Math.round((m?.savings_rate ?? 0) * 100)}%`,
                    backgroundColor: palette.cool,
                    borderRadius: 8,
                  }}
                />
              </View>
            </View>
          </View>

          {/* top categories */}
          {home && home.top_categories.length > 0 && (
            <View
              style={{
                marginHorizontal: 18,
                marginTop: 14,
                padding: 16,
                borderRadius: 22,
                borderCurve: 'continuous',
                backgroundColor: palette.card,
              }}>
              <Text variant="label" color={palette.inkMute} style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
                KATEGORI TERTINGGI
              </Text>
              <View style={{ marginTop: 12, gap: 9 }}>
                {home.top_categories.map((c) => {
                  const pct = Math.round(c.pct * 100);
                  return (
                    <View key={c.id}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
                          {c.name}
                        </Text>
                        <Text variant="mono" color={palette.inkMute} style={{ fontSize: 11 }}>
                          {rupiah(N(c.amount), { short: true })} · {pct}%
                        </Text>
                      </View>
                      <View style={{ height: 8, borderRadius: 8, backgroundColor: palette.sand, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${Math.max(2, pct)}%`, backgroundColor: c.color, borderRadius: 8 }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* bills + goals strip */}
          <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => goAdd('/(app)/transaksi?mode=rutin')}
              style={{ flex: 1, padding: 14, borderRadius: 20, borderCurve: 'continuous', backgroundColor: tint.amber }}>
              <Text variant="label" color="#7a6028" style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
                Tagihan dekat
              </Text>
              <Text variant="figureS" color={tint.amberInk} style={{ marginTop: 6 }}>
                {home?.bills.count ?? 0} tagihan
              </Text>
              <Text variant="bodySm" color="rgba(122,96,40,0.75)" style={{ fontSize: 10.5, marginTop: 2 }}>
                {home && home.bills.count > 0
                  ? `Total ${rupiah(N(home.bills.total), { short: true })}${home.bills.next_due_days != null ? ` · ${home.bills.next_due_days} hari` : ''}`
                  : 'Belum ada tagihan dekat'}
              </Text>
              {home && home.bills.icons.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                  {home.bills.icons.map((ic, i) => (
                    <Text key={i} style={{ fontSize: 18 }}>
                      {ic}
                    </Text>
                  ))}
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => goAdd('/(app)/budget?mode=goal')}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 20,
                borderCurve: 'continuous',
                backgroundColor: palette.card,
                boxShadow: `0 0 0 1px ${palette.inkFaint}`,
              }}>
              <Text variant="label" color={palette.inkMute} style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
                Goal aktif
              </Text>
              <Text variant="figureS" style={{ marginTop: 6 }}>
                {home?.goals.active_count ?? 0} jalan
              </Text>
              <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 10.5, marginTop: 2 }}>
                Terkumpul {rupiah(N(home?.goals.total_saved ?? '0'), { short: true })}
              </Text>
              {home && home.goals.progresses.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 3, marginTop: 10 }}>
                  {home.goals.progresses.map((p, i) => (
                    <View
                      key={i}
                      style={{ flex: 1, height: 6, borderRadius: 6, backgroundColor: palette.sand, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${Math.round(p * 100)}%`, backgroundColor: palette.cool, borderRadius: 6 }} />
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          </View>

          {/* recent activity */}
          <View style={{ marginHorizontal: 18, marginTop: 24 }}>
            <View style={{ paddingHorizontal: 4, paddingBottom: 10 }}>
              <Text variant="label" color={palette.inkMute} style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: '600' }}>
                TERBARU
              </Text>
              <Text variant="figureS" style={{ marginTop: 2 }}>
                Aktivitas
              </Text>
            </View>
            {home && home.recent_transactions.length > 0 ? (
              <View
                style={{
                  backgroundColor: palette.card,
                  borderRadius: 24,
                  borderCurve: 'continuous',
                  paddingVertical: 6,
                  paddingHorizontal: 4,
                  boxShadow: '0 1px 2px rgba(10,10,14,0.03)',
                }}>
                {home.recent_transactions.map((t, i) => (
                  <TxRow
                    key={t.id}
                    t={t}
                    divider={i < home.recent_transactions.length - 1}
                    onPress={() => goAdd(`/(app)/transaksi-detail?id=${encodeURIComponent(t.id)}`)}
                  />
                ))}
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 13, textAlign: 'center' }}>
                  Belum ada transaksi. Catat lewat tab Transaksi.
                </Text>
              </View>
            )}
          </View>
        </Screen>
      </ScrollView>

      <TabBar active="beranda" />
    </View>
  );
}
