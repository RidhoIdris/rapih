import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { palette, tint } from '@/theme';
import { Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Status = 'paid' | 'due' | 'upcoming';
type Bill = { name: string; sub: string; amt: number; d: number; icon: string; c: string; status: Status };

const FIXED: Bill[] = [
  { name: 'Cicilan mobil', sub: 'Mandiri · cicilan ke-18 / 60', amt: 4200000, d: 5, icon: '🚗', c: '#003e7e', status: 'paid' },
  { name: 'KPR rumah', sub: 'BCA · cicilan ke-32 / 240', amt: 5800000, d: 25, icon: '🏠', c: '#0060af', status: 'due' },
  { name: 'Sewa kost adik', sub: 'Transfer Bandung', amt: 1800000, d: 1, icon: '🛏️', c: palette.moss, status: 'paid' },
];
const INSURANCE: Bill[] = [
  { name: 'BPJS Kesehatan', sub: 'Kelas 1 · 3 jiwa', amt: 450000, d: 10, icon: '🏥', c: '#1a7d4a', status: 'paid' },
  { name: 'BPJS Ketenagakerjaan', sub: 'Auto debit', amt: 92000, d: 1, icon: '🪪', c: '#1a7d4a', status: 'paid' },
  { name: 'Asuransi mobil', sub: 'Allianz · all risk', amt: 320000, d: 15, icon: '🛡️', c: '#003a78', status: 'upcoming' },
];
const SUBS: Bill[] = [
  { name: 'Spotify Family', sub: 'Akun bareng', amt: 89000, d: 12, icon: '🎧', c: '#1db954', status: 'paid' },
  { name: 'Netflix Premium', sub: '4 layar', amt: 186000, d: 18, icon: '📺', c: '#e50914', status: 'upcoming' },
  { name: 'iCloud 200GB', sub: 'Apple', amt: 49000, d: 22, icon: '☁️', c: '#888888', status: 'upcoming' },
  { name: 'Internet rumah', sub: 'IndiHome 100Mbps', amt: 425000, d: 20, icon: '📡', c: '#ee7300', status: 'upcoming' },
];

const ALL = [...FIXED, ...INSURANCE, ...SUBS];
const TOTAL = ALL.reduce((s, r) => s + r.amt, 0);
const PAID = ALL.filter((r) => r.status === 'paid').length;
const DUE_SOON = ALL.filter((r) => r.status === 'upcoming').length;

const STATUS: Record<Status, { c: string; l: string }> = {
  paid: { c: palette.cool, l: 'Lunas' },
  due: { c: palette.coral, l: 'Telat' },
  upcoming: { c: tint.goldInk, l: 'Sebentar lagi' },
};

function Row({ r, last, onPress }: { r: Bill; last: boolean; onPress: () => void }) {
  const st = STATUS[r.status];
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.inkFaint,
      }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: r.c,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontSize: 18 }}>{r.icon}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodySm" numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
          {r.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11 }}>
            {r.sub}
          </Text>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11 }}>
            ·
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 6, backgroundColor: st.c }} />
            <Text variant="bodySm" color={st.c} style={{ fontSize: 10.5, fontWeight: '600' }}>
              {st.l}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="mono" style={{ fontSize: 13, fontWeight: '600' }}>
          {rupiah(r.amt, { short: true })}
        </Text>
        <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5, marginTop: 2 }}>
          tgl {r.d}
        </Text>
      </View>
    </Pressable>
  );
}

function Section({ title, items, onRow }: { title: string; items: Bill[]; onRow: () => void }) {
  return (
    <View style={{ marginHorizontal: 18, marginTop: 18 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
          paddingBottom: 8,
        }}>
        <Text variant="label" color={palette.inkMute} style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700' }}>
          {title}
        </Text>
        <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5, fontWeight: '600' }}>
          {rupiah(items.reduce((s, r) => s + r.amt, 0), { short: true })}
        </Text>
      </View>
      <View style={{ backgroundColor: palette.card, borderRadius: 22, borderCurve: 'continuous' }}>
        {items.map((r, i) => (
          <Row key={r.name} r={r} last={i === items.length - 1} onPress={onRow} />
        ))}
      </View>
    </View>
  );
}

