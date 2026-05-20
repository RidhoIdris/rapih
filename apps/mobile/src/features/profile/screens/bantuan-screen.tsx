import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { palette, shadow, tint } from '@/theme';
import { BackButton, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

type Faq = { q: string; a: string };
type Cat = { id: string; e: string; bg: string; l: string; sub: string };

const CATEGORIES: Cat[] = [
  { id: 'mulai', e: '✦', bg: palette.lime, l: 'Mulai pakai', sub: '8 artikel' },
  { id: 'tx', e: '↗', bg: tint.iris, l: 'Transaksi', sub: '14 artikel' },
  { id: 'budget', e: '◷', bg: tint.peach, l: 'Budget & Goal', sub: '11 artikel' },
  { id: 'sec', e: '⏚', bg: tint.amber, l: 'Keamanan', sub: '6 artikel' },
];

const FAQS: Faq[] = [
  {
    q: 'Bagaimana Rapih AI tahu kebiasaan saya?',
    a: 'Rapih AI belajar dari pola transaksi yang kamu catat. Semakin sering kamu mencatat, semakin akurat saran yang diberikan. Data hanya diproses di perangkatmu — tidak kami simpan di server.',
  },
  {
    q: 'Apakah saldo dompet saya tersinkron otomatis?',
    a: 'Belum. Saat ini sinkronisasi otomatis hanya untuk dompet yang mendukung Open Finance API. Untuk dompet lain, kamu bisa pakai Scan Struk atau input manual.',
  },
  {
    q: 'Bagaimana cara membatalkan langganan Premium?',
    a: 'Buka Saya → Pengaturan → Langganan → Batalkan. Akses Premium akan tetap aktif sampai akhir periode tagihan terakhir.',
  },
  {
    q: 'Apakah data saya aman jika ganti HP?',
    a: 'Aman. Selama Cadangan otomatis aktif (Saya → Keamanan), kamu bisa restore semua data hanya dengan login ulang di HP baru.',
  },
  {
    q: 'Saya menemukan transaksi yang tidak saya kenali.',
    a: 'Buka transaksi tersebut → ketuk titik tiga → "Laporkan tidak dikenali". Tim Rapih akan menindaklanjuti dalam 1×24 jam.',
  },
];

const CONTACT = [
  { id: 'chat', e: '◍', l: 'Chat tim Rapih', sub: 'Online · respons < 5 menit', tail: 'Online' },
  { id: 'wa', e: '✉', l: 'WhatsApp', sub: '+62 811-1700-1700', tail: '08:00–22:00' },
  { id: 'mail', e: '@', l: 'Email', sub: 'halo@rapih.id', tail: '< 24 jam' },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="label"
      color={palette.inkMute}
      style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

export function BantuanScreen() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

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
          Pusat bantuan
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* title */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
        <Text
          variant="figureS"
          style={{ fontSize: 26, letterSpacing: -1, lineHeight: 30 }}>
          Ada yang bisa kami bantu?
        </Text>
      </View>

      {/* search */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          boxShadow: shadow.ring,
        }}>
        <Icon name="search" size={16} color={palette.inkMute} />
        <Text variant="bodySm" color={palette.inkMute} style={{ flex: 1, fontSize: 13 }}>
          Cari topik, mis. "ubah PIN"…
        </Text>
      </View>

      {/* category grid */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => haptics.tap()}
            style={{
              width: '48.5%',
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderRadius: 18,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              boxShadow: shadow.ring,
            }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: c.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text color={palette.moss} style={{ fontSize: 14, fontWeight: '700' }}>
                {c.e}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '700' }}>
                {c.l}
              </Text>
              <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 10.5, marginTop: 1 }}>
                {c.sub}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* FAQ */}
      <View style={{ marginHorizontal: 18, marginTop: 22 }}>
        <SectionLabel>Pertanyaan populer</SectionLabel>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {FAQS.map((f, i) => {
            const open = openIdx === i;
            return (
              <Pressable
                key={f.q}
                onPress={() => {
                  haptics.tap();
                  setOpenIdx(open ? null : i);
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderBottomWidth: i < FAQS.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <Text
                    variant="bodySm"
                    style={{ flex: 1, fontSize: 14, fontWeight: '600', letterSpacing: -0.2, lineHeight: 20 }}>
                    {f.q}
                  </Text>
                  <Text
                    color={palette.inkMute}
                    style={{ fontSize: 14, fontWeight: '700', marginTop: 1 }}>
                    {open ? '−' : '+'}
                  </Text>
                </View>
                {open && (
                  <Text
                    variant="bodySm"
                    color={palette.inkSoft}
                    style={{ fontSize: 12.5, lineHeight: 19, marginTop: 8 }}>
                    {f.a}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* contact */}
      <View style={{ marginHorizontal: 18, marginTop: 22 }}>
        <SectionLabel>Hubungi tim Rapih</SectionLabel>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {CONTACT.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => haptics.tap()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: i < CONTACT.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: palette.lime,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text color={palette.moss} style={{ fontSize: 14, fontWeight: '700' }}>
                  {c.e}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" style={{ fontSize: 14, fontWeight: '600' }}>
                  {c.l}
                </Text>
                <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 2 }}>
                  {c.sub}
                </Text>
              </View>
              <Text variant="bodySm" color={palette.cool} style={{ fontSize: 11, fontWeight: '700' }}>
                {c.tail}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* status */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: palette.limeSoft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 8,
            backgroundColor: palette.cool,
          }}
        />
        <Text variant="bodySm" color={palette.moss} style={{ flex: 1, fontSize: 12, fontWeight: '600' }}>
          Semua sistem normal
        </Text>
        <Text variant="bodySm" color={palette.moss} style={{ fontSize: 11, opacity: 0.7 }}>
          status.rapih.id
        </Text>
      </View>
    </Screen>
  );
}
