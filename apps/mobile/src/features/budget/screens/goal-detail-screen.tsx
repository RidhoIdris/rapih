import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, tint } from '@/theme';
import { Glow, Screen, TabBar, Text } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;
const CURRENT = 9_800_000;
const TARGET = 13_200_000;
const PCT = Math.round((CURRENT / TARGET) * 100);

/** 12 weeks of contributions, in rupiah; last entry is "now". */
const WEEKS = [180, 200, 0, 250, 220, 300, 180, 280, 250, 320, 280, 350].map(
  (k) => k * 1000,
);
const MAX_WEEK = Math.max(...WEEKS);

type Contribution = { t: string; d: string; amt: number };
const CONTRIBUTIONS: Contribution[] = [
  { t: 'Otomatis · tiap Senin', d: '13 Mei', amt: 250_000 },
  { t: 'Top-up manual', d: '06 Mei', amt: 500_000 },
  { t: 'Bonus kantor · dialokasikan', d: '01 Mei', amt: 1_000_000 },
  { t: 'Otomatis · tiap Senin', d: '29 Apr', amt: 250_000 },
];

function HeaderBtn({ name, onPress }: { name: IconName; onPress: () => void }) {
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
      }}>
      <Icon name={name} size={name === 'chevronLeft' ? 14 : 16} color={palette.ink} />
    </Pressable>
  );
}

