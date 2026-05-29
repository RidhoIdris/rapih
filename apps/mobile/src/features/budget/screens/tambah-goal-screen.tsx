import type { CreateGoalBody } from '@rapih/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Glow, Screen, Text } from '@/components/ui';
import { useGoalStore } from '@/features/goal/goal-store';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette, tint } from '@/theme';

const ONDARK = palette.onDark;

type Preset = { e: string; l: string; color: string };
const PRESETS: Preset[] = [
  { e: '🌴', l: 'Liburan', color: palette.cool },
  { e: '🏠', l: 'Rumah', color: palette.moss },
  { e: '💻', l: 'Gadget', color: tint.gold },
  { e: '🎓', l: 'Pendidikan', color: tint.irisInk },
  { e: '💍', l: 'Nikah', color: tint.roseInk },
  { e: '🚗', l: 'Kendaraan', color: tint.peachInk },
  { e: '🕌', l: 'Umroh', color: palette.mossSoft },
  { e: '🎁', l: 'Lainnya', color: tint.amberInk },
];

const DEADLINES: { l: string; m: number | null }[] = [
  { l: '3 bulan', m: 3 },
  { l: '6 bulan', m: 6 },
  { l: '1 tahun', m: 12 },
  { l: 'Tanpa target', m: null },
];

function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}

function monthsFromNow(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export function TambahGoalScreen() {
  const router = useRouter();
  const create = useGoalStore((s) => s.create);

  const [iconIdx, setIconIdx] = useState(0);
  const [name, setName] = useState('');
  const [targetRaw, setTargetRaw] = useState('');
  const [deadlineIdx, setDeadlineIdx] = useState(1);
  const [busy, setBusy] = useState(false);

  const sel = PRESETS[iconIdx];
  const target = parseDigits(targetRaw);
  const deadlineMonths = DEADLINES[deadlineIdx].m;
  const deadlineIso = deadlineMonths === null ? null : monthsFromNow(deadlineMonths);

  const onSave = async () => {
    if (busy) return;
    if (!name.trim()) {
      Alert.alert('Nama goal wajib diisi');
      return;
    }
    if (target <= 0) {
      Alert.alert('Target belum diisi', 'Tentukan target nominal dulu.');
      return;
    }
    const body: CreateGoalBody = {
      name: name.trim(),
      icon: sel.e,
      color: sel.color,
      target_amount: String(target),
      deadline: deadlineIso,
    };
    setBusy(true);
    try {
      await create(body);
      haptics.success();
      router.back();
    } catch (err) {
      Alert.alert('Gagal', err instanceof Error ? err.message : 'Gagal menyimpan goal.');
      setBusy(false);
    }
  };

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
        <Glow size={180} color={palette.lime} opacity={0.22} fadeAt={0.7} position={{ top: -50, right: -50 }} />
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
            <Text style={{ fontSize: 24, lineHeight: 28, includeFontPadding: false }}>{sel.e}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="eyebrow" color={palette.lime} style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
              Pratinjau
            </Text>
            <Text
              variant="figureS"
              color={ONDARK}
              numberOfLines={1}
              style={{ fontSize: 22, letterSpacing: -0.8, lineHeight: 24, marginTop: 2 }}>
              {name.trim() || 'Goal baru'}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text variant="figureL" color={ONDARK} style={{ fontSize: 34, letterSpacing: -1.4, lineHeight: 36 }}>
            {target > 0 ? rupiah(target, { short: true }) : 'Rp —'}
          </Text>
          <Text variant="bodySm" color="rgba(240,240,232,0.65)" style={{ fontSize: 11.5 }}>
            · {deadlineIso ? fmtDate(deadlineIso) : 'tanpa target'}
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
        <View style={{ paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: palette.inkFaint }}>
          <Text variant="label" color={palette.inkMute} style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700' }}>
            Nama goal
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="mis. Liburan Bali"
            placeholderTextColor={palette.inkMute}
            maxLength={80}
            style={{ fontSize: 16, fontWeight: '500', letterSpacing: -0.2, color: palette.ink, padding: 0, marginTop: 6 }}
          />
        </View>

        {/* target nominal */}
        <View style={{ paddingVertical: 14, paddingHorizontal: 18 }}>
          <Text variant="label" color={palette.inkMute} style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700' }}>
            Target nominal
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
            <Text variant="figureM" color={palette.inkMute} style={{ fontSize: 26, marginRight: 4 }}>
              Rp
            </Text>
            <TextInput
              value={targetRaw ? target.toLocaleString('id-ID') : ''}
              onChangeText={setTargetRaw}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={palette.inkFaint}
              style={{ flex: 1, fontFamily: 'Bricolage-500', fontSize: 26, letterSpacing: -0.8, color: palette.ink, padding: 0 }}
            />
          </View>
        </View>
      </View>

      {/* icon picker */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Ikon & kategori
        </Text>
        <View style={{ gap: 8 }}>
          {[0, 4].map((start) => (
            <View key={start} style={{ flexDirection: 'row', gap: 8 }}>
              {PRESETS.slice(start, start + 4).map((p, idx) => {
                const i = start + idx;
                const on = i === iconIdx;
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
                      backgroundColor: on ? palette.ink : palette.card,
                      alignItems: 'center',
                      gap: 6,
                    }}>
                    <Text style={{ fontSize: 22, lineHeight: 28 }}>{p.e}</Text>
                    <Text
                      variant="bodySm"
                      color={on ? ONDARK : palette.ink}
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

      {/* deadline */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Target tanggal
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {DEADLINES.map((d, i) => {
            const on = i === deadlineIdx;
            return (
              <Pressable
                key={d.l}
                onPress={() => {
                  haptics.select();
                  setDeadlineIdx(i);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: on ? palette.lime : palette.card,
                  alignItems: 'center',
                  boxShadow: on ? undefined : `0 0 0 1px ${palette.inkFaint}`,
                }}>
                <Text
                  variant="chip"
                  color={on ? palette.moss : palette.ink}
                  style={{ fontSize: 11.5, fontWeight: '700' }}>
                  {d.l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Pressable
          onPress={onSave}
          disabled={busy}
          style={{
            height: 54,
            borderRadius: 27,
            backgroundColor: palette.moss,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: busy ? 0.5 : 1,
          }}>
          <Icon name="check" size={14} color={ONDARK} />
          <Text variant="button" color={ONDARK} style={{ fontSize: 15 }}>
            {busy ? 'Menyimpan…' : 'Buat goal'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
