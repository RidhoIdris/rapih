import type { AiSessionDto } from '@rapih/shared';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
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
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', flexDirection: 'row' }}>
        <Pressable
          onPress={() => {}}
          style={{
            width: '78%',
            maxWidth: 320,
            backgroundColor: palette.bg,
            borderTopRightRadius: 24,
            borderBottomRightRadius: 24,
            paddingTop: 60,
            paddingBottom: 24,
            paddingHorizontal: 18,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}>
            <Text variant="figureS" style={{ fontSize: 18, letterSpacing: -0.3 }}>
              Sesi Tanya
            </Text>
            <Pressable
              onPress={() => {
                haptics.tap();
                onCreate();
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: palette.moss,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
              <Icon name="plus" size={12} color={palette.lime} />
              <Text variant="chip" color={palette.lime} style={{ fontSize: 12 }}>
                Baru
              </Text>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {sessions.length === 0 && (
              <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 13 }}>
                Belum ada sesi. Tap “Baru” untuk mulai.
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
                      {
                        text: 'Hapus',
                        style: 'destructive',
                        onPress: () => onDelete(s.id),
                      },
                    ]);
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    backgroundColor: isActive ? palette.card : 'transparent',
                    marginBottom: 4,
                  }}>
                  <Text
                    variant="bodySm"
                    style={{ fontSize: 13.5, fontWeight: isActive ? '700' : '500' }}
                    numberOfLines={1}>
                    {title}
                  </Text>
                  <Text
                    variant="mono"
                    color={palette.inkMute}
                    style={{ fontSize: 10.5, marginTop: 2 }}>
                    {formatStamp(s.last_message_at)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
