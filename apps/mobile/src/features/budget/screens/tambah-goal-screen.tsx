import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette } from '@/theme';
import { Caret, Glow, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

const PRESETS = [
  { e: '🌴', l: 'Liburan' },
  { e: '🏠', l: 'Rumah' },
  { e: '💻', l: 'Gadget' },
  { e: '🎓', l: 'Pendidikan' },
  { e: '💍', l: 'Nikah' },
  { e: '🚗', l: 'Kendaraan' },
  { e: '🕌', l: 'Umroh' },
  { e: '🎁', l: 'Lainnya' },
] as const;

export function TambahGoalScreen() {
  const router = useRouter();
  const [iconIdx, setIconIdx] = useState(0);
  const selected = PRESETS[iconIdx];

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
        <Pressable
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 38,
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="x" size={12} color={palette.ink} />
        </Pressable>
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Goal Baru
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* preview hero */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 22,
          padding: 22,
          borderRadius: 26,
          borderCurve: 'continuous',
          backgroundColor: palette.moss,
          overflow: 'hidden',
        }}>
        <Glow
          size={180}
          color={palette.lime}
          opacity={0.22}
          fadeAt={0.7}
          position={{ top: -50, right: -50 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(184,232,194,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 24 }}>{selected.e}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              variant="eyebrow"
              color={palette.lime}
              style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
              Pratinjau
            </Text>
            <Text
              variant="figureS"
              color={ONDARK}
              style={{ fontSize: 22, letterSpacing: -0.8, lineHeight: 24, marginTop: 2 }}>
              Liburan Bali
            </Text>
          </View>
        </View>
        <View
          style={{
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 8,
          }}>
          <Text
            variant="figureL"
            color={ONDARK}
            style={{ fontSize: 34, letterSpacing: -1.4, lineHeight: 36 }}>
            Rp 13,2jt
          </Text>
          <Text
            variant="bodySm"
            color="rgba(240,240,232,0.65)"
            style={{ fontSize: 11.5 }}>
            · 14 Sep 2026
          </Text>
        </View>
      </View>

      {/* form card */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {/* name */}
        <View
          style={{
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderBottomWidth: 1,
            borderBottomColor: palette.inkFaint,
          }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700' }}>
            Nama goal
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 6,
            }}>
            <Text
              variant="bodySm"
              style={{ fontSize: 16, fontWeight: '500', letterSpacing: -0.2 }}>
              Liburan Bali
            </Text>
            <Caret height={18} />
          </View>
        </View>

        {/* target nominal */}
        <View
          style={{
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderBottomWidth: 1,
            borderBottomColor: palette.inkFaint,
          }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700' }}>
            Target nominal
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              marginTop: 4,
            }}>
            <Text variant="figureM" color={palette.inkMute} style={{ fontSize: 26, marginRight: 4 }}>
              Rp
            </Text>
            <Text variant="figureM" style={{ fontSize: 26, letterSpacing: -0.8 }}>
              13.200.000
            </Text>
          </View>
        </View>

        {/* target date */}
        <View style={{ paddingVertical: 14, paddingHorizontal: 18 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700' }}>
            Target tanggal
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 6,
            }}>
            <Text variant="bodySm" style={{ fontSize: 14, fontWeight: '500' }}>
              14 September 2026
            </Text>
            <View
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: palette.limeSoft,
              }}>
              <Text
                variant="chip"
                color={palette.moss}
                style={{ fontSize: 11, fontWeight: '700' }}>
                16 minggu lagi
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* icon picker */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{
            fontSize: 10.5,
            letterSpacing: 1.3,
            fontWeight: '700',
            paddingHorizontal: 4,
            paddingBottom: 8,
          }}>
          Ikon & kategori
        </Text>
        <View style={{ gap: 8 }}>
          {[0, 4].map((start) => (
            <View key={start} style={{ flexDirection: 'row', gap: 8 }}>
              {PRESETS.slice(start, start + 4).map((p, idx) => {
                const i = start + idx;
                const sel = i === iconIdx;
                return (
                  <Pressable
                    key={p.l}
                    onPress={() => {
                      haptics.select();
                      setIconIdx(i);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      paddingHorizontal: 6,
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      backgroundColor: sel ? palette.ink : palette.card,
                      alignItems: 'center',
                      gap: 6,
                    }}>
                    <Text style={{ fontSize: 22, lineHeight: 28 }}>{p.e}</Text>
                    <Text
                      variant="bodySm"
                      color={sel ? ONDARK : palette.ink}
                      numberOfLines={1}
                      style={{ fontSize: 10.5, fontWeight: '700' }}>
                      {p.l}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* rhythm — AI suggestion */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: palette.lime,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkle" size={14} color={palette.moss} />
          <Text
            variant="eyebrow"
            color={palette.moss}
            style={{ fontSize: 11, letterSpacing: 0.3 }}>
            Saran Rapih
          </Text>
        </View>
        <Text
          variant="bodySm"
          style={{
            fontSize: 14,
            fontWeight: '600',
            marginTop: 6,
            letterSpacing: -0.2,
            lineHeight: 20,
          }}>
          Nabung otomatis{' '}
          <Text variant="mono" style={{ fontSize: 14, fontWeight: '700' }}>
            Rp 825rb
          </Text>
          /minggu tiap Senin pagi.
        </Text>
        <Text
          variant="bodySm"
          color="rgba(10,20,10,0.7)"
          style={{ fontSize: 11.5, marginTop: 4 }}>
          Rapih catatkan otomatis ke goal ini tiap Senin. Bisa di-skip kapan aja.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Pressable
            onPress={() => haptics.tap()}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 19,
              borderWidth: 1,
              borderColor: palette.moss,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text variant="bodySm" color={palette.moss} style={{ fontSize: 12, fontWeight: '700' }}>
              Atur sendiri
            </Text>
          </Pressable>
          <Pressable
            onPress={() => haptics.select()}
            style={{
              flex: 1.4,
              height: 38,
              borderRadius: 19,
              backgroundColor: palette.moss,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text variant="bodySm" color={palette.lime} style={{ fontSize: 12, fontWeight: '700' }}>
              Pakai saran
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Pressable
          onPress={() => {
            haptics.success();
            router.back();
          }}
          style={{
            height: 54,
            borderRadius: 27,
            backgroundColor: palette.moss,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
          <Icon name="check" size={14} color={ONDARK} />
          <Text variant="button" color={ONDARK} style={{ fontSize: 15 }}>
            Buat goal
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
