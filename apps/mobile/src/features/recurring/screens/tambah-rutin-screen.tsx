import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, tint } from '@/theme';
import { Caret, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Kind = 'cicilan' | 'asuransi' | 'langganan';

const KINDS: { id: Kind; l: string }[] = [
  { id: 'cicilan', l: 'Cicilan' },
  { id: 'asuransi', l: 'Asuransi' },
  { id: 'langganan', l: 'Langganan' },
];

const FREQS = [
  { l: 'Bulanan', sub: 'tiap bulan' },
  { l: 'Mingguan', sub: 'tiap minggu' },
  { l: 'Tahunan', sub: 'tiap tahun' },
] as const;

const META: [string, string, string][] = [
  ['🏦', 'Dari dompet', 'BCA · ····432'],
  ['📅', 'Tanggal jatuh tempo', 'Setiap tgl 25'],
  ['🔁', 'Auto-debit', 'Aktif'],
  ['✎', 'Catatan', 'KPR rumah · 240 bulan'],
];

export function TambahRutinScreen() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('cicilan');
  const [freqIdx, setFreqIdx] = useState(0);

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
          <Icon name="x" size={12} color={palette.ink} />
        </Pressable>
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            backgroundColor: palette.card,
            borderRadius: 999,
            padding: 4,
          }}>
          {KINDS.map((k) => {
            const on = k.id === kind;
            return (
              <Pressable
                key={k.id}
                onPress={() => {
                  haptics.select();
                  setKind(k.id);
                }}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: on ? palette.moss : 'transparent',
                }}>
                <Text
                  variant="chip"
                  color={on ? ONDARK : palette.inkSoft}
                  style={{ fontSize: 11.5, fontWeight: '700' }}>
                  {k.l}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* amount */}
      <View style={{ paddingHorizontal: 28, paddingTop: 50, alignItems: 'center' }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>
          Nominal per periode
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Text variant="figureXL" color={palette.inkSoft} style={{ fontSize: 28, marginRight: 6 }}>
            Rp
          </Text>
          <Text
            variant="figureXL"
            style={{ fontSize: 56, letterSpacing: -2.6, lineHeight: 56 }}>
            5.800.000
          </Text>
          <Caret height={48} />
        </View>
        <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 12, marginTop: 8 }}>
          lima juta delapan ratus ribu rupiah
        </Text>
      </View>

      {/* name */}
      <View style={{ paddingHorizontal: 18, paddingTop: 32 }}>
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
          Nama tagihan
        </Text>
        <View
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <Text style={{ fontSize: 16, marginRight: 10 }}>🏠</Text>
          <Text
            variant="bodySm"
            style={{ fontSize: 15, fontWeight: '500', letterSpacing: -0.2 }}>
            KPR rumah · BCA
          </Text>
          <Caret height={16} />
        </View>
      </View>

      {/* frequency */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
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
          Frekuensi
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {FREQS.map((f, i) => {
            const on = i === freqIdx;
            return (
              <Pressable
                key={f.l}
                onPress={() => {
                  haptics.select();
                  setFreqIdx(i);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: on ? palette.lime : palette.card,
                  alignItems: 'center',
                  boxShadow: on ? undefined : `0 0 0 1px ${palette.inkFaint}`,
                }}>
                <Text
                  variant="bodySm"
                  color={on ? palette.moss : palette.ink}
                  style={{ fontSize: 13, fontWeight: '700' }}>
                  {f.l}
                </Text>
                <Text
                  variant="bodySm"
                  color={on ? palette.moss : palette.inkMute}
                  style={{ fontSize: 10.5, marginTop: 2 }}>
                  {f.sub}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* meta rows */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {META.map((r, i) => (
          <View
            key={r[1]}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: i < META.length - 1 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
            }}>
            <Text style={{ fontSize: 16 }}>{r[0]}</Text>
            <Text
              variant="bodySm"
              color={palette.inkMute}
              style={{ flex: 1, fontSize: 12, fontWeight: '500' }}>
              {r[1]}
            </Text>
            <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '500' }}>
              {r[2]}
            </Text>
            <Icon name="chevronR" size={12} color={palette.inkMute} />
          </View>
        ))}
      </View>

      {/* AI heads-up */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: tint.amber,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Icon name="sparkle" size={14} color={tint.amberInk} />
        <Text
          variant="bodySm"
          color={tint.amberInk}
          style={{ flex: 1, fontSize: 11.5, lineHeight: 17 }}>
          Tagihan rutin akan otomatis muncul di Beranda 7 hari sebelum jatuh
          tempo.
        </Text>
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Pressable
          onPress={() => {
            haptics.success();
            router.back();
          }}
          style={{
            height: 54,
            borderRadius: 27,
            backgroundColor: palette.moss,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
          <Icon name="check" size={14} color={ONDARK} />
          <Text variant="button" color={ONDARK} style={{ fontSize: 15 }}>
            Simpan tagihan rutin
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
