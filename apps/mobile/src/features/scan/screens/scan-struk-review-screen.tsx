import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { palette, tint } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type RawItem = {
  name: string;
  qty: number;
  price: number;
  cat: string;
  tile: string;
  ink: string;
};

const RECEIPT = {
  merchant: 'Indomaret Cikarang',
  dateLabel: '17 Mei 2026 · 14:32',
  items: [
    { name: 'Indomilk UHT 1L', qty: 2, price: 18500, cat: 'Kebutuhan', tile: tint.mint, ink: tint.mintInk },
    { name: 'Roti tawar Sari Roti', qty: 1, price: 22500, cat: 'Kebutuhan', tile: tint.mint, ink: tint.mintInk },
    { name: 'Chitato 75g', qty: 2, price: 14000, cat: 'Senang-Senang', tile: tint.amber, ink: tint.amberInk },
    { name: 'Aqua 600ml x4', qty: 1, price: 16000, cat: 'Kebutuhan', tile: tint.mint, ink: tint.mintInk },
  ] as RawItem[],
  ppn: 9350,
  service: 0,
  rounding: -50,
};

function allocate(items: RawItem[], fees: number) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  let assigned = 0;
  return items.map((it, i) => {
    const base = it.qty * it.price;
    let share: number;
    if (i === items.length - 1) {
      share = fees - assigned;
    } else {
      share = Math.round((base / subtotal) * fees);
      assigned += share;
    }
    return { ...it, base, share, recorded: base + share };
  });
}

export function ScanStrukReviewScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'per-item' | 'total'>('per-item');

  const subtotal = useMemo(
    () => RECEIPT.items.reduce((s, it) => s + it.qty * it.price, 0),
    [],
  );
  const totalFees = RECEIPT.ppn + RECEIPT.service + RECEIPT.rounding;
  const grandTotal = subtotal + totalFees;
  const allocated = useMemo(() => allocate(RECEIPT.items, totalFees), [totalFees]);

  const txCount = mode === 'per-item' ? RECEIPT.items.length : 1;

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
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Tinjau struk
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* merchant block */}
      <View style={{ paddingHorizontal: 22, marginTop: 16 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700' }}>
          Dari struk
        </Text>
        <Text
          variant="figureS"
          style={{ fontSize: 24, lineHeight: 28, letterSpacing: -0.8, marginTop: 4 }}>
          {RECEIPT.merchant}
        </Text>
        <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 12, marginTop: 2 }}>
          {RECEIPT.dateLabel}
        </Text>
      </View>

      {/* save-mode segmented */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 16,
          flexDirection: 'row',
          gap: 4,
          backgroundColor: palette.card,
          borderRadius: 999,
          padding: 4,
        }}>
        {(['per-item', 'total'] as const).map((m) => {
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
                {m === 'per-item' ? `Per item · ${RECEIPT.items.length}` : 'Total · 1'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text
        variant="bodySm"
        color={palette.inkSoft}
        style={{
          fontSize: 11.5,
          lineHeight: 16,
          marginTop: 8,
          paddingHorizontal: 22,
        }}>
        {mode === 'per-item'
          ? 'Tiap item jadi transaksi sendiri. Pajak & fee dibagi proporsional.'
          : 'Semua item digabung jadi satu transaksi seukuran total struk.'}
      </Text>

      {/* items list */}
      <View style={{ marginHorizontal: 18, marginTop: 14 }}>
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
          Item terdeteksi
        </Text>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {allocated.map((r, i) => (
            <View
              key={r.name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderBottomWidth: i < allocated.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              {r.qty > 1 ? (
                <View
                  style={{
                    minWidth: 28,
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    borderRadius: 8,
                    backgroundColor: palette.sand,
                    alignItems: 'center',
                  }}>
                  <Text variant="mono" style={{ fontSize: 10.5, fontWeight: '700' }}>
                    {r.qty}×
                  </Text>
                </View>
              ) : (
                <View style={{ width: 28 }} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  variant="bodySm"
                  numberOfLines={1}
                  style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
                  {r.name}
                </Text>
                <Pressable
                  onPress={() => haptics.select()}
                  style={{
                    alignSelf: 'flex-start',
                    paddingVertical: 2,
                    paddingHorizontal: 7,
                    borderRadius: 999,
                    backgroundColor: r.tile,
                    marginTop: 3,
                  }}>
                  <Text
                    variant="chip"
                    color={r.ink}
                    style={{ fontSize: 9.5, fontWeight: '700' }}>
                    {r.cat}
                  </Text>
                </Pressable>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="mono" style={{ fontSize: 12.5, fontWeight: '700' }}>
                  {rupiah(r.base)}
                </Text>
                {mode === 'per-item' && r.share !== 0 ? (
                  <Text
                    variant="bodySm"
                    color={palette.inkMute}
                    style={{ fontSize: 10, marginTop: 2 }}>
                    {r.share > 0 ? '+' : '−'} Rp{' '}
                    {Math.abs(r.share).toLocaleString('id-ID')} fee
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* breakdown */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 12,
          padding: 14,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: palette.sand,
          gap: 6,
        }}>
        {[
          ['Subtotal', subtotal],
          ['PPN 11%', RECEIPT.ppn],
          ['Service', RECEIPT.service],
          ['Pembulatan', RECEIPT.rounding],
        ].map(([label, val]) =>
          val === 0 ? null : (
            <View
              key={label as string}
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11.5 }}>
                {label}
              </Text>
              <Text variant="mono" color={palette.ink} style={{ fontSize: 11.5 }}>
                {rupiah(val as number)}
              </Text>
            </View>
          ),
        )}
        <View
          style={{
            height: 1,
            backgroundColor: palette.inkFaint,
            marginVertical: 2,
          }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="bodySm" style={{ fontSize: 12.5, fontWeight: '700' }}>
            Total struk
          </Text>
          <Text variant="mono" style={{ fontSize: 13, fontWeight: '800' }}>
            {rupiah(grandTotal)}
          </Text>
        </View>
      </View>

      {/* meta — wallet + date */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {[
          ['🏦', 'Dibayar dari', 'BCA Tahapan · ····432'],
          ['📅', 'Tanggal', '17 Mei 2026 · hari ini'],
        ].map((r, i) => (
          <Pressable
            key={r[1]}
            onPress={() => haptics.select()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: i === 0 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
            }}>
            <Text style={{ fontSize: 16, lineHeight: 20 }}>{r[0]}</Text>
            <Text
              variant="bodySm"
              color={palette.inkMute}
              style={{ flex: 1, fontSize: 12, fontWeight: '500' }}>
              {r[1]}
            </Text>
            <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '600' }}>
              {r[2]}
            </Text>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 14 }}>
              ›
            </Text>
          </Pressable>
        ))}
      </View>

      {/* AI hint */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: palette.limeSoft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Icon name="sparkle" size={14} color={palette.moss} />
        <Text
          variant="bodySm"
          color={palette.moss}
          style={{ flex: 1, fontSize: 11.5, lineHeight: 17 }}>
          Rapih udah pilihin kategori per item. Tap kategorinya buat ubah.
        </Text>
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14, flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={{
            flex: 1,
            height: 54,
            borderRadius: 27,
            backgroundColor: palette.card,
            boxShadow: `0 0 0 1px ${palette.inkFaint}`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '700' }}>
            Foto ulang
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.success();
            router.push('/(app)/transaksi' as Href);
          }}
          style={{
            flex: 2,
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
            Simpan {txCount} transaksi
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
