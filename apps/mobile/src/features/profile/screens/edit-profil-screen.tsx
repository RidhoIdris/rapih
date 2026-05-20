import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { fontFamily, palette, shadow } from '@/theme';
import { BackButton, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { Monogram } from '@/components/brand';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Swatch = { id: string; bg: string; fg: string; label: string };

const SWATCHES: Swatch[] = [
  { id: 'moss', bg: palette.moss, fg: palette.lime, label: 'Moss' },
  { id: 'lime', bg: palette.lime, fg: palette.moss, label: 'Lime' },
  { id: 'sand', bg: palette.sand, fg: palette.moss, label: 'Sand' },
  { id: 'coral', bg: palette.coral, fg: palette.moss, label: 'Coral' },
  { id: 'iris', bg: '#bfb9e6', fg: palette.moss, label: 'Iris' },
  { id: 'amber', bg: '#fef0bb', fg: palette.moss, label: 'Amber' },
];

type FormRow = {
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  keyboard?: 'default' | 'email-address' | 'phone-pad';
  hint?: string;
};

const INITIAL_FORM: FormRow[] = [
  { key: 'nick', label: 'NAMA TAMPILAN', value: 'Adelia R.', placeholder: 'Nama panggilan' },
  { key: 'full', label: 'NAMA LENGKAP', value: 'Adelia Rahmadhani', placeholder: 'Sesuai KTP' },
  {
    key: 'email',
    label: 'EMAIL',
    value: 'adelia.r@gmail.com',
    placeholder: 'kamu@email.com',
    keyboard: 'email-address',
    hint: 'Dipakai untuk login dan kode verifikasi.',
  },
  {
    key: 'phone',
    label: 'NOMOR HP',
    value: '+62 812-3456-7890',
    placeholder: '+62 ...',
    keyboard: 'phone-pad',
  },
  { key: 'bio', label: 'BIO SINGKAT', value: 'Belajar nabung, satu kopi setiap pagi.', placeholder: '— opsional —' },
];

export function EditProfilScreen() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_FORM);
  const [swatch, setSwatch] = useState<string>('moss');
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const update = (key: string, val: string) =>
    setForm((prev) => prev.map((r) => (r.key === key ? { ...r, value: val } : r)));

  const active = SWATCHES.find((s) => s.id === swatch) ?? SWATCHES[0];
  const initials = (form[0].value || 'AD')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'AD';

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
          Edit profil
        </Text>
        <Pressable
          onPress={() => {
            haptics.success();
            router.back();
          }}
          hitSlop={8}>
          <Text variant="bodySm" color={palette.cool} style={{ fontSize: 13, fontWeight: '700' }}>
            Simpan
          </Text>
        </Pressable>
      </View>

      {/* avatar hero */}
      <View
        style={{
          alignItems: 'center',
          paddingTop: 28,
          paddingBottom: 6,
        }}>
        <View style={{ position: 'relative' }}>
          <Monogram initials={initials} bg={active.bg} fg={active.fg} size={92} />
          <Pressable
            onPress={() => haptics.tap()}
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 32,
              height: 32,
              borderRadius: 32,
              backgroundColor: palette.moss,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: shadow.lift,
            }}>
            <Text color={ONDARK} style={{ fontSize: 13, fontWeight: '700' }}>
              ✎
            </Text>
          </Pressable>
        </View>
        <Text
          variant="bodySm"
          color={palette.inkMute}
          style={{ fontSize: 11.5, marginTop: 12, letterSpacing: 0.2 }}>
          Ketuk untuk unggah foto · atau pilih warna di bawah
        </Text>
      </View>

      {/* swatch picker */}
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          paddingHorizontal: 22,
          paddingTop: 14,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
        {SWATCHES.map((s) => {
          const sel = s.id === swatch;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                haptics.select();
                setSwatch(s.id);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 36,
                backgroundColor: s.bg,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: sel ? `0 0 0 2px ${palette.bg}, 0 0 0 4px ${palette.moss}` : shadow.ring,
              }}>
              {sel && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 10,
                    backgroundColor: s.fg,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* form */}
      <View style={{ marginHorizontal: 18, marginTop: 22 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Data pribadi
        </Text>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
            paddingHorizontal: 4,
          }}>
          {form.map((r, i) => {
            const focused = focusKey === r.key;
            return (
              <View
                key={r.key}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderBottomWidth: i < form.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <Text
                  variant="label"
                  color={focused ? palette.moss : palette.inkMute}
                  style={{ fontSize: 10, letterSpacing: 1.2, fontWeight: '700' }}>
                  {r.label}
                </Text>
                <TextInput
                  value={r.value}
                  placeholder={r.placeholder}
                  placeholderTextColor={palette.inkMute}
                  keyboardType={r.keyboard ?? 'default'}
                  onFocus={() => setFocusKey(r.key)}
                  onBlur={() => setFocusKey(null)}
                  onChangeText={(t) => update(r.key, t)}
                  style={{
                    fontFamily: fontFamily.sans500,
                    fontSize: 15,
                    color: palette.ink,
                    marginTop: 4,
                    padding: 0,
                    letterSpacing: -0.2,
                  }}
                />
                {r.hint && (
                  <Text
                    variant="bodySm"
                    color={palette.inkMute}
                    style={{ fontSize: 10.5, marginTop: 4 }}>
                    {r.hint}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* connected accounts */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Akun tertaut
        </Text>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {[
            { e: 'G', l: 'Google', sub: 'adelia.r@gmail.com', linked: true },
            { e: '', l: 'Apple ID', sub: 'Belum tersambung', linked: false },
          ].map((a, i, arr) => (
            <Pressable
              key={a.l}
              onPress={() => haptics.tap()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 32,
                  backgroundColor: palette.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: shadow.ring,
                }}>
                <Text style={{ fontSize: 14, fontWeight: '700' }}>{a.e}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" style={{ fontSize: 14, fontWeight: '600' }}>
                  {a.l}
                </Text>
                <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 2 }}>
                  {a.sub}
                </Text>
              </View>
              <Text
                variant="bodySm"
                color={a.linked ? palette.cool : palette.moss}
                style={{ fontSize: 12, fontWeight: '700' }}>
                {a.linked ? 'Tersambung' : 'Sambungkan'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* danger zone */}
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
              backgroundColor: '#fde0d4',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text color={palette.coral} style={{ fontSize: 13, fontWeight: '700' }}>
              ⚠
            </Text>
          </View>
          <Text
            variant="bodySm"
            color={palette.coral}
            style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>
            Hapus akun
          </Text>
          <Icon name="chevronR" size={12} color={palette.coral} />
        </Pressable>
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* primary CTA */}
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
          <Text variant="button" color={ONDARK} style={{ fontSize: 15 }}>
            Simpan perubahan
          </Text>
          <Icon name="check" size={14} color={ONDARK} />
        </Pressable>
      </View>
    </Screen>
  );
}
