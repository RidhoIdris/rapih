import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { palette, tint } from '@/theme';
import { BackButton, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

type ToggleRow = {
  key: string;
  l: string;
  sub: string;
};

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

const TOGGLE_ROWS: ToggleRow[] = [
  { key: 'pin', l: 'Kunci aplikasi dengan PIN', sub: '6 digit · diminta saat buka' },
  { key: 'bio', l: 'Buka pakai biometrik', sub: 'Face ID · Fingerprint' },
  { key: 'masking', l: 'Sembunyikan saldo di pratinjau', sub: 'Saldo jadi •••• di app switcher' },
  { key: 'autolock', l: 'Kunci otomatis', sub: 'Setelah 1 menit tidak aktif' },
];

const ACTIVE_DEVICES = [
  { d: 'iPhone 15 · Adelia', loc: 'Jakarta · sekarang', current: true },
  { d: 'MacBook Air · Safari', loc: 'Jakarta · 2 jam lalu' },
  { d: 'iPad mini', loc: 'Bandung · kemarin' },
];

export function KeamananScreen() {
  const [tog, setTog] = useState<Record<string, boolean>>({
    pin: true,
    bio: true,
    masking: true,
    autolock: false,
  });
  const [backup, setBackup] = useState<'harian' | 'mingguan' | 'mati'>('harian');

  const toggle = (k: string) => setTog((p) => ({ ...p, [k]: !p[k] }));

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
          Keamanan
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* status hero */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 22,
          paddingVertical: 18,
          paddingHorizontal: 18,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: palette.lime,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: palette.moss,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text color={palette.lime} style={{ fontSize: 20, fontWeight: '700' }}>
            ⏚
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodySm" color={palette.moss} style={{ fontSize: 14, fontWeight: '700' }}>
            Akun kamu aman
          </Text>
          <Text
            variant="bodySm"
            color="rgba(28,36,24,0.65)"
            style={{ fontSize: 11.5, marginTop: 3, lineHeight: 16 }}>
            PIN aktif · biometrik aktif · cadangan harian
          </Text>
        </View>
      </View>

      {/* toggles */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <SectionLabel>Penguncian</SectionLabel>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {TOGGLE_ROWS.map((r, i) => (
            <View
              key={r.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: i < TOGGLE_ROWS.length - 1 ? 1 : 0,
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
              <Toggle on={tog[r.key]} onPress={() => toggle(r.key)} />
            </View>
          ))}
        </View>
      </View>

      {/* PIN actions */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <SectionLabel>PIN aplikasi</SectionLabel>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {[
            { l: 'Ubah PIN', sub: 'Terakhir diganti 12 hari lalu' },
            { l: 'Atur ulang PIN via email', sub: 'adelia.r@gmail.com' },
          ].map((row, i, arr) => (
            <Pressable
              key={row.l}
              onPress={() => haptics.tap()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <View style={{ flex: 1 }}>
                <Text
                  variant="bodySm"
                  style={{ fontSize: 14, fontWeight: '500', letterSpacing: -0.2 }}>
                  {row.l}
                </Text>
                <Text
                  variant="bodySm"
                  color={palette.inkMute}
                  style={{ fontSize: 11, marginTop: 2 }}>
                  {row.sub}
                </Text>
              </View>
              <Icon name="chevronR" size={12} color={palette.inkMute} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* backup frequency */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <SectionLabel>Cadangan otomatis</SectionLabel>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
            padding: 14,
          }}>
          <Text
            variant="bodySm"
            color={palette.inkSoft}
            style={{ fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
            Data terenkripsi dan disimpan ke iCloud / Google Drive sesuai perangkatmu.
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['harian', 'mingguan', 'mati'] as const).map((k) => {
              const sel = backup === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    haptics.select();
                    setBackup(k);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    backgroundColor: sel ? palette.moss : palette.bg,
                    alignItems: 'center',
                    boxShadow: sel ? undefined : `0 0 0 1px ${palette.inkFaint}`,
                  }}>
                  <Text
                    variant="bodySm"
                    color={sel ? palette.onDark : palette.ink}
                    style={{ fontSize: 12.5, fontWeight: '700', textTransform: 'capitalize' }}>
                    {k === 'mati' ? 'Mati' : k}
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
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 8,
                backgroundColor: backup === 'mati' ? palette.coral : palette.cool,
              }}
            />
            <Text variant="bodySm" color={palette.inkSoft} style={{ flex: 1, fontSize: 11.5 }}>
              {backup === 'mati'
                ? 'Cadangan dimatikan. Risiko data hilang jika ganti HP.'
                : `Cadangan terakhir berhasil · 14 jam lalu · 2,4 MB`}
            </Text>
          </View>
        </View>
      </View>

      {/* active devices */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <SectionLabel>Perangkat aktif</SectionLabel>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {ACTIVE_DEVICES.map((d, i) => (
            <View
              key={d.d}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: i < ACTIVE_DEVICES.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  borderCurve: 'continuous',
                  backgroundColor: d.current ? palette.limeSoft : palette.sand,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text color={palette.moss} style={{ fontSize: 13, fontWeight: '700' }}>
                  ▭
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '600' }}>
                  {d.d}
                </Text>
                <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 2 }}>
                  {d.loc}
                </Text>
              </View>
              {d.current ? (
                <Text variant="bodySm" color={palette.cool} style={{ fontSize: 11, fontWeight: '700' }}>
                  ini
                </Text>
              ) : (
                <Pressable onPress={() => haptics.tap()} hitSlop={6}>
                  <Text
                    variant="bodySm"
                    color={palette.coral}
                    style={{ fontSize: 11, fontWeight: '700' }}>
                    Keluar
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* sign out everywhere */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <Pressable
          onPress={() => haptics.tap()}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
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
              backgroundColor: tint.peach,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text color={palette.coral} style={{ fontSize: 13, fontWeight: '700' }}>
              ⎋
            </Text>
          </View>
          <Text
            variant="bodySm"
            color={palette.coral}
            style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>
            Keluar dari semua perangkat
          </Text>
          <Icon name="chevronR" size={12} color={palette.coral} />
        </Pressable>
      </View>
    </Screen>
  );
}
