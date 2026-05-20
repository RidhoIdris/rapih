import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { palette, tint } from '@/theme';
import { Glow, Screen, TabBar, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { Monogram } from '@/components/brand';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = '#f0f0e8';

/* ── Pulse ring — single financial-health dial ────────────────────────── */
function PulseRing({ score = 78, size = 152 }: { score?: number; size?: number }) {
  const r = size / 2 - 14;
  const C = 2 * Math.PI * r;
  const arc = C * 0.78;
  const gap = C - arc;
  const dash = (score / 100) * arc;
  const c = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation={126} origin={`${c}, ${c}`}>
          <Circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={palette.sand}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${gap}`}
          />
          <Circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={palette.lime}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C - dash}`}
          />
        </G>
      </Svg>
      <View
        style={{
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}>
        <Text variant="figureXL" style={{ fontSize: 56, lineHeight: 58 }}>
          {score}
        </Text>
        <Text
          variant="label"
          color={palette.inkSoft}
          style={{ fontSize: 10, letterSpacing: 1.2 }}>
          Pulse · Sehat
        </Text>
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: 18,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 4,
        }}>
        <View style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: palette.inkMute }} />
        <View style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: palette.ink }} />
        <View style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: palette.inkMute }} />
      </View>
    </View>
  );
}

/* ── small shared bits ────────────────────────────────────────────────── */
function Eyebrow({
  children,
  color = palette.inkMute,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: object;
}) {
  return (
    <Text
      variant="label"
      color={color}
      style={[{ fontSize: 10, letterSpacing: 1.5 }, style]}>
      {children}
    </Text>
  );
}

function Pill({
  children,
  bg = palette.sand,
  color = palette.ink,
  bold,
}: {
  children: ReactNode;
  bg?: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: bg,
      }}>
      <Text variant="chip" color={color} style={{ fontWeight: bold ? '600' : '500' }}>
        {children}
      </Text>
    </View>
  );
}

type QuickItem = {
  l: string;
  e: string;
  c: string;
  tc: string;
  border?: boolean;
  to?: string;
};

const QUICK: QuickItem[] = [
  { l: 'Scan struk', e: '📸', c: tint.amber, tc: tint.amberInk, to: '/(app)/scan-struk' },
  { l: 'Dompet', e: '👛', c: tint.mint, tc: tint.mintInk, to: '/(app)/dompet' },
  { l: 'Transaksi', e: '↗', c: palette.limeSoft, tc: palette.moss, to: '/(app)/transaksi' },
  { l: 'Aset', e: '📈', c: tint.iris, tc: tint.irisInk, to: '/(app)/aset' },
  { l: 'Tagihan', e: '📅', c: tint.peach, tc: tint.peachInk, to: '/(app)/transaksi?mode=rutin' },
  { l: 'Goal', e: '◇', c: palette.card, tc: palette.ink, border: true, to: '/(app)/budget?mode=goal' },
];

