import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { palette, tint } from '@/theme';
import { Glow, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Bucket = {
  name: string;
  sub: string;
  /** spent so far this month, in rupiah */
  amt: number;
  /** envelope cap, in rupiah */
  cap: number;
  emoji: string;
  /** tile background tint */
  tile: string;
  /** progress-bar fill */
  bar: string;
};

const BUCKETS: Bucket[] = [
  { name: 'Kebutuhan',     sub: 'Pokok bulanan',           amt: 3_200_000, cap: 4_500_000, emoji: '🏡', tile: tint.mint,        bar: tint.mintInk },
  { name: 'Senang-Senang', sub: 'Hiburan & nongkrong',     amt:   850_000, cap: 1_200_000, emoji: '🎉', tile: tint.amber,       bar: tint.gold },
  { name: 'Transport',     sub: 'Bensin & ojol',           amt:   480_000, cap:   800_000, emoji: '🛵', tile: tint.peach,       bar: tint.peachInk },
  { name: 'Kopi & jajan',  sub: 'Self-control biar adem',  amt:   260_000, cap:   300_000, emoji: '☕', tile: palette.limeSoft, bar: palette.cool },
  { name: 'Hadiah',        sub: 'Untuk orang lain',        amt:   200_000, cap:   500_000, emoji: '🎁', tile: tint.rose,        bar: tint.roseInk },
];

const TOTAL_USED = BUCKETS.reduce((s, b) => s + b.amt, 0);
const TOTAL_CAP = BUCKETS.reduce((s, b) => s + b.cap, 0);
const NOT_ALLOC = 1_245_000;
const PCT_TOTAL = Math.round((TOTAL_USED / TOTAL_CAP) * 100);

function flagOf(p: number): { l: string; c: string; bg: string } {
  if (p >= 100) return { l: 'Habis', c: palette.coral, bg: tint.peach };
  if (p >= 80) return { l: 'Hampir', c: tint.goldInk, bg: tint.amber };
  return { l: 'Aman', c: palette.cool, bg: palette.limeSoft };
}

function BucketRow({
  b,
  last,
  onPress,
}: {
  b: Bucket;
  last: boolean;
  onPress: () => void;
}) {
  const p = Math.min(100, Math.round((b.amt / b.cap) * 100));
  const sisa = Math.max(0, b.cap - b.amt);
  const f = flagOf(p);
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.inkFaint,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: b.tile,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 18 }}>{b.emoji}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="bodySm"
            numberOfLines={1}
            style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
            {b.name}
          </Text>
          <Text
            variant="bodySm"
            color={palette.inkMute}
            style={{ fontSize: 11, marginTop: 2 }}>
            {b.sub}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="mono" style={{ fontSize: 12.5, fontWeight: '600' }}>
            {rupiah(b.amt, { short: true })}
          </Text>
          <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10, marginTop: 2 }}>
            / {rupiah(b.cap, { short: true }).replace('Rp ', '')}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <View
          style={{
            height: 6,
            borderRadius: 6,
            backgroundColor: palette.sand,
            overflow: 'hidden',
          }}>
          <View
            style={{
              height: '100%',
              width: `${p}%`,
              backgroundColor: p >= 100 ? palette.coral : b.bar,
              borderRadius: 6,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 7,
                borderRadius: 999,
                backgroundColor: f.bg,
              }}>
              <Text variant="chip" color={f.c} style={{ fontSize: 9.5, fontWeight: '700' }}>
                {f.l}
              </Text>
            </View>
            <Text
              variant="mono"
              color={palette.inkMute}
              style={{ fontSize: 10.5, fontWeight: '600' }}>
              {p}%
            </Text>
          </View>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 10.5 }}>
            sisa {rupiah(sisa, { short: true })}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Budget content (envelope buckets). Rendered as the "Budget" mode of the
 * Budget hub. Standalone — no header, no Screen, no TabBar.
 */
export function BudgetPanel({ onRow }: { onRow?: () => void } = {}) {
  const router = useRouter();
  const tap = onRow ?? (() => haptics.tap());
  const goAdd = () => {
    haptics.tap();
    router.push('/(app)/tambah-budget' as Href);
  };
  return (
    <View style={{ paddingBottom: 8 }}>
      {/* hero — total alokasi */}
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
        <Glow
          size={150}
          color={palette.lime}
          opacity={0.18}
          fadeAt={0.7}
          position={{ top: -40, right: -40 }}
        />
        <Text
          variant="eyebrow"
          color={palette.lime}
          style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
          Dipakai · Mei
        </Text>
        <Text
          variant="figureXL"
          color={ONDARK}
          style={{ fontSize: 40, letterSpacing: -1.8, lineHeight: 42, marginTop: 6 }}>
          {rupiah(TOTAL_USED, { short: true })}
        </Text>
        <Text
          variant="bodySm"
          color="rgba(240,240,232,0.55)"
          style={{ fontSize: 11, marginTop: 4 }}>
          dari plafon {rupiah(TOTAL_CAP, { short: true })} · {PCT_TOTAL}% bulan ini
        </Text>

        <View
          style={{
            marginTop: 14,
            height: 8,
            borderRadius: 8,
            backgroundColor: 'rgba(255,255,255,0.18)',
            overflow: 'hidden',
          }}>
          <View
            style={{
              height: '100%',
              width: `${PCT_TOTAL}%`,
              backgroundColor: palette.lime,
              borderRadius: 8,
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
          {[
            { l: 'Belum alokasi', v: rupiah(NOT_ALLOC, { short: true }), c: tint.amber },
            { l: 'Envelope', v: `${BUCKETS.length} aktif`, c: ONDARK },
            { l: '% gaji', v: '58%', c: ONDARK },
          ].map((s, i) => (
            <View key={s.l} style={{ flex: 1, flexDirection: 'row', gap: 14 }}>
              {i > 0 && (
                <View style={{ width: 1, backgroundColor: 'rgba(240,240,232,0.15)' }} />
              )}
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

      {/* AI nudge */}
      <Pressable
        onPress={() => haptics.tap()}
        style={{
          marginHorizontal: 18,
          marginTop: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: palette.lime,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Icon name="sparkle" size={14} color={palette.moss} />
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '700', letterSpacing: -0.2 }}>
            Rp 1,2jt belum dialokasi.
          </Text>
          <Text
            variant="bodySm"
            color="rgba(10,20,10,0.65)"
            style={{ fontSize: 11.5, marginTop: 2 }}>
            Rapih bisa bagi otomatis ke 5 envelope kamu.
          </Text>
        </View>
        <Icon name="arrowR" size={14} color={palette.ink} />
      </Pressable>

      {/* envelope list */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
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
            Envelope bulan ini
          </Text>
          <Text
            variant="mono"
            color={palette.inkMute}
            style={{ fontSize: 10.5, fontWeight: '600' }}>
            {BUCKETS.length} aktif
          </Text>
        </View>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {BUCKETS.map((b, i) => (
            <BucketRow
              key={b.name}
              b={b}
              last={i === BUCKETS.length - 1}
              onPress={tap}
            />
          ))}
        </View>
      </View>

      {/* dashed add */}
      <Pressable
        onPress={goAdd}
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
        <Text
          variant="bodySm"
          color={palette.inkSoft}
          style={{ fontSize: 13, fontWeight: '500' }}>
          Tambah envelope baru
        </Text>
      </Pressable>
    </View>
  );
}
