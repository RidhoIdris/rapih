import type { AiSessionDto } from '@rapih/shared';
import { useEffect } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, View } from 'react-native';
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
import { palette } from '@/theme';

type Props = {
  visible: boolean;
  sessions: AiSessionDto[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
};

const SCREEN_W = Dimensions.get('window').width;
const WIDTH = Math.min(320, SCREEN_W * 0.82);
const SPRING = { damping: 22, stiffness: 240, mass: 0.7 } as const;

function formatStamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function SessionDrawer({
  visible,
  sessions,
  activeId,
  onClose,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  // tx: panel x-offset. -WIDTH = fully hidden, 0 = fully open.
  const tx = useSharedValue(-WIDTH);

  useEffect(() => {
    tx.value = visible ? withSpring(0, SPRING) : withTiming(-WIDTH, { duration: 200 });
  }, [visible, tx]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      // Drag left only (closing); clamp so it never opens past flush.
      tx.value = Math.min(0, e.translationX);
    })
    .onEnd((e) => {
      const shouldClose = e.translationX < -WIDTH * 0.35 || e.velocityX < -550;
      if (shouldClose) {
        tx.value = withTiming(-WIDTH, { duration: 180 }, () => runOnJS(onClose)());
      } else {
        tx.value = withSpring(0, SPRING);
      }
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-WIDTH, 0], [0, 1]),
  }));

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* backdrop */}
      <Animated.View style={[{ flex: 1, backgroundColor: 'rgba(12,16,12,0.4)' }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* panel */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: WIDTH,
              backgroundColor: palette.bg,
              borderTopRightRadius: 28,
              borderBottomRightRadius: 28,
              borderCurve: 'continuous',
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: 16,
              boxShadow: '0 0 40px rgba(10,12,10,0.22)',
            },
            panelStyle,
          ]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}>
            <Text variant="figureS" style={{ fontSize: 19, letterSpacing: -0.4 }}>
              Sesi Tanya
            </Text>
            <Pressable
              onPress={() => {
                haptics.tap();
                onCreate();
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: palette.moss,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                opacity: pressed ? 0.85 : 1,
              })}>
              <Icon name="plus" size={12} color={palette.lime} />
              <Text variant="chip" color={palette.lime} style={{ fontSize: 12, fontWeight: '700' }}>
                Baru
              </Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {sessions.length === 0 && (
              <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 13, lineHeight: 19 }}>
                Belum ada sesi. Tap “Baru” untuk mulai ngobrol sama Rapih.
              </Text>
            )}
            {sessions.map((s) => {
              const isActive = s.id === activeId;
              const title = s.title.trim().length > 0 ? s.title : 'Sesi baru';
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    haptics.tap();
                    onSelect(s.id);
                  }}
                  onLongPress={() => {
                    haptics.tap();
                    Alert.alert('Hapus sesi?', 'Sesi & isinya akan dihapus.', [
                      { text: 'Batal', style: 'cancel' },
                      { text: 'Hapus', style: 'destructive', onPress: () => onDelete(s.id) },
                    ]);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: isActive ? palette.card : 'transparent',
                    boxShadow: isActive ? `0 0 0 1px ${palette.inkFaint}` : undefined,
                    marginBottom: 5,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 32,
                      backgroundColor: isActive ? palette.moss : palette.sand,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name="sparkle" size={13} color={isActive ? palette.lime : palette.inkSoft} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      variant="bodySm"
                      style={{ fontSize: 13.5, fontWeight: isActive ? '700' : '500' }}
                      numberOfLines={1}>
                      {title}
                    </Text>
                    <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5, marginTop: 2 }}>
                      {formatStamp(s.last_message_at)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