export function GoalDetailScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen background={palette.bg} bottomInset={110}>
        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 22,
          }}>
          <HeaderBtn
            name="chevronLeft"
            onPress={() => {
              haptics.tap();
              router.back();
            }}
          />
          <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11.5, fontWeight: '500' }}>
            Goal · aktif
          </Text>
          <HeaderBtn name="more" onPress={() => haptics.tap()} />
        </View>

        {/* hero — moss card */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 20,
            padding: 22,
            borderRadius: 28,
            borderCurve: 'continuous',
            backgroundColor: palette.moss,
            overflow: 'hidden',
            boxShadow: '0 12px 28px rgba(31,42,31,0.28)',
          }}>
          <Glow
            size={220}
            color={palette.lime}
            opacity={0.22}
            fadeAt={0.7}
            position={{ top: -60, right: -60 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(184,232,194,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 24 }}>🌴</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                variant="eyebrow"
                color={palette.lime}
                style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
                Tujuan tabungan
              </Text>
              <Text
                variant="figureL"
                color={ONDARK}
                style={{ fontSize: 30, letterSpacing: -1.2, lineHeight: 32, marginTop: 4 }}>
                Liburan Bali
              </Text>
            </View>
          </View>

          {/* number */}
          <View
            style={{
              marginTop: 22,
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 10,
            }}>
            <Text
              variant="figureXL"
              color={ONDARK}
              style={{ fontSize: 44, letterSpacing: -1.8, lineHeight: 46 }}>
              {rupiah(CURRENT, { short: true })}
            </Text>
            <Text variant="bodySm" color="rgba(240,240,232,0.65)" style={{ fontSize: 12 }}>
              / {rupiah(TARGET, { short: true })}
            </Text>
          </View>

          {/* progress */}
          <View
            style={{
              marginTop: 14,
              height: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.10)',
              overflow: 'hidden',
            }}>
            <View
              style={{
                height: '100%',
                width: `${PCT}%`,
                backgroundColor: palette.lime,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 6,
              }}>
              <Text
                variant="mono"
                color={palette.moss}
                style={{ fontSize: 9, fontWeight: '800' }}>
                {PCT}%
              </Text>
            </View>
          </View>

          {/* stat row */}
          <View style={{ marginTop: 18, flexDirection: 'row', gap: 14 }}>
            {[
              { l: 'Sisa', v: rupiah(TARGET - CURRENT, { short: true }) },
              { l: 'Target', v: '14 Sep 2026' },
              { l: 'Per minggu', v: 'Rp 240rb' },
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
                  <Text variant="mono" color={ONDARK} style={{ fontSize: 14, marginTop: 3 }}>
                    {s.v}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* actions */}
        <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => haptics.tap()}
            style={{
              flex: 1.4,
              height: 50,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: palette.lime,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <Icon name="plus" size={14} color={palette.moss} />
            <Text variant="bodySm" color={palette.moss} style={{ fontSize: 13, fontWeight: '700' }}>
              Tabung sekarang
            </Text>
          </Pressable>
          <Pressable
            onPress={() => haptics.tap()}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 16,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: palette.inkFaint,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <Icon name="swap" size={14} color={palette.ink} />
            <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '600' }}>
              Otomatis
            </Text>
          </Pressable>
        </View>

        {/* contribution rhythm */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 20,
            paddingVertical: 18,
            paddingHorizontal: 18,
            borderRadius: 22,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <View>
              <Text
                variant="label"
                color={palette.inkMute}
                style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700' }}>
                Ritme nabung
              </Text>
              <Text variant="figureS" style={{ fontSize: 18, lineHeight: 22, marginTop: 2 }}>
                12 minggu terakhir
              </Text>
            </View>
            <View
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: palette.limeSoft,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
              <Icon name="arrowUp" size={10} color={palette.moss} />
              <Text variant="chip" color={palette.moss} style={{ fontSize: 11, fontWeight: '700' }}>
                konsisten
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 5,
              marginTop: 16,
              height: 64,
            }}>
            {WEEKS.map((w, i) => {
              const h = w === 0 ? 4 : Math.max(4, (w / MAX_WEEK) * 60);
              const isCur = i === WEEKS.length - 1;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    borderRadius: 4,
                    backgroundColor:
                      w === 0 ? palette.sand : isCur ? palette.moss : palette.cool,
                    opacity: w === 0 ? 0.6 : 1,
                  }}
                />
              );
            })}
          </View>
          <View
            style={{
              marginTop: 8,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
            <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5 }}>
              22 Feb
            </Text>
            <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5 }}>
              Sekarang
            </Text>
          </View>
        </View>

        {/* recent contributions */}
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
            Kontribusi terakhir
          </Text>
          <View
            style={{
              backgroundColor: palette.card,
              borderRadius: 22,
              borderCurve: 'continuous',
            }}>
            {CONTRIBUTIONS.map((r, i) => (
              <View
                key={`${r.d}-${i}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderBottomWidth: i < CONTRIBUTIONS.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: palette.lime,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name="arrowUp" size={12} color={palette.moss} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="bodySm"
                    style={{ fontSize: 13.5, fontWeight: '500', letterSpacing: -0.2 }}>
                    {r.t}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={palette.inkMute}
                    style={{ fontSize: 11, marginTop: 1 }}>
                    {r.d} · dari BCA
                  </Text>
                </View>
                <Text
                  variant="mono"
                  color={palette.cool}
                  style={{ fontSize: 13, fontWeight: '600' }}>
                  +{rupiah(r.amt, { short: true })}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* AI nudge */}
        <Pressable
          onPress={() => haptics.tap()}
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
          <Icon name="sparkle" size={14} color={palette.ink} />
          <View style={{ flex: 1 }}>
            <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '600', letterSpacing: -0.2 }}>
              Naikkan Rp 50rb/minggu, kelar 2 minggu lebih cepat.
            </Text>
            <Text variant="bodySm" color="rgba(10,10,14,0.65)" style={{ fontSize: 11.5, marginTop: 2 }}>
              Saran dari Rapih · berdasarkan ritme kamu
            </Text>
          </View>
          <Icon name="arrowR" size={14} color={palette.ink} />
        </Pressable>

        {/* secondary actions */}
        <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => haptics.tap()}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 0 1px ${palette.inkFaint}`,
            }}>
            <Text variant="bodySm" style={{ fontSize: 12.5, fontWeight: '600' }}>
              Pause goal
            </Text>
          </Pressable>
          <Pressable
            onPress={() => haptics.tap()}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 0 1px ${tint.peach}`,
            }}>
            <Text variant="bodySm" color={palette.coral} style={{ fontSize: 12.5, fontWeight: '600' }}>
              Hapus
            </Text>
          </Pressable>
        </View>
      </Screen>

      <TabBar active="budget" />
    </View>
  );
}
