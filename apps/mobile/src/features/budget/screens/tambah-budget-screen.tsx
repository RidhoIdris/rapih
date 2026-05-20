import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, tint } from '@/theme';
import { Caret, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Preset = {
  l: string;
  emoji: string;
  /** soft tile background tint */
  tile: string;
  /** ink + bar color */
  ink: string;
};

const PRESETS: Preset[] = [
  { l: 'Kebutuhan', emoji: '🏡', tile: tint.mint, ink: tint.mintInk },
  { l: 'Senang-Senang', emoji: '🎉', tile: tint.amber, ink: tint.amberInk },
  { l: 'Transport', emoji: '🛵', tile: tint.peach, ink: tint.peachInk },
  { l: 'Kopi & jajan', emoji: '☕', tile: palette.limeSoft, ink: palette.moss },
  { l: 'Hadiah', emoji: '🎁', tile: tint.rose, ink: tint.roseInk },
  { l: 'Lainnya', emoji: '✨', tile: tint.iris, ink: tint.irisInk },
];

const SAMPLE_CAPS = [
  { l: 'Rp 500rb', v: 500_000 },
  { l: 'Rp 1jt', v: 1_000_000 },
  { l: 'Rp 2,5jt', v: 2_500_000 },
  { l: 'Rp 5jt', v: 5_000_000 },
];

export function TambahBudgetScreen() {
  const router = useRouter();
  const [presetIdx, setPresetIdx] = useState(1);
  const [capIdx, setCapIdx] = useState(1);
  const sel = PRESETS[presetIdx];
  const cap = SAMPLE_CAPS[capIdx].v;

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
          Envelope Baru
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* preview hero — live envelope row */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 22,
          paddingVertical: 18,
          paddingHorizontal: 18,
          borderRadius: 24,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
        }}>
        <Text
          variant="eyebrow"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
          Pratinjau
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 12,
          }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: sel.tile,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 20 }}>{sel.emoji}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="bodySm"
              numberOfLines={1}
              style={{ fontSize: 14, fontWeight: '600', letterSpacing: -0.2 }}>
              {sel.l}
            </Text>
            <Text
              variant="bodySm"
              color={palette.inkMute}
              style={{ fontSize: 11, marginTop: 2 }}>
              Plafon {rupiah(cap, { short: true })} · 0% terpakai
            </Text>
          </View>
        </View>
        <View
          style={{
            height: 6,
            borderRadius: 6,
            marginTop: 14,
            backgroundColor: palette.sand,
            overflow: 'hidden',
          }}>
          <View style={{ height: '100%', width: '0%', backgroundColor: sel.ink }} />
        </View>
      </View>

      {/* name */}
      <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
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
          Nama envelope
        </Text>
        <View
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <Text style={{ fontSize: 16, marginRight: 10 }}>{sel.emoji}</Text>
          <Text
            variant="bodySm"
            style={{ fontSize: 15, fontWeight: '500', letterSpacing: -0.2 }}>
            {sel.l}
          </Text>
          <Caret height={16} />
        </View>
      </View>

      {/* category preset picker */}
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
          Kategori
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p, i) => {
            const on = i === presetIdx;
            return (
              <Pressable
                key={p.l}
                onPress={() => {
                  haptics.select();
                  setPresetIdx(i);
                }}
                style={{
                  width: '31.5%',
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  backgroundColor: on ? palette.ink : palette.card,
                  alignItems: 'center',
                  gap: 4,
                }}>
                <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
                <Text
                  variant="bodySm"
                  color={on ? ONDARK : palette.ink}
                  numberOfLines={1}
                  style={{ fontSize: 11, fontWeight: '700' }}>
                  {p.l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* cap picker */}
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
          Plafon bulanan
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {SAMPLE_CAPS.map((c, i) => {
            const on = i === capIdx;
            return (
              <Pressable
                key={c.l}
                onPress={() => {
                  haptics.select();
                  setCapIdx(i);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: on ? palette.lime : palette.card,
                  alignItems: 'center',
                  boxShadow: on ? undefined : `0 0 0 1px ${palette.inkFaint}`,
                }}>
                <Text
                  variant="mono"
                  color={on ? palette.moss : palette.ink}
                  style={{ fontSize: 12, fontWeight: '700' }}>
                  {c.l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* AI hint */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: palette.limeSoft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Icon name="sparkle" size={14} color={palette.moss} />
        <Text
          variant="bodySm"
          color={palette.moss}
          style={{ flex: 1, fontSize: 11.5, lineHeight: 17 }}>
          Rapih bakal kasih notif kalau envelope ini sudah 80% penuh.
        </Text>
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
            Buat envelope
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
