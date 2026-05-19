import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, tint } from '@/theme';
import { Screen, TabBar, Text } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons/icon';
import { RutinPanel } from '@/features/recurring/components/rutin-panel';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Tx = { v: string; cat: string; t: string; amt: number; src: string };

const GROUPS: { day: string; sum: number; items: Tx[] }[] = [
  {
    day: 'Hari ini · 17 Mei',
    sum: -382000,
    items: [
      { v: 'Tokopedia', cat: 'Kebutuhan', t: '10:42', amt: -185000, src: 'BCA' },
      { v: 'Gojek · GoFood', cat: 'Senang-Senang', t: '09:14', amt: -68000, src: 'GoPay' },
      { v: 'Starbucks Sudirman', cat: 'Senang-Senang', t: '07:51', amt: -47000, src: 'BCA' },
      { v: 'Transfer dari Riska', cat: 'Pemasukan', t: '08:30', amt: 200000, src: 'BCA' },
      { v: 'QRIS Alfamart', cat: 'Kebutuhan', t: '06:20', amt: -82000, src: 'OVO' },
    ],
  },
  {
    day: 'Kemarin · 16 Mei',
    sum: -148000,
    items: [
      { v: 'Grab Car', cat: 'Transport', t: '21:14', amt: -68000, src: 'GoPay' },
      { v: 'Indomaret Cikarang', cat: 'Kebutuhan', t: '18:30', amt: -56000, src: 'BCA' },
      { v: 'Tiket bioskop · CGV', cat: 'Senang-Senang', t: '14:10', amt: -24000, src: 'OVO' },
    ],
  },
];

const FILTERS = ['Semua', 'Pengeluaran', 'Pemasukan', 'Kebutuhan', 'Senang-Senang', 'Transport'];
const MINI = [12, 18, 24, 16, 28, 22, 32, 26, 36, 30, 38, 28];

function catColor(c: string) {
  if (c === 'Pemasukan') return palette.lime;
  if (c === 'Kebutuhan') return tint.mint;
  if (c === 'Senang-Senang') return tint.amber;
  if (c === 'Transport') return tint.peach;
  return palette.sand;
}

