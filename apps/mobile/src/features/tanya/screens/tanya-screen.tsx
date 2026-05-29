import { type Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons/icon';
import { Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/auth-store';
import { useTanyaStore } from '@/features/tanya/tanya-store';
import { haptics } from '@/lib/haptics';
import { palette, textVariants } from '@/theme';
import { AiAvatar, MessageBubble } from '../components/message-bubble';
import { SessionDrawer } from '../components/session-drawer';
import { TanyaPaywallCard } from '../components/tanya-paywall-card';
import { ToolCallChip } from '../components/tool-call-chip';
import { TypingDots } from '../components/typing-dots';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TanyaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    sessions,
    activeSessionId,
    messages,
    streaming,
    loadSessions,
    createNewSession,
    selectSession,
    removeSession,
    loadMessages,
    send,
    cleanupSse,
  } = useTanyaStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [composer, setComposer] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const isFree = user?.tier === 'free';

  // Send button press-spring.
  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));

  useEffect(() => {
    if (isFree) return;
    void (async () => {
      await loadSessions();
      const s = useTanyaStore.getState();
      if (!s.activeSessionId && s.sessions.length === 0) {
        await createNewSession();
      } else if (!s.activeSessionId && s.sessions[0]) {
        await selectSession(s.sessions[0].id);
      }
    })();
    return () => cleanupSse();
  }, [isFree, loadSessions, createNewSession, selectSession, cleanupSse]);

  useEffect(() => {
    if (activeSessionId) void loadMessages();
  }, [activeSessionId, loadMessages]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length, streaming?.text]);

  if (isFree) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <StatusBar style="dark" />
        <View style={{ paddingTop: insets.top + 8 }} />
        <TanyaPaywallCard />
      </View>
    );
  }

  const onBack = () => {
    haptics.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/beranda' as Href);
  };

  const canSend = !streaming && composer.trim().length > 0;

  const onSend = async () => {
    const text = composer.trim();
    if (!text || streaming) return;
    haptics.tap();
    setComposer('');
    await send(text);
  };

  const visibleMessages = messages.filter((m) => m.role !== 'tool');

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StatusBar style="dark" />

      {/* header */}
      <View
        style={{
          paddingTop: insets.top + 2,
          paddingHorizontal: 20,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, flex: 1 }}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 40,
              backgroundColor: palette.card,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 0 1px ${palette.inkFaint}`,
              opacity: pressed ? 0.7 : 1,
            })}>
            <Icon name="chevronLeft" size={15} color={palette.ink} />
          </Pressable>
          <View>
            <Text
              variant="eyebrow"
              color={palette.inkSoft}
              style={{ fontSize: 11, letterSpacing: 0.4 }}>
              Tanya
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 2 }}>
              <Text variant="displayS" style={{ fontSize: 28, letterSpacing: -1 }}>
                Rapih
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View
                  style={{ width: 6, height: 6, borderRadius: 6, backgroundColor: palette.cool }}
                />
                <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 12.5 }}>
                  online
                </Text>
              </View>
            </View>
          </View>
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            setDrawerOpen(true);
          }}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 40,
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 0 1px ${palette.inkFaint}`,
            opacity: pressed ? 0.7 : 1,
          })}>
          <Icon name="more" size={16} color={palette.ink} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 116,
        }}>
        {visibleMessages.length === 0 && !streaming && (
          <View style={{ alignItems: 'center', marginTop: 72, paddingHorizontal: 24 }}>
            <AiAvatar size={52} />
            <Text variant="figureS" style={{ fontSize: 19, textAlign: 'center', marginTop: 16 }}>
              Mau tanya apa hari ini?
            </Text>
            <Text
              variant="bodySm"
              color={palette.inkSoft}
              style={{ fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
              Coba: “Berapa pengeluaran makan bulan ini?”
            </Text>
          </View>
        )}

        {visibleMessages.map((m) => (
          <MessageBubble
            key={m.id}
            role={m.role === 'assistant' ? 'assistant' : 'user'}
            content={m.content}
          />
        ))}

        {streaming?.toolCall && <ToolCallChip name={streaming.toolCall.name} />}
        {streaming && streaming.text.length > 0 && (
          <MessageBubble role="assistant" content={streaming.text} streaming animate={false} />
        )}
        {streaming && streaming.text.length === 0 && !streaming.toolCall && <TypingDots />}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: insets.bottom + 12,
            backgroundColor: palette.bg,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: palette.card,
              borderRadius: 28,
              borderCurve: 'continuous',
              paddingLeft: 18,
              paddingRight: 6,
              paddingVertical: 6,
              boxShadow: `0 6px 22px rgba(10,10,14,0.07), 0 0 0 1px ${palette.inkFaint}`,
            }}>
            <TextInput
              value={composer}
              onChangeText={setComposer}
              editable={!streaming}
              placeholder="Tanya soal uangmu…"
              placeholderTextColor={palette.inkMute}
              multiline
              style={[
                textVariants.body,
                {
                  flex: 1,
                  fontSize: 14.5,
                  lineHeight: 20,
                  maxHeight: 96,
                  color: palette.ink,
                  paddingTop: 8,
                  paddingBottom: 8,
                },
              ]}
              returnKeyType="send"
              onSubmitEditing={onSend}
            />
            {/* mic — voice input (visual affordance for now) */}
            <Pressable
              onPress={() => haptics.tap()}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 42,
                backgroundColor: palette.sand,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}>
              <Icon name="mic" size={16} color={palette.inkSoft} />
            </Pressable>
            <AnimatedPressable
              onPressIn={() => {
                sendScale.value = withSpring(0.88, { damping: 14, stiffness: 320 });
              }}
              onPressOut={() => {
                sendScale.value = withSpring(1, { damping: 12, stiffness: 280 });
              }}
              onPress={onSend}
              disabled={!canSend}
              style={[
                {
                  width: 42,
                  height: 42,
                  borderRadius: 42,
                  backgroundColor: palette.moss,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: canSend ? 1 : 0.45,
                },
                sendStyle,
              ]}>
              <Icon name="send" size={16} color={palette.lime} />
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <SessionDrawer
        visible={drawerOpen}
        sessions={sessions}
        activeId={activeSessionId}
        onClose={() => setDrawerOpen(false)}
        onSelect={(id) => {
          setDrawerOpen(false);
          void selectSession(id);
        }}
        onCreate={() => {
          setDrawerOpen(false);
          void createNewSession();
        }}
        onDelete={(id) => {
          void removeSession(id);
        }}
      />
    </View>
  );
}