/** Recurring-bills content. Rendered as the "Rutin" mode of the Transaksi hub. */
export function RutinPanel() {
  const router = useRouter();
  const goDetail = () => router.push('/(app)/rutin-detail' as Href);

  return (
    <View style={{ paddingBottom: 8 }}>
      {/* hero total */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 18,
          paddingHorizontal: 20,
          borderRadius: 24,
          borderCurve: 'continuous',
          backgroundColor: palette.moss,
          overflow: 'hidden',
        }}>
        <Text variant="eyebrow" color={palette.lime} style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
          Total per bulan
        </Text>
        <Text
          variant="figureXL"
          color={ONDARK}
          style={{ fontSize: 40, letterSpacing: -1.8, lineHeight: 42, marginTop: 6 }}>
          {rupiah(TOTAL, { short: true })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
          {[
            { l: 'Sudah', v: `${PAID} tagihan`, c: ONDARK },
            { l: 'Sebentar lagi', v: `${DUE_SOON} tagihan`, c: tint.amber },
            { l: '% gaji', v: '34%', c: ONDARK },
          ].map((s, i) => (
            <View key={s.l} style={{ flex: 1, flexDirection: 'row', gap: 14 }}>
              {i > 0 && <View style={{ width: 1, backgroundColor: 'rgba(240,240,232,0.15)' }} />}
              <View style={{ flex: 1 }}>
                <Text
                  variant="label"
                  color="rgba(240,240,232,0.55)"
                  style={{ fontSize: 10, letterSpacing: 0.8, fontWeight: '600' }}>
                  {s.l}
                </Text>
                <Text variant="mono" color={s.c} style={{ fontSize: 13, marginTop: 3 }}>
                  {s.v}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* upcoming alert */}
      <Pressable
        onPress={() => {
          haptics.tap();
          goDetail();
        }}
        style={{
          marginHorizontal: 18,
          marginTop: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: tint.amber,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: tint.goldInk,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 18 }}>⏰</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" color={tint.amberInk} style={{ fontSize: 13, fontWeight: '700', letterSpacing: -0.2 }}>
            KPR jatuh tempo 8 hari lagi
          </Text>
          <Text variant="bodySm" color="rgba(90,74,32,0.75)" style={{ fontSize: 11, marginTop: 1 }}>
            Rp 5,8jt · 25 Mei · Dompet BCA
          </Text>
        </View>
        <Icon name="arrowR" size={14} color={tint.amberInk} />
      </Pressable>

      <Section title="Cicilan & sewa" items={FIXED} onRow={goDetail} />
      <Section title="Asuransi & BPJS" items={INSURANCE} onRow={goDetail} />
      <Section title="Langganan" items={SUBS} onRow={goDetail} />

      {/* add dashed */}
      <Pressable
        onPress={() => {
          haptics.tap();
          router.push('/(app)/tambah-rutin' as Href);
        }}
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          height: 56,
          borderRadius: 20,
          borderCurve: 'continuous',
          borderWidth: 1.5,
          borderColor: palette.inkFaint,
          borderStyle: 'dashed',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
        <Icon name="plus" size={14} color={palette.inkSoft} />
        <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 13, fontWeight: '500' }}>
          Tambah tagihan rutin
        </Text>
      </Pressable>

      {/* AI nudge */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 20,
          borderCurve: 'continuous',
          backgroundColor: palette.lime,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Icon name="sparkle" size={14} color={palette.moss} />
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '700', letterSpacing: -0.2 }}>
            2 langganan jarang dipakai bulan ini.
          </Text>
          <Text variant="bodySm" color="rgba(10,20,10,0.65)" style={{ fontSize: 11.5, marginTop: 2 }}>
            Hemat sampai Rp 235rb/bulan kalau di-pause.
          </Text>
        </View>
        <Icon name="arrowR" size={14} color={palette.ink} />
      </View>
    </View>
  );
}
