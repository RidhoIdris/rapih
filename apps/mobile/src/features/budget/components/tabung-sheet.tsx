import { useEffect, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons/icon';
import { Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';

const SCREEN_H = Dimensions.get('window').height;
const SPRING = { damping: 24, stiffness: 240, mass: 0.7 } as const;
const QUICK = [50_000, 100_000, 250_000, 500_000];

type Props = {
  visible: boolean;
  goalName: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
};

function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}

export function TabungSheet({ visible, goalName, busy, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const [raw, setRaw] = useState('');
  const ty = useSharedValue(SCREEN_H);
  const amount = parseDigits(raw);

  useEffect(() => {
    ty.value = visible ? withSpring(0, SPRING) : withTiming(SCREEN_H, { duration: 200 });
    if (visible) setRaw('');
  }, [visible, ty]);

  const close = () => {
    ty.value = withTiming(SCREEN_H, { duration: 180 }, () => runOnJS(onClose)());
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        ty.value = withTiming(SCREEN_H, { duration: 180 }, () => runOnJS(onClose)());
      } else {
        ty.value = withSpring(0, SPRING);
      }
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [0, SCREEN_H], [1, 0]),
  }));

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Animated.View style={[{ flex: 1, backgroundColor: 'rgba(12,16,12,0.45)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={close} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Animated.View
          style={[
            {
              backgroundColor: palette.bg,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              borderCurve: 'continuous',
              paddingTop: 10,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: 20,
              boxShadow: '0 -8px 40px rgba(10,12,10,0.22)',
            },
            panelStyle,
          ]}>
          {/* grabber */}
          <GestureDetector gesture={pan}>
            <View style={{ alignItems: 'center', paddingVertical: 6 }}>
              <View
                style={{ width: 40, height: 5, borderRadius: 5, backgroundColor: palette.inkFaint }}
              />
            </View>
          </GestureDetector>

          {/* title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 34,
                backgroundColor: palette.limeSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="plus" size={15} color={palette.moss} />
            </View>
            <View>
              <Text variant="bodySm" style={{ fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2 }}>
                Tabung sekarang
              </Text>
              <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11.5, marginTop: 1 }}>
                ke {goalName}
              </Text>
            </View>
          </View>

          {/* amount input */}
          <View
            style={{
              marginTop: 16,
              paddingVertical: 16,
              paddingHorizontal: 18,
              borderRadius: 18,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 6,
              boxShadow: amount > 0 ? `0 0 0 1.5px ${palette.moss}` : `0 0 0 1px ${palette.inkFaint}`,
            }}>
            <Text variant="figureL" color={palette.inkMute} style={{ fontSize: 28, letterSpacing: -0.8 }}>
              Rp
            </Text>
            <TextInput
              value={raw ? amount.toLocaleString('id-ID') : ''}
              onChangeText={setRaw}
              keyboardType="number-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor={palette.inkFaint}
              style={{
                flex: 1,
                fontFamily: 'Bricolage-500',
                fontSize: 32,
                letterSpacing: -1,
                color: palette.ink,
                padding: 0,
              }}
            />
          </View>

          {/* quick add */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {QUICK.map((q) => (
              <Pressable
                key={q}
                onPress={() => {
                  haptics.select();
                  setRaw(String(amount + q));
                }}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: palette.card,
                  alignItems: 'center',
                  boxShadow: `0 0 0 1px ${palette.inkFaint}`,
                }}>
                <Text variant="mono" style={{ fontSize: 11.5, fontWeight: '700' }}>
                  +{rupiah(q, { short: true }).replace('Rp ', '')}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* CTA */}
          <Pressable
            onPress={() => {
              if (amount <= 0 || busy) return;
              onSubmit(amount);
            }}
            disabled={amount <= 0 || busy}
            style={{
              marginTop: 16,
              height: 54,
              borderRadius: 27,
              backgroundColor: palette.moss,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: amount <= 0 || busy ? 0.45 : 1,
            }}>
            <Icon name="check" size={14} color={palette.lime} />
            <Text variant="button" color={palette.lime} style={{ fontSize: 15 }}>
              {busy ? 'Menyimpan…' : 'Tambah ke tabungan'}
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
