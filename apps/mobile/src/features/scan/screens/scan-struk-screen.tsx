import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';

import { palette } from '@/theme';
import { Glow, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;
const RECEIPT: [string, string, string][] = [
  ['Indomie Goreng', '×2', '7.000'],
  ['Aqua 600ml', '×1', '4.500'],
  ['Sari Roti Coklat', '×1', '12.000'],
  ['Pocari Sweat', '×2', '17.000'],
  ['Telur Ayam 0,5kg', '×1', '14.500'],
];

function Dashed() {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: '#888',
        borderStyle: 'dashed',
        marginVertical: 10,
      }}
    />
  );
}

export function ScanStrukScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <StatusBar style="light" />
      <Glow
        size={520}
        color="#2a2519"
        opacity={0.9}
        fadeAt={0.8}
        position={{ top: '20%', alignSelf: 'center' }}
      />

      {/* receipt paper */}
      <View
        style={{
          position: 'absolute',
          top: '34%',
          alignSelf: 'center',
          width: 240,
          paddingTop: 18,
          paddingHorizontal: 16,
          paddingBottom: 26,
          backgroundColor: '#f4ebd4',
          borderRadius: 3,
          transform: [{ rotate: '-3deg' }],
          boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
        }}>
        <Text variant="mono" color="#1a1a1a" style={{ textAlign: 'center', fontWeight: '700', fontSize: 11, letterSpacing: 1.5 }}>
          INDOMARET
        </Text>
        <Text variant="mono" color="#666" style={{ textAlign: 'center', fontSize: 8.5, marginTop: 2 }}>
          Jl. Sudirman No. 42 · Bekasi
        </Text>
        <Dashed />
        {RECEIPT.map((r) => (
          <View key={r[0]} style={{ flexDirection: 'row', marginTop: 3 }}>
            <Text variant="mono" color="#1a1a1a" style={{ flex: 1, fontSize: 9 }}>
              {r[0]}
            </Text>
            <Text variant="mono" color="#666" style={{ width: 28, fontSize: 9 }}>
              {r[1]}
            </Text>
            <Text variant="mono" color="#1a1a1a" style={{ width: 44, fontSize: 9, textAlign: 'right' }}>
              {r[2]}
            </Text>
          </View>
        ))}
        <Dashed />
        <View style={{ flexDirection: 'row' }}>
          <Text variant="mono" color="#1a1a1a" style={{ flex: 1, fontSize: 10, fontWeight: '700' }}>
            TOTAL
          </Text>
          <Text variant="mono" color="#1a1a1a" style={{ fontSize: 10, fontWeight: '700' }}>
            55.000
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <Text variant="mono" color="#666" style={{ flex: 1, fontSize: 8.5 }}>
            QRIS · BCA
          </Text>
          <Text variant="mono" color="#666" style={{ fontSize: 8.5 }}>
            17 Mei · 19:14
          </Text>
        </View>
        <Text
          variant="mono"
          color="#1a1a1a"
          style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6, marginTop: 12 }}>
          ▮▮▮▮▮▮▮
        </Text>
      </View>

      {/* viewfinder corners */}
      <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -160, marginTop: -220 }}>
        <Svg width={320} height={440} viewBox="0 0 320 440" fill="none">
          {[0, 1, 2, 3].map((i) => {
            const isRight = i % 2;
            const isBottom = i >= 2;
            const x = isRight ? 320 : 0;
            const y = isBottom ? 440 : 0;
            const dx = isRight ? -30 : 30;
            const dy = isBottom ? -30 : 30;
            return (
              <Path
                key={i}
                d={`M ${x} ${y + dy} L ${x} ${y} L ${x + dx} ${y}`}
                stroke={palette.lime}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </View>

      {/* scan line */}
      <View
        style={{
          position: 'absolute',
          top: '46%',
          alignSelf: 'center',
          width: 320,
          height: 2,
          backgroundColor: palette.lime,
          opacity: 0.85,
          boxShadow: `0 0 30px ${palette.lime}, 0 0 60px ${palette.lime}`,
        }}
      />

      {/* top chrome */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 22,
          right: 22,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
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
            backgroundColor: 'rgba(255,255,255,0.10)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="x" size={12} color={ONDARK} />
        </Pressable>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 6,
              backgroundColor: palette.lime,
              boxShadow: `0 0 8px ${palette.lime}`,
            }}
          />
          <Text variant="chip" color={ONDARK} style={{ fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 }}>
            Auto-deteksi
          </Text>
        </View>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 38,
            backgroundColor: 'rgba(255,255,255,0.10)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 14 }}>⚡</Text>
        </View>
      </View>

      {/* hint */}
      <View style={{ position: 'absolute', top: insets.top + 78, left: 24, right: 24, alignItems: 'center' }}>
        <Text
          variant="label"
          color={palette.lime}
          style={{ fontSize: 11, letterSpacing: 1.8, fontWeight: '700' }}>
          Foto strukmu
        </Text>
        <Text
          variant="figureM"
          color={ONDARK}
          style={{ fontSize: 24, letterSpacing: -0.9, lineHeight: 26, marginTop: 6, textAlign: 'center' }}>
          Letakkan struk di dalam{'\n'}kotak hijau.
        </Text>
      </View>

      {/* AI status */}
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 150,
          left: 22,
          right: 22,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: 'rgba(28,36,24,0.75)',
          borderWidth: 1,
          borderColor: 'rgba(184,232,194,0.25)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 28,
            backgroundColor: palette.lime,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="sparkle" size={14} color={palette.moss} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" color={palette.lime} style={{ fontSize: 12, fontWeight: '700' }}>
            Rapih mengenali: Indomaret
          </Text>
          <Text variant="mono" color="rgba(240,240,232,0.7)" style={{ fontSize: 10.5, marginTop: 1 }}>
            5 item · total Rp 55.000 · 92% yakin
          </Text>
        </View>
      </View>

      {/* shutter row */}
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 30,
          left: 38,
          right: 38,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.10)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 22 }}>🖼️</Text>
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push('/(app)/scan-struk-review' as Href);
          }}
          style={{
            width: 78,
            height: 78,
            borderRadius: 78,
            backgroundColor: ONDARK,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 4px rgba(240,240,232,0.18), 0 0 0 8px rgba(240,240,232,0.08)',
          }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 60,
              backgroundColor: ONDARK,
              borderWidth: 3,
              borderColor: '#0a0a0a',
            }}
          />
        </Pressable>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.10)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="swap" size={14} color={ONDARK} />
        </View>
      </View>
    </View>
  );
}
