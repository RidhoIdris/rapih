import { Pressable, View } from 'react-native';

import { palette, shadow } from '@/theme';
import { BackButton, Chip, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { Monogram } from '@/components/brand';
import { haptics } from '@/lib/haptics';

type LinkRow = { l: string; sub?: string; tail?: string; danger?: boolean };

const LEGAL: LinkRow[] = [
  { l: 'Syarat & ketentuan', sub: 'Diperbarui 4 Mei 2026' },
  { l: 'Kebijakan privasi', sub: 'Apa yang kami simpan & tidak' },
  { l: 'Lisensi pihak ketiga', sub: '38 paket open source' },
  { l: 'Atribusi data pasar', sub: 'IDX · CoinGecko · Logam Mulia' },
];

const COMMUNITY: LinkRow[] = [
  { l: 'Ikuti @rapih.id di Instagram', sub: 'Tips kebiasaan finansial' },
  { l: 'Komunitas Rapih · Discord', sub: '2,4rb anggota' },
  { l: 'Roadmap publik', sub: 'Vote fitur berikutnya', tail: 'baru' },
  { l: 'Beri bintang di App Store', sub: 'Bantu Rapih tumbuh ✦' },
];

const META = [
  { l: 'Versi', v: '1.4.0' },
  { l: 'Build', v: '1247' },
  { l: 'Channel', v: 'Production' },
  { l: 'Diperbarui', v: '4 Mei 2026' },
];

function Group({
  title,
  items,
}: {
  title: string;
  items: LinkRow[];
}) {
  return (
    <View style={{ marginHorizontal: 18, marginTop: 18 }}>
      <Text
        variant="label"
        color={palette.inkMute}
        style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
        {title}
      </Text>
      <View
        style={{
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {items.map((it, i) => (
          <Pressable
            key={it.l}
            onPress={() => haptics.tap()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: i < items.length - 1 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
            }}>
            <View style={{ flex: 1 }}>
              <Text
                variant="bodySm"
                color={it.danger ? palette.coral : palette.ink}
                style={{ fontSize: 14, fontWeight: '500', letterSpacing: -0.2 }}>
                {it.l}
              </Text>
              {it.sub && (
                <Text
                  variant="bodySm"
                  color={palette.inkMute}
                  style={{ fontSize: 11, marginTop: 2 }}>
                  {it.sub}
                </Text>
              )}
            </View>
            {it.tail && (
              <View
                style={{
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  backgroundColor: palette.lime,
                }}>
                <Text variant="chip" color={palette.moss} style={{ fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 }}>
                  {it.tail.toUpperCase()}
                </Text>
              </View>
            )}
            <Icon
              name="chevronR"
              size={12}
              color={it.danger ? palette.coral : palette.inkMute}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function TentangScreen() {
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
        <BackButton />
        <Text variant="bodySm" style={{ fontSize: 14, fontWeight: '700' }}>
          Tentang Rapih
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* hero */}
      <View
        style={{
          alignItems: 'center',
          paddingTop: 28,
          paddingBottom: 6,
        }}>
        <Monogram initials="R" bg={palette.moss} fg={palette.lime} size={84} />
        <Text
          variant="figureS"
          style={{ fontSize: 28, letterSpacing: -1, lineHeight: 32, marginTop: 14 }}>
          rapih
        </Text>
        <Text
          variant="bodySm"
          color={palette.inkSoft}
          style={{ fontSize: 13, marginTop: 4 }}>
          Atur uang. Tanam kebiasaan.
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          <Chip
            label="v1.4.0"
            bg={palette.lime}
            color={palette.moss}
            style={{ paddingVertical: 4, paddingHorizontal: 10 }}
          />
          <Chip
            label="Build 1247"
            bg={palette.sand}
            style={{ paddingVertical: 4, paddingHorizontal: 10 }}
          />
        </View>
      </View>

      {/* update CTA */}
      <Pressable
        onPress={() => haptics.tap()}
        style={{
          marginHorizontal: 18,
          marginTop: 22,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: palette.lime,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: palette.moss,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text color={palette.lime} style={{ fontSize: 13, fontWeight: '700' }}>
            ↑
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" color={palette.moss} style={{ fontSize: 13.5, fontWeight: '700' }}>
            Cek pembaruan
          </Text>
          <Text
            variant="bodySm"
            color="rgba(28,36,24,0.65)"
            style={{ fontSize: 11, marginTop: 2 }}>
            Kamu sedang di versi terbaru
          </Text>
        </View>
        <Icon name="chevronR" size={12} color={palette.moss} />
      </Pressable>

      {/* meta grid */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingVertical: 6,
        }}>
        {META.map((m, i) => (
          <View
            key={m.l}
            style={{
              width: '50%',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRightWidth: i % 2 === 0 ? 1 : 0,
              borderBottomWidth: i < 2 ? 1 : 0,
              borderColor: palette.inkFaint,
            }}>
            <Text
              variant="label"
              color={palette.inkMute}
              style={{ fontSize: 10, letterSpacing: 1, fontWeight: '700' }}>
              {m.l}
            </Text>
            <Text
              variant="mono"
              style={{ fontSize: 13, marginTop: 4, letterSpacing: -0.2 }}>
              {m.v}
            </Text>
          </View>
        ))}
      </View>

      <Group title="Legal" items={LEGAL} />
      <Group title="Komunitas" items={COMMUNITY} />

      {/* changelog teaser */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
          boxShadow: shadow.ring,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700' }}>
            APA YANG BARU · v1.4.0
          </Text>
          <Pressable onPress={() => haptics.tap()} hitSlop={6}>
            <Text variant="bodySm" color={palette.cool} style={{ fontSize: 11.5, fontWeight: '700' }}>
              Lihat semua
            </Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 10, gap: 6 }}>
          {[
            'Scan struk lebih akurat (+18%) di toko kelontong.',
            'Goal sekarang punya bar progres dengan estimasi ETA.',
            'Aturan otomatis bisa pakai kondisi gabungan AND/OR.',
            'Dark mode otomatis ikut sistem (tetap eksperimental).',
          ].map((line, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Text color={palette.cool} style={{ fontSize: 12, lineHeight: 18, fontWeight: '700' }}>
                ✦
              </Text>
              <Text
                variant="bodySm"
                color={palette.inkSoft}
                style={{ flex: 1, fontSize: 12.5, lineHeight: 18 }}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* footer credit */}
      <Text
        variant="mono"
        color={palette.inkMute}
        style={{ fontSize: 11, marginTop: 24, marginBottom: 8, marginHorizontal: 18, textAlign: 'center' }}>
        Dibuat dengan ✦ di Jakarta · © 2026 Rapih
      </Text>
    </Screen>
  );
}
