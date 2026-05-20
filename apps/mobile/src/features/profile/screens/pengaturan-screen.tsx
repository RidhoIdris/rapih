import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { fontFamily, palette } from '@/theme';
import { BackButton, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

type AiPersona = 'Santai' | 'Formal' | 'Tegas';

const AI_PERSONAS: { l: AiPersona; e: string }[] = [
  { l: 'Santai', e: '✌️' },
  { l: 'Formal', e: '🗒️' },
  { l: 'Tegas', e: '⚡' },
];

const PERSONA_QUOTES: Record<AiPersona, string> = {
  Santai: '"Eh, hari ini kopinya udah ke-3 lho. Mau aku rem dulu?"',
  Formal: '"Tercatat kopi ke-3 hari ini. Apakah ingin saya batasi?"',
  Tegas: '"Stop. Kopi ke-3 hari ini. Kurangi sekarang."',
};

type ToggleRow = { l: string; sub: string };

const NOTIF_ROWS: ToggleRow[] = [
  { l: 'Insight harian', sub: 'Setiap pagi jam 7:00' },
  { l: 'Anggaran tercapai', sub: 'Saat budget hampir penuh' },
  { l: 'Pengeluaran besar', sub: 'Di atas Rp 500rb' },
  { l: 'Rangkuman mingguan', sub: 'Minggu malam jam 19:00' },
  { l: 'Pengingat kebiasaan', sub: 'Sesuai jadwal kebiasaan' },
];
const NOTIF_DEFAULT: boolean[] = [true, true, true, false, true];

const SELECT_ROWS: [string, string][] = [
  ['Tema', 'Otomatis · ikuti sistem'],
  ['Mata uang', 'Rupiah (Rp)'],
  ['Bahasa', 'Bahasa Indonesia'],
  ['Awal minggu', 'Senin'],
];

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      style={{
        width: 40,
        height: 24,
        borderRadius: 24,
        backgroundColor: on ? palette.moss : palette.sandDeep,
        flexShrink: 0,
        justifyContent: 'center',
      }}>
      <View
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 20,
          height: 20,
          borderRadius: 20,
          backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(28,36,24,0.18)',
        }}
      />
    </Pressable>
  );
}

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

export function PengaturanScreen() {
  const [persona, setPersona] = useState<AiPersona>('Santai');
  const [notif, setNotif] = useState<boolean[]>(NOTIF_DEFAULT);

  const toggleNotif = (i: number) =>
    setNotif((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

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
          Pengaturan
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* AI persona */}
      <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
        <SectionLabel>Gaya Rapih AI</SectionLabel>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
            padding: 16,
          }}>
          <Text
            variant="bodySm"
            color={palette.inkSoft}
            style={{ fontSize: 13, lineHeight: 20, marginBottom: 14 }}>
            Pilih gaya bahasa AI saat memberi saran & mengingatkan kamu.
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {AI_PERSONAS.map((m) => {
              const active = m.l === persona;
              return (
                <Pressable
                  key={m.l}
                  onPress={() => {
                    haptics.select();
                    setPersona(m.l);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    backgroundColor: active ? palette.lime : palette.bg,
                    alignItems: 'center',
                    boxShadow: active ? undefined : `0 0 0 1px ${palette.inkFaint}`,
                  }}>
                  <Text style={{ fontSize: 18 }}>{m.e}</Text>
                  <Text
                    variant="bodySm"
                    color={active ? palette.moss : palette.ink}
                    style={{ fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                    {m.l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View
            style={{
              marginTop: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: palette.bg,
            }}>
            <Text
              color={palette.ink}
              style={{
                fontFamily: fontFamily.sansItalic500,
                fontSize: 14,
                lineHeight: 20,
              }}>
              {PERSONA_QUOTES[persona]}
            </Text>
          </View>
        </View>
      </View>

      {/* notification toggles */}
      <View style={{ marginHorizontal: 22, marginTop: 20 }}>
        <SectionLabel>Notifikasi</SectionLabel>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {NOTIF_ROWS.map((r, i) => (
            <View
              key={r.l}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: i < NOTIF_ROWS.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <View style={{ flex: 1 }}>
                <Text
                  variant="bodySm"
                  style={{ fontSize: 14, fontWeight: '500', letterSpacing: -0.2 }}>
                  {r.l}
                </Text>
                <Text
                  variant="bodySm"
                  color={palette.inkMute}
                  style={{ fontSize: 11, marginTop: 2 }}>
                  {r.sub}
                </Text>
              </View>
              <Toggle on={notif[i]} onPress={() => toggleNotif(i)} />
            </View>
          ))}
        </View>
      </View>

      {/* selects */}
      <View style={{ marginHorizontal: 22, marginTop: 20 }}>
        <SectionLabel>Tampilan & bahasa</SectionLabel>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {SELECT_ROWS.map(([l, v], i) => (
            <Pressable
              key={l}
              onPress={() => haptics.tap()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: i < SELECT_ROWS.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <Text
                variant="bodySm"
                style={{ flex: 1, fontSize: 14, fontWeight: '500' }}>
                {l}
              </Text>
              <Text
                variant="bodySm"
                color={palette.inkMute}
                style={{ fontSize: 12, marginRight: 8 }}>
                {v}
              </Text>
              <Icon name="chevronR" size={12} color={palette.inkMute} />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
