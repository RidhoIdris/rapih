import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { palette, textVariants, tint } from '@/theme';
import { Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

const REASONS = [
  { label: 'Makan di luar', amt: '+ Rp 312rb', w: 80, c: palette.coral },
  { label: 'Transport (Gojek)', amt: '+ Rp 124rb', w: 52, c: tint.gold },
  { label: 'Belanja online', amt: '+ Rp 46rb', w: 26, c: palette.cool },
];

const SUGGESTIONS: { label: string; lead?: boolean }[] = [
  { label: 'Buat limit makan luar', lead: true },
  { label: 'Lihat detail per transaksi' },
  { label: 'Bandingkan minggu lalu' },
];

function Avatar() {
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 30,
        backgroundColor: palette.moss,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
      }}>
      <Icon name="sparkle" size={14} color={palette.lime} />
    </View>
  );
}

export function TanyaScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StatusBar style="dark" />
      {/* ── header ── */}
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View>
          <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11 }}>
            Tanya
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text variant="figureL" style={{ fontSize: 28, letterSpacing: -1 }}>
              Rapih
            </Text>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 14 }}>
              · online
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => haptics.tap()}
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
      </View>

      {/* ── messages ── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 8,
          paddingBottom: insets.bottom + 120,
          gap: 14,
        }}>
        {/* greeting */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Avatar />
          <View
            style={{
              maxWidth: '85%',
              backgroundColor: palette.card,
              borderRadius: 18,
              borderTopLeftRadius: 6,
              borderCurve: 'continuous',
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}>
            <Text
              variant="figureS"
              style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.3 }}>
              Halo Adelia! Aku sudah lihat aktivitas minggu ini.
            </Text>
            <Text
              variant="body"
              color={palette.inkSoft}
              style={{ fontSize: 13, lineHeight: 18, marginTop: 6 }}>
              Ada 3 hal yang menarik. Mau lihat ringkasannya atau langsung tanya?
            </Text>
          </View>
        </View>

        {/* user */}
        <View
          style={{
            alignSelf: 'flex-end',
            maxWidth: '78%',
            backgroundColor: palette.lime,
            borderRadius: 18,
            borderTopRightRadius: 6,
            borderCurve: 'continuous',
            paddingVertical: 10,
            paddingHorizontal: 14,
          }}>
          <Text variant="body" color={palette.ink} style={{ fontSize: 14, lineHeight: 20 }}>
            Kenapa pengeluaranku minggu ini terasa lebih boros?
          </Text>
        </View>

        {/* analysis */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Avatar />
          <View style={{ maxWidth: '85%', gap: 10 }}>
            <View
              style={{
                backgroundColor: palette.card,
                borderRadius: 18,
                borderTopLeftRadius: 6,
                borderCurve: 'continuous',
                paddingVertical: 12,
                paddingHorizontal: 14,
              }}>
              <Text variant="body" style={{ fontSize: 14, lineHeight: 20 }}>
                Pengeluaran kamu naik{' '}
                <Text variant="body" style={{ fontSize: 14, fontWeight: '700' }}>
                  Rp 482rb (+18%)
                </Text>{' '}
                dari minggu lalu. Penyebab utama:
              </Text>
            </View>

            {/* reasoning card */}
            <View
              style={{
                backgroundColor: palette.card,
                borderRadius: 18,
                borderCurve: 'continuous',
                padding: 14,
                gap: 10,
              }}>
              {REASONS.map((r) => (
                <View key={r.label}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 5,
                    }}>
                    <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '500' }}>
                      {r.label}
                    </Text>
                    <Text variant="mono" color={palette.inkSoft} style={{ fontSize: 12 }}>
                      {r.amt}
                    </Text>
                  </View>
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
                        width: `${r.w}%`,
                        backgroundColor: r.c,
                        borderRadius: 6,
                      }}
                    />
                  </View>
                </View>
              ))}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 6,
                  marginTop: 4,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: palette.inkFaint,
                }}>
                <Text style={{ fontSize: 12 }}>💡</Text>
                <Text
                  variant="bodySm"
                  color={palette.inkSoft}
                  style={{ flex: 1, fontSize: 11.5, lineHeight: 16 }}>
                  Makan di luar 5 dari 7 hari. Biasanya kamu 2–3x.
                </Text>
              </View>
            </View>

            {/* suggestion chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s.label}
                  onPress={() => haptics.select()}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: s.lead ? palette.moss : palette.card,
                    boxShadow: s.lead ? undefined : `0 0 0 1px ${palette.inkFaint}`,
                  }}>
                  {s.lead && <Icon name="bolt" size={14} color={palette.lime} />}
                  <Text
                    variant="chip"
                    color={s.lead ? ONDARK : palette.ink}
                    style={{ fontSize: 12 }}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── composer ── */}
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: insets.bottom + 14,
          }}>
          <Svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          pointerEvents="none">
          <Defs>
            <LinearGradient id="tanyaFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.bg} stopOpacity={0} />
              <Stop offset="0.3" stopColor={palette.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#tanyaFade)" />
        </Svg>
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
          }}>
          <TextInput
            placeholder="Tanya soal uangmu…"
            placeholderTextColor={palette.inkMute}
            style={[
              textVariants.body,
              { flex: 1, fontSize: 14, color: palette.ink, padding: 0 },
            ]}
          />
          <Pressable
            onPress={() => haptics.tap()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 36,
              backgroundColor: palette.sand,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="mic" size={14} color={palette.ink} />
          </Pressable>
          <Pressable
            onPress={() => haptics.tap()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 42,
              backgroundColor: palette.moss,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="send" size={16} color={palette.lime} />
          </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