const DAILY = [
  85, 42, 118, 76, 55, 210, 38, 92, 68, 180, 42, 72, 60, 148, 95, 52, 128,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

const CATEGORIES = [
  { l: 'Senang-Senang', a: 1200, p: 42, c: tint.amber },
  { l: 'Kebutuhan', a: 820, p: 28, c: tint.mint },
  { l: 'Transport', a: 480, p: 17, c: tint.peach },
  { l: 'Kopi & jajan', a: 240, p: 8, c: palette.lime },
];

const TX = [
  { v: 'Tokopedia', s: 'Kebutuhan · 10:42', amt: -185000, tag: 'auto' },
  { v: 'Gojek · GoFood', s: 'Senang-Senang · 09:14', amt: -68000, tag: 'auto' },
  { v: 'Transfer dari Riska', s: 'Pemasukan · 08:30', amt: 200000, tag: 'in' },
  { v: 'Starbucks Sudirman', s: 'Belum dirapikan · 07:51', amt: -47000, tag: 'new' },
];

export function BerandaScreen() {
  const router = useRouter();
  const dailyAvg =
    DAILY.slice(0, 17).reduce((s, x) => s + x, 0) / 17;
  const maxBar = 220;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen background={palette.bg} bottomInset={96}>
        {/* ── top bar ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 22,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Monogram initials="AD" bg={palette.moss} fg={palette.lime} size={38} />
            <View>
              <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11 }}>
                Selamat pagi,
              </Text>
              <Text
                variant="bodySm"
                style={{ fontSize: 15, fontWeight: '600', letterSpacing: -0.3 }}>
                Adelia
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => haptics.tap()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 38,
                backgroundColor: palette.card,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  '0 1px 2px rgba(10,10,14,0.04), 0 0 0 1px rgba(10,10,14,0.04)',
              }}>
              <Icon name="search" size={16} color={palette.ink} />
            </Pressable>
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push('/(app)/notifikasi' as Href);
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 38,
                backgroundColor: palette.card,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  '0 1px 2px rgba(10,10,14,0.04), 0 0 0 1px rgba(10,10,14,0.04)',
              }}>
              <Icon name="bell" size={16} color={palette.ink} />
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
            </Pressable>
          </View>
        </View>

        {/* ── hero — pulse + summary ── */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 20,
            padding: 20,
            paddingBottom: 22,
            borderRadius: 28,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            boxShadow:
              '0 1px 2px rgba(10,10,14,0.03), 0 8px 22px rgba(10,10,14,0.04)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}>
          <PulseRing score={78} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow style={{ fontWeight: '600' }}>Total Kekayaan</Eyebrow>
            <Text variant="figureL" style={{ marginTop: 4 }}>
              Rp 24,8
              <Text variant="figureL" color={palette.inkMute}>
                jt
              </Text>
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginTop: 7,
              }}>
              <Icon name="arrowUp" size={12} color={palette.cool} />
              <Text
                variant="bodySm"
                color={palette.cool}
                style={{ fontSize: 11.5, fontWeight: '500' }}>
                Rp 1,2jt bulan ini
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 14 }}>
              <Pill bg={palette.lime} color={palette.ink} bold>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 6,
                    backgroundColor: palette.ink,
                  }}
                />
                {'  '}7 hari rapih
              </Pill>
              <Pill>32% nabung</Pill>
            </View>
          </View>
        </View>

        {/* ── AI insight ── */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 14,
            padding: 16,
            paddingHorizontal: 18,
            borderRadius: 24,
            borderCurve: 'continuous',
            backgroundColor: palette.moss,
            overflow: 'hidden',
          }}>
          <Glow
            size={130}
            color="#eaff00"
            opacity={0.18}
            fadeAt={0.7}
            position={{ top: -40, right: -40 }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
            }}>
            <Icon name="sparkle" size={14} color={palette.lime} />
            <Eyebrow color={palette.lime} style={{ fontWeight: '600' }}>
              Insight dari Rapih
            </Eyebrow>
          </View>
          <Text
            variant="figureS"
            color={ONDARK}
            style={{ lineHeight: 25, marginBottom: 4 }}>
            Pengeluaran{' '}
            <Text variant="figureS" color={palette.lime} style={{ fontStyle: 'italic' }}>
              kopi
            </Text>{' '}
            kamu naik 38% minggu ini.
          </Text>
          <Text
            variant="body"
            color="rgba(240,240,245,0.7)"
            style={{ fontSize: 12.5, lineHeight: 17.5, marginBottom: 14 }}>
            Rata-rata Rp 47rb/hari. Kalau dikurangi separuh, kamu hemat Rp 705rb
            sebulan.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => haptics.tap()}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 999,
                backgroundColor: palette.lime,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}>
              <Text
                variant="bodySm"
                color={palette.ink}
                style={{ fontSize: 13, fontWeight: '600', letterSpacing: -0.2 }}>
                Buat aturan otomatis
              </Text>
              <Icon name="arrowR" size={12} color={palette.ink} />
            </Pressable>
            <Pressable
              onPress={() => haptics.tap()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="x" size={12} color={ONDARK} />
            </Pressable>
          </View>
        </View>

        {/* ── quick access ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 22 }}
          contentContainerStyle={{
            paddingHorizontal: 18,
            gap: 8,
            flexDirection: 'row',
          }}>
          {QUICK.map((s) => (
            <Pressable
              key={s.l}
              onPress={() => {
                haptics.tap();
                if (s.to) router.push(s.to as Href);
              }}
              style={{ minWidth: 68, alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  backgroundColor: s.c,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: s.border
                    ? `0 0 0 1px ${palette.inkFaint}`
                    : undefined,
                }}>
                <Text style={{ fontSize: 22 }} color={s.tc}>
                  {s.e}
                </Text>
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

        {/* ── pengeluaran bulan ini ── */}
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
            <Eyebrow style={{ fontWeight: '600' }}>Pengeluaran bulan ini</Eyebrow>
            <Text variant="figureS" style={{ marginTop: 2 }}>
              Rp 3,28
              <Text variant="figureS" color={palette.inkMute}>
                jt
              </Text>{' '}
              · 17 hari
            </Text>
          </View>
          <Pressable onPress={() => { haptics.tap(); router.push('/(app)/transaksi' as Href); }}>
            <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 12 }}>
              Detail →
            </Text>
          </Pressable>
        </View>

        {/* ── daily bars + projection ── */}
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 3,
              height: 90,
            }}>
            {DAILY.map((v, i) => {
              const isFuture = i >= 17;
              const h = isFuture
                ? Math.round((dailyAvg / maxBar) * 100)
                : (v / maxBar) * 100;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    borderRadius: 2,
                    backgroundColor: isFuture
                      ? palette.sand
                      : i === 16
                        ? palette.lime
                        : palette.moss,
                    opacity: isFuture ? 0.6 : 1,
                    borderWidth: isFuture ? 1 : 0,
                    borderColor: palette.sandDeep,
                    borderStyle: isFuture ? 'dashed' : 'solid',
                  }}
                />
              );
            })}
            {/* budget cap line */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '24%',
                borderTopWidth: 1.5,
                borderColor: palette.coral,
                borderStyle: 'dashed',
                alignItems: 'flex-end',
              }}>
              <View
                style={{
                  marginTop: -10,
                  backgroundColor: palette.coral,
                  borderRadius: 999,
                  paddingVertical: 2,
                  paddingHorizontal: 6,
                }}>
                <Text
                  variant="chip"
                  color="#fff"
                  style={{ fontSize: 9, fontWeight: '700' }}>
                  Cap Rp 5jt
                </Text>
              </View>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 8,
            }}>
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
              { l: 'Rata-rata/hari', v: 'Rp 193rb', c: palette.ink },
              { l: 'Proyeksi bulan', v: 'Rp 5,98jt', c: palette.cool },
            ].map((s) => (
              <View key={s.l} style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="label"
                    color={palette.inkMute}
                    style={{ fontSize: 9.5, letterSpacing: 1, fontWeight: '700' }}>
                    {s.l}
                  </Text>
                  <Text
                    variant="mono"
                    color={s.c}
                    style={{ fontSize: 13, marginTop: 2, fontWeight: '600' }}>
                    {s.v}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: palette.inkFaint }} />
              </View>
            ))}
            <View style={{ flex: 1 }}>
              <Text
                variant="label"
                color={palette.inkMute}
                style={{ fontSize: 9.5, letterSpacing: 1, fontWeight: '700' }}>
                vs Bulan lalu
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  marginTop: 2,
                }}>
                <Icon name="arrowUp" size={12} color={palette.coral} />
                <Text
                  variant="mono"
                  color={palette.coral}
                  style={{ fontSize: 13, fontWeight: '600' }}>
                  18%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── cash flow + savings rate ── */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 14,
            flexDirection: 'row',
            gap: 10,
          }}>
          <View
            style={{
              flex: 1.4,
              padding: 16,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: palette.moss,
              overflow: 'hidden',
            }}>
            <Glow
              size={110}
              color={palette.lime}
              opacity={0.18}
              fadeAt={0.7}
              position={{ top: -30, right: -30 }}
            />
            <Text
              variant="label"
              color={palette.lime}
              style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
              Arus kas
            </Text>
            <Text variant="figureM" color={ONDARK} style={{ marginTop: 6 }}>
              +Rp 4,52jt
            </Text>
            <Text
              variant="bodySm"
              color="rgba(240,240,232,0.55)"
              style={{ fontSize: 10.5, marginTop: 2 }}>
              Masuk Rp 7,8jt · keluar Rp 3,28jt
            </Text>
            <View
              style={{
                marginTop: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                height: 8,
              }}>
              <View
                style={{
                  flex: 7.8,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: palette.lime,
                }}
              />
              <View
                style={{
                  flex: 3.28,
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
            <Text
              variant="label"
              color={palette.inkMute}
              style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
              Savings rate
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 4,
                marginTop: 4,
              }}>
              <Text variant="figureM" style={{ fontSize: 28, letterSpacing: -1 }}>
                42%
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 2,
                  paddingBottom: 4,
                }}>
                <Icon name="arrowUp" size={12} color={palette.cool} />
                <Text
                  variant="bodySm"
                  color={palette.cool}
                  style={{ fontSize: 10, fontWeight: '700' }}>
                  8%
                </Text>
              </View>
            </View>
            <Svg width="100%" height={32} viewBox="0 0 100 32" style={{ marginTop: 6 }}>
              <Path
                d="M0 26 L14 22 L28 18 L42 24 L56 14 L70 16 L84 8 L100 6"
                fill="none"
                stroke={palette.cool}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
              <Circle cx={100} cy={6} r={2.5} fill={palette.cool} />
            </Svg>
          </View>
        </View>

        {/* ── top categories ── */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 14,
            padding: 16,
            borderRadius: 22,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}>
            <Text
              variant="label"
              color={palette.inkMute}
              style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
              Kategori tertinggi · Mei
            </Text>
            <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11 }}>
              Lihat semua →
            </Text>
          </View>
          <View style={{ marginTop: 12, gap: 9 }}>
            {CATEGORIES.map((c) => (
              <View key={c.l}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}>
                  <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
                    {c.l}
                  </Text>
                  <Text variant="mono" color={palette.inkMute} style={{ fontSize: 11 }}>
                    Rp {c.a}rb · {c.p}%
                  </Text>
                </View>
                <View
                  style={{
                    height: 8,
                    borderRadius: 8,
                    backgroundColor: palette.sand,
                    overflow: 'hidden',
                  }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.min(c.p * 2.2, 100)}%`,
                      backgroundColor: c.c,
                      borderRadius: 8,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── bills + goals strip ── */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 14,
            flexDirection: 'row',
            gap: 10,
          }}>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push('/(app)/transaksi?mode=rutin' as Href);
            }}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: tint.amber,
            }}>
            <Text
              variant="label"
              color="#7a6028"
              style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
              Tagihan dekat
            </Text>
            <Text variant="figureS" color={tint.amberInk} style={{ marginTop: 6 }}>
              3 tagihan
            </Text>
            <Text
              variant="bodySm"
              color="rgba(122,96,40,0.75)"
              style={{ fontSize: 10.5, marginTop: 2 }}>
              Total Rp 6,1jt · 14 hari
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              <Text style={{ fontSize: 18 }}>🏠</Text>
              <Text style={{ fontSize: 18 }}>📺</Text>
              <Text style={{ fontSize: 18 }}>📡</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push('/(app)/budget?mode=goal' as Href);
            }}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              boxShadow: `0 0 0 1px ${palette.inkFaint}`,
            }}>
            <Text
              variant="label"
              color={palette.inkMute}
              style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }}>
              Goal aktif
            </Text>
            <Text variant="figureS" style={{ marginTop: 6 }}>
              5 jalan
            </Text>
            <Text
              variant="bodySm"
              color={palette.inkMute}
              style={{ fontSize: 10.5, marginTop: 2 }}>
              Terkumpul Rp 64,5jt
            </Text>
            <View style={{ flexDirection: 'row', gap: 3, marginTop: 10 }}>
              {[74, 48, 23, 47, 40].map((p, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 6,
                    backgroundColor: palette.sand,
                    overflow: 'hidden',
                  }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${p}%`,
                      backgroundColor: palette.cool,
                      borderRadius: 6,
                    }}
                  />
                </View>
              ))}
            </View>
          </Pressable>
        </View>
        <View style={{ marginHorizontal: 18, marginTop: 24 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              paddingHorizontal: 4,
              paddingBottom: 10,
            }}>
            <View>
              <Eyebrow style={{ fontWeight: '600' }}>Hari ini</Eyebrow>
              <Text variant="figureS" style={{ marginTop: 2 }}>
                Aktivitas
              </Text>
            </View>
            <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 12 }}>
              3 perlu dicek
            </Text>
          </View>
          <View
            style={{
              backgroundColor: palette.card,
              borderRadius: 24,
              borderCurve: 'continuous',
              paddingVertical: 6,
              paddingHorizontal: 4,
              boxShadow: '0 1px 2px rgba(10,10,14,0.03)',
            }}>
            {TX.map((t, i) => (
              <Pressable
                key={t.v}
                onPress={() => {
                  haptics.tap();
                  router.push('/(app)/transaksi-detail' as Href);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderBottomWidth: i < TX.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor:
                      t.tag === 'in'
                        ? palette.lime
                        : t.tag === 'new'
                          ? tint.peach
                          : palette.sand,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text
                    variant="bodySm"
                    color={palette.ink}
                    style={{ fontSize: 13, fontWeight: '600' }}>
                    {t.v[0]}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="body"
                    style={{ fontSize: 14, fontWeight: '500', letterSpacing: -0.2 }}>
                    {t.v}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={palette.inkMute}
                    style={{ fontSize: 11.5, marginTop: 1 }}>
                    {t.s}
                  </Text>
                </View>
                <Text
                  variant="mono"
                  color={t.amt > 0 ? palette.cool : palette.ink}
                  style={{ fontSize: 13, fontWeight: '500' }}>
                  {rupiah(t.amt, { short: true }).replace('Rp ', '')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Screen>

      <TabBar active="beranda" />
    </View>
  );
}
