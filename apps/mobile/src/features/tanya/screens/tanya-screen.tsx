import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons/icon';
import { Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/auth-store';
import { useTanyaStore } from '@/features/tanya/tanya-store';
import { haptics } from '@/lib/haptics';
import { palette, textVariants } from '@/theme';
import { MessageBubble } from '../components/message-bubble';
import { SessionDrawer } from '../components/session-drawer';
import { TanyaPaywallCard } from '../components/tanya-paywall-card';
import { ToolCallChip } from '../components/tool-call-chip';

export function TanyaScreen() {
  const insets = useSafeAreaInsets();
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

      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Pressable
          onPress={() => {
            haptics.tap();
            setDrawerOpen(true);
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 38,
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="more" size={16} color={palette.ink} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11 }}>
            Tanya
          </Text>
          <Text variant="figureS" style={{ fontSize: 16, letterSpacing: -0.3 }}>
            Rapih
          </Text>
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            void createNewSession();
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 38,
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="plus" size={14} color={palette.ink} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 110,
          gap: 6,
        }}>
        {visibleMessages.length === 0 && !streaming && (
          <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 24 }}>
            <Text variant="figureS" style={{ fontSize: 18, textAlign: 'center' }}>
              Mau tanya apa hari ini?
            </Text>
            <Text
              variant="bodySm"
              color={palette.inkSoft}
              style={{ fontSize: 13, textAlign: 'center', marginTop: 6 }}>
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
          <MessageBubble role="assistant" content={streaming.text} streaming />
        )}
        {streaming && streaming.text.length === 0 && !streaming.toolCall && (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: palette.card,
              borderRadius: 18,
              borderTopLeftRadius: 6,
              borderCurve: 'continuous',
              paddingVertical: 10,
              paddingHorizontal: 14,
              marginVertical: 2,
            }}>
            <Text variant="body" color={palette.inkSoft} style={{ fontSize: 14 }}>
              Sebentar…
            </Text>
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: insets.bottom + 14,
            backgroundColor: palette.bg,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: palette.card,
              borderRadius: 26,
              borderCurve: 'continuous',
              paddingLeft: 18,
              paddingRight: 6,
              paddingVertical: 6,
              boxShadow: `0 6px 22px rgba(10,10,14,0.06), 0 0 0 1px ${palette.inkFaint}`,
              opacity: streaming ? 0.6 : 1,
            }}>
            <TextInput
              value={composer}
              onChangeText={setComposer}
              editable={!streaming}
              placeholder="Tanya soal uangmu…"
              placeholderTextColor={palette.inkMute}
              style={[textVariants.body, { flex: 1, fontSize: 14, color: palette.ink, padding: 0 }]}
              returnKeyType="send"
              onSubmitEditing={onSend}
            />
            <Pressable
              onPress={onSend}
              disabled={!!streaming || composer.trim().length === 0}
              style={{
                width: 42,
                height: 42,
                borderRadius: 42,
                backgroundColor: palette.moss,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: streaming || composer.trim().length === 0 ? 0.5 : 1,
              }}>
              <Icon name="send" size={16} color={palette.lime} />
            </Pressable>
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
