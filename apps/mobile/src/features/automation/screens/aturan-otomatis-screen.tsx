import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { palette, tint } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Suggestion = {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  badge: string;
};

const SUGGESTIONS: Suggestion[] = [
  {
    id: 'cap',
    emoji: '🚦',
    title: 'Cap Kopi & jajan',
    detail: 'Max Rp 200rb/minggu · Rapih notif kalau hampir habis.',
    badge: 'Paling cocok',
  },
  {
    id: 'transfer',
    emoji: '💰',
    title: 'Auto-pindah ke Tabungan',
    detail: 'Tiap beli kopi, Rp 25rb otomatis ke goal Liburan.',
    badge: 'Hemat',
  },
  {
    id: 'brake',
    emoji: '⏸️',
    title: 'Mode "rem" weekend',
    detail: 'Sabtu–Minggu: konfirmasi 2x kalau jajan > Rp 75rb.',
    badge: 'Disiplin',
  },
];

type Rule = {
  id: string;
  emoji: string;
  tile: string;
  title: string;
  detail: string;
  meta: string;
  on: boolean;
};

const INITIAL_RULES: Rule[] = [
  {
    id: 'round',
    emoji: '💰',
    tile: palette.limeSoft,
    title: 'Round-up tabungan',
    detail: 'Setiap belanja dibulatkan ke Rp 1.000 terdekat. Sisanya masuk Tabungan Liburan.',
    meta: '8 minggu jalan · +Rp 124rb',
    on: true,
  },
  {
    id: 'bills',
    emoji: '🔔',
    tile: tint.peach,
    title: 'Notif tagihan H-3',
    detail: 'Rapih ingatin 3 hari sebelum tagihan rutin jatuh tempo.',
    meta: 'Terakhir kirim 2 hari lalu',
    on: true,
  },
  {
    id: 'fun',
    emoji: '🚦',
    tile: tint.amber,
    title: 'Cap Senang-Senang',
    detail: 'Max Rp 1,5jt/bulan. Kalau lewat, Rapih kunci kategori sampai bulan depan.',
    meta: 'Bulan ini 78% kepakai',
    on: true,
  },
  {
    id: 'salary',
    emoji: '🧾',
    tile: tint.mint,
    title: 'Bagi gaji otomatis',
    detail: 'Begitu gaji masuk: 20% Tabungan, 10% Goal aktif, sisanya Dompet harian.',
    meta: 'Jalan tiap tanggal 25',
    on: false,
  },
];

type Recipe = {
  id: string;
  emoji: string;
  title: string;
  caption: string;
};

const RECIPES: Recipe[] = [
  { id: 'cap', emoji: '🚦', title: 'Batas kategori', caption: 'Cap mingguan / bulanan' },
  { id: 'transfer', emoji: '↔️', title: 'Auto-transfer', caption: 'Pindah uang otomatis' },
  { id: 'notif', emoji: '🔔', title: 'Notif pintar', caption: 'Alert kondisi tertentu' },
  { id: 'roundup', emoji: '💰', title: 'Round-up', caption: 'Sisihkan kembalian' },
];