function AktivitasPanel({ onTx }: { onTx: () => void }) {
  return (
    <View>
      {/* month summary */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View style={{ flex: 1 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700' }}>
            Bulan ini
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <Text variant="figureM" style={{ fontSize: 26, letterSpacing: -0.8 }}>
              −Rp 3,2jt
            </Text>
            <Text variant="bodySm" color={palette.coral} style={{ fontSize: 11, fontWeight: '600' }}>
              +18%
            </Text>
          </View>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 2 }}>
            +Rp 7,8jt masuk · 142 transaksi
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40 }}>
          {MINI.map((h, i) => (
            <View
              key={i}
              style={{
                width: 5,
                height: h,
                borderRadius: 3,
                backgroundColor: i > 8 ? palette.moss : palette.sand,
              }}
            />
          ))}
        </View>
      </View>

      {/* filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14 }}
        contentContainerStyle={{ paddingHorizontal: 18, gap: 6, flexDirection: 'row' }}>
        {FILTERS.map((f, i) => {
          const active = i === 0;
          return (
            <Pressable
              key={f}
              onPress={() => haptics.select()}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: active ? palette.moss : palette.card,
                boxShadow: active ? undefined : `0 0 0 1px ${palette.inkFaint}`,
              }}>
              <Text
                variant="chip"
                color={active ? ONDARK : palette.ink}
                style={{ fontSize: 12, fontWeight: '600' }}>
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* groups */}
      {GROUPS.map((g) => (
        <View key={g.day} style={{ marginHorizontal: 18, marginTop: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 4,
              paddingBottom: 8,
            }}>
            <Text
              variant="label"
              color={palette.inkMute}
              style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700' }}>
              {g.day}
            </Text>
            <Text variant="mono" color={palette.inkSoft} style={{ fontSize: 11 }}>
              {rupiah(g.sum, { short: true })}
            </Text>
          </View>
          <View style={{ backgroundColor: palette.card, borderRadius: 22, borderCurve: 'continuous' }}>
            {g.items.map((t, i) => (
              <Pressable
                key={t.v}
                onPress={onTx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderBottomWidth: i < g.items.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    backgroundColor: catColor(t.cat),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '700' }}>
                    {t.v[0]}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="bodySm"
                    numberOfLines={1}
                    style={{ fontSize: 14, fontWeight: '500', letterSpacing: -0.2 }}>
                    {t.v}
                  </Text>
                  <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
                    {t.cat} · {t.t} · {t.src}
                  </Text>
                </View>
                <Text
                  variant="mono"
                  color={t.amt > 0 ? palette.cool : palette.ink}
                  style={{ fontSize: 13, fontWeight: '500' }}>
                  {rupiah(t.amt, { short: true })}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function TransaksiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'aktivitas' | 'rutin'>(
    modeParam === 'rutin' ? 'rutin' : 'aktivitas',
  );
  const [addOpen, setAddOpen] = useState(false);

  const go = (to: Href) => {
    setAddOpen(false);
    haptics.tap();
    router.push(to);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen background={palette.bg} bottomInset={96}>
        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingHorizontal: 22,
          }}>
          <View>
            <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11 }}>
              Mei 2026
            </Text>
            <Text variant="displayM" style={{ fontSize: 36, letterSpacing: -1.6, lineHeight: 38, marginTop: 4 }}>
              Transaksi
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['search', 'filter'] as const).map((n) => (
              <Pressable
                key={n}
                onPress={() => haptics.tap()}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 38,
                  backgroundColor: palette.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name={n} size={n === 'search' ? 16 : 14} color={palette.ink} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* segmented */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 18,
            flexDirection: 'row',
            gap: 4,
            backgroundColor: palette.card,
            borderRadius: 999,
            padding: 4,
          }}>
          {(['aktivitas', 'rutin'] as const).map((m) => {
            const on = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  haptics.select();
                  setMode(m);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: 999,
                  alignItems: 'center',
                  backgroundColor: on ? palette.moss : 'transparent',
                }}>
                <Text
                  variant="chip"
                  color={on ? ONDARK : palette.inkSoft}
                  style={{ fontSize: 12.5, fontWeight: '700' }}>
                  {m === 'aktivitas' ? 'Aktivitas' : 'Rutin'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'aktivitas' ? (
          <AktivitasPanel onTx={() => go('/(app)/transaksi-detail' as Href)} />
        ) : (
          <RutinPanel />
        )}
      </Screen>

      {/* FAB */}
      <Pressable
        onPress={() => {
          haptics.tap();
          setAddOpen((v) => !v);
        }}
        style={{
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 84,
          width: 56,
          height: 56,
          borderRadius: 56,
          backgroundColor: palette.moss,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 22px rgba(31,42,31,0.32)',
        }}>
        <Icon name={addOpen ? 'x' : 'plus'} size={addOpen ? 14 : 18} color={palette.lime} />
      </Pressable>

      {/* add chooser */}
      {addOpen && (
        <>
          <Pressable
            onPress={() => setAddOpen(false)}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <View
            style={{
              position: 'absolute',
              right: 20,
              bottom: insets.bottom + 150,
              width: 210,
              backgroundColor: palette.card,
              borderRadius: 18,
              borderCurve: 'continuous',
              paddingVertical: 6,
              boxShadow: '0 12px 30px rgba(10,10,14,0.18)',
            }}>
            {([
              { l: 'Tulis manual', s: 'Catat sendiri', i: 'plus' as IconName, to: '/(app)/tambah-transaksi' },
              { l: 'Scan struk', s: 'OCR otomatis', i: 'image' as IconName, to: '/(app)/scan-struk' },
            ]).map((a, i) => (
              <Pressable
                key={a.l}
                onPress={() => go(a.to as Href)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderBottomWidth: i === 0 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    backgroundColor: palette.limeSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name={a.i} size={15} color={palette.moss} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '600' }}>
                    {a.l}
                  </Text>
                  <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
                    {a.s}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <TabBar active="transaksi" />
    </View>
  );
}
