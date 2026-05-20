import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { palette } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;
const SPARK =
  'M 0 42 L 30 38 L 60 44 L 90 30 L 120 36 L 150 28 L 180 32 L 210 22 L 240 26 L 270 18 L 300 24 L 320 14';

const ACTIONS: { label: string; icon: IconName; to?: string }[] = [
  { label: 'Transfer', icon: 'arrowUp' },
  { label: 'Terima', icon: 'arrowDn' },
  { label: 'Sesuaikan', icon: 'swap', to: '/(app)/sesuaikan-saldo' },
  { label: 'Statement', icon: 'more' },
];

const ACTIVITY = [
  { v: 'Gaji · PT Tunas', t: '01 Mei · 08:00', amt: 7500000, inc: true },
  { v: 'Tarik tunai · ATM', t: '03 Mei · 14:20', amt: -500000, inc: false },
  { v: 'QRIS Indomaret', t: '05 Mei · 19:14', amt: -87500, inc: false },
  { v: 'Transfer ke Riska', t: '07 Mei · 22:00', amt: -250000, inc: false },
];

function CircleBtn({ name, onPress }: { name: IconName; onPress: () => void }) {
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

export function DompetDetailScreen() {
  const router = useRouter();
  const [card, setCard] = useState({ w: 0, h: 0 });

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
        <CircleBtn
          name="chevronLeft"
          onPress={() => {
            haptics.tap();
            router.back();
          }}
        />
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Dompet
        </Text>
        <CircleBtn name="more" onPress={() => haptics.tap()} />
      </View>

      {/* bank card */}
      <View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCard({ w: width, h: height });
        }}
        style={{
          marginHorizontal: 18,
          marginTop: 24,
          paddingHorizontal: 22,
          paddingTop: 20,
          paddingBottom: 22,
          borderRadius: 28,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: '#0060af',
          boxShadow: '0 12px 28px rgba(0,96,175,0.32)',
        }}>
        {card.w > 0 && (
          <Svg
            width={card.w}
            height={card.h}
            style={{ position: 'absolute', left: 0, top: 0 }}
            pointerEvents="none">
            <Defs>
              <LinearGradient id="bcaCard" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#0060af" />
                <Stop offset="1" stopColor="#003e7e" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={card.w} height={card.h} fill="url(#bcaCard)" />
          </Svg>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Text variant="bodySm" color="#fff" style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.5 }}>
            BCA
          </Text>
          <Text variant="mono" color="rgba(255,255,255,0.7)" style={{ fontSize: 10 }}>
            •••• 432
          </Text>
        </View>
        <Text
          variant="bodySm"
          color="rgba(255,255,255,0.7)"
          style={{ fontSize: 11, marginTop: 16, letterSpacing: 0.8 }}>
          Tahapan BCA
        </Text>
        <Text
          variant="figureXL"
          color="#fff"
          style={{ fontSize: 36, letterSpacing: -1.4, lineHeight: 38, marginTop: 4 }}>
          Rp 8.420.000
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
          }}>
          <Icon name="arrowUp" size={12} color="rgba(255,255,255,0.9)" />
          <Text variant="mono" color="rgba(255,255,255,0.7)" style={{ fontSize: 11 }}>
            +Rp 320rb
          </Text>
          <Text variant="bodySm" color="rgba(255,255,255,0.7)" style={{ fontSize: 11 }}>
            7 hari terakhir
          </Text>
        </View>
      </View>

      {/* sparkline */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: 20,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {['7H', '30H', '90H', '1T'].map((p, i) => (
              <View
                key={p}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: i === 1 ? palette.moss : 'transparent',
                }}>
                <Text
                  variant="bodySm"
                  color={i === 1 ? ONDARK : palette.inkSoft}
                  style={{ fontSize: 11, fontWeight: '600' }}>
                  {p}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="mono" color={palette.inkMute} style={{ fontSize: 11 }}>
            15 Apr — 15 Mei
          </Text>
        </View>
        <Svg width="100%" height={64} viewBox="0 0 320 64" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="bcaSpark" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.cool} stopOpacity={0.25} />
              <Stop offset="1" stopColor={palette.cool} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={`${SPARK} L 320 64 L 0 64 Z`} fill="url(#bcaSpark)" />
          <Path d={SPARK} fill="none" stroke={palette.cool} strokeWidth={2} strokeLinejoin="round" />
          <Circle cx={320} cy={14} r={9} fill={palette.cool} opacity={0.2} />
          <Circle cx={320} cy={14} r={4} fill={palette.cool} />
        </Svg>
      </View>

      {/* quick actions */}
      <View style={{ marginHorizontal: 18, marginTop: 12, flexDirection: 'row', gap: 8 }}>
        {ACTIONS.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => {
              haptics.tap();
              if (a.to) router.push(a.to as Href);
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 10,
              borderRadius: 18,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              alignItems: 'center',
              gap: 6,
            }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 32,
                backgroundColor: palette.sand,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name={a.icon} size={12} color={palette.ink} />
            </View>
            <Text variant="bodySm" style={{ fontSize: 11, fontWeight: '600' }}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* recent activity */}
      <View style={{ marginHorizontal: 18, marginTop: 20 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Aktivitas terakhir
        </Text>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
            padding: 4,
          }}>
          {ACTIVITY.map((t, i) => (
            <View
              key={t.v}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderBottomWidth: i < ACTIVITY.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: 'continuous',
                  backgroundColor: t.inc ? palette.lime : palette.sand,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon
                  name={t.inc ? 'arrowDn' : 'arrowUp'}
                  size={12}
                  color={t.inc ? palette.moss : palette.ink}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '500', letterSpacing: -0.2 }}>
                  {t.v}
                </Text>
                <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
                  {t.t}
                </Text>
              </View>
              <Text
                variant="mono"
                color={t.inc ? palette.cool : palette.ink}
                style={{ fontSize: 13, fontWeight: '500' }}>
                {rupiah(t.amt, { short: true })}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