export function AturanOtomatisScreen() {
  const router = useRouter();
  const [pickedSuggestion, setPickedSuggestion] = useState<string>('cap');
  const [rules, setRules] = useState(INITIAL_RULES);

  const toggle = (id: string) => {
    haptics.select();
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, on: !r.on } : r)));
  };

  const activeCount = rules.filter((r) => r.on).length;

  return (
    <Screen background={palette.bg} bottomInset={28}>
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 22,
        }}>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 38,
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="chevronLeft" size={14} color={palette.ink} />
        </Pressable>
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Aturan Otomatis
        </Text>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push('/(app)/aturan-riwayat' as Href);
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 38,
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="doc" size={14} color={palette.ink} />
        </Pressable>
      </View>

      {/* intro */}
      <View style={{ paddingHorizontal: 22, marginTop: 14 }}>
        <Text variant="displayS" style={{ fontSize: 30, lineHeight: 32, letterSpacing: -1.2 }}>
          Atur sekali,{'\n'}jalan terus.
        </Text>
        <Text
          variant="body"
          color={palette.inkSoft}
          style={{ fontSize: 13, lineHeight: 19, marginTop: 8 }}>
          Aturan otomatis bantu Rapih jagain pengeluaranmu —{' '}
          cap kategori, auto-transfer ke goal, atau notif pintar.
        </Text>
      </View>

      {/* AI suggestion from insight */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 22,
          padding: 18,
          borderRadius: 24,
          borderCurve: 'continuous',
          backgroundColor: palette.moss,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Icon name="sparkle" size={13} color={palette.lime} />
          <Text
            variant="eyebrow"
            color={palette.lime}
            style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700' }}>
            Dari insight tadi
          </Text>
        </View>
        <Text variant="figureS" color={ONDARK} style={{ fontSize: 18, lineHeight: 22 }}>
          Pengeluaran kopi naik 38%. Pilih satu aturan:
        </Text>

        <View style={{ marginTop: 14, gap: 8 }}>
          {SUGGESTIONS.map((s) => {
            const sel = s.id === pickedSuggestion;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  haptics.select();
                  setPickedSuggestion(s.id);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  backgroundColor: sel ? palette.lime : 'rgba(255,255,255,0.06)',
                }}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 18,
                    marginTop: 2,
                    borderWidth: 1.5,
                    borderColor: sel ? palette.moss : 'rgba(255,255,255,0.4)',
                    backgroundColor: sel ? palette.moss : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {sel ? <Icon name="check" size={10} color={palette.lime} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14, lineHeight: 18 }}>{s.emoji}</Text>
                    <Text
                      variant="bodySm"
                      color={sel ? palette.ink : ONDARK}
                      style={{ fontSize: 13.5, fontWeight: '700', letterSpacing: -0.2 }}>
                      {s.title}
                    </Text>
                    <View
                      style={{
                        paddingVertical: 2,
                        paddingHorizontal: 6,
                        borderRadius: 999,
                        backgroundColor: sel ? palette.moss : 'rgba(184,232,194,0.18)',
                      }}>
                      <Text
                        variant="chip"
                        color={sel ? palette.lime : palette.lime}
                        style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>
                        {s.badge.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text
                    variant="bodySm"
                    color={sel ? palette.ink : 'rgba(240,240,232,0.7)'}
                    style={{ fontSize: 11.5, lineHeight: 16, marginTop: 3 }}>
                    {s.detail}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            haptics.success();
            router.back();
          }}
          style={{
            height: 44,
            borderRadius: 999,
            backgroundColor: palette.lime,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 14,
          }}>
          <Icon name="check" size={12} color={palette.ink} />
          <Text variant="button" color={palette.ink} style={{ fontSize: 13.5 }}>
            Aktifkan pilihan ini
          </Text>
        </Pressable>
      </View>

      {/* active rules */}
      <View style={{ paddingHorizontal: 22, marginTop: 24 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700' }}>
            Aturan kamu · {activeCount} aktif
          </Text>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push('/(app)/aturan-riwayat' as Href);
            }}
            hitSlop={8}>
            <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11, fontWeight: '600' }}>
              Riwayat →
            </Text>
          </Pressable>
        </View>
      </View>

      <View
        style={{
          marginHorizontal: 18,
          marginTop: 10,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {rules.map((r, i) => (
          <View
            key={r.id}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderBottomWidth: i < rules.length - 1 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
              opacity: r.on ? 1 : 0.55,
            }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: r.tile,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 18, lineHeight: 22 }}>{r.emoji}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '700', letterSpacing: -0.2 }}>
                {r.title}
              </Text>
              <Text
                variant="bodySm"
                color={palette.inkSoft}
                style={{ fontSize: 11.5, lineHeight: 16, marginTop: 2 }}>
                {r.detail}
              </Text>
              <Text
                variant="mono"
                color={palette.inkMute}
                style={{ fontSize: 10.5, marginTop: 6 }}>
                {r.meta}
              </Text>
            </View>
            <Pressable
              onPress={() => toggle(r.id)}
              hitSlop={8}
              style={{
                width: 40,
                height: 24,
                borderRadius: 999,
                backgroundColor: r.on ? palette.moss : palette.sand,
                padding: 2,
                justifyContent: 'center',
              }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 20,
                  backgroundColor: r.on ? palette.lime : palette.card,
                  alignSelf: r.on ? 'flex-end' : 'flex-start',
                  boxShadow: '0 1px 2px rgba(10,10,14,0.18)',
                }}
              />
            </Pressable>
          </View>
        ))}
      </View>

      {/* custom rule recipes */}
      <View style={{ paddingHorizontal: 22, marginTop: 24 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700' }}>
          Buat dari nol
        </Text>
      </View>

      <View style={{ marginHorizontal: 18, marginTop: 10, gap: 8 }}>
        {[0, 2].map((start) => (
          <View key={start} style={{ flexDirection: 'row', gap: 8 }}>
            {RECIPES.slice(start, start + 2).map((r) => (
              <Pressable
                key={r.id}
                onPress={() => haptics.tap()}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  backgroundColor: palette.card,
                  boxShadow: `0 0 0 1px ${palette.inkFaint}`,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}>
                <Text style={{ fontSize: 22, lineHeight: 26 }}>{r.emoji}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="bodySm"
                    style={{ fontSize: 12.5, fontWeight: '700', letterSpacing: -0.2 }}>
                    {r.title}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={palette.inkMute}
                    style={{ fontSize: 10.5, marginTop: 1 }}>
                    {r.caption}
                  </Text>
                </View>
                <Icon name="chevronR" size={12} color={palette.inkMute} />
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* footer note */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: palette.limeSoft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Icon name="leaf" size={14} color={palette.moss} />
        <Text
          variant="bodySm"
          color={palette.moss}
          style={{ flex: 1, fontSize: 11.5, lineHeight: 17 }}>
          Aturan jalan di latar belakang. Bisa di-pause atau dihapus kapan aja.
        </Text>
      </View>

      <View style={{ height: 16 }} />
    </Screen>
  );
}
