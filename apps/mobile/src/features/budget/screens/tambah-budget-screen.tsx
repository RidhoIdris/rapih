import type { CreateBudgetBody } from '@rapih/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Screen, Text } from '@/components/ui';
import { useBudgetStore } from '@/features/budget/budget-store';
import { useCategoryStore } from '@/features/category/category-store';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette, tint } from '@/theme';

const ONDARK = palette.onDark;

type Preset = { l: string; emoji: string; tile: string; color: string };

const PRESETS: Preset[] = [
  { l: 'Kebutuhan', emoji: '🏡', tile: tint.mint, color: tint.mintInk },
  { l: 'Senang-Senang', emoji: '🎉', tile: tint.amber, color: tint.amberInk },
  { l: 'Transport', emoji: '🛵', tile: tint.peach, color: tint.peachInk },
  { l: 'Kopi & jajan', emoji: '☕', tile: palette.limeSoft, color: palette.moss },
  { l: 'Hadiah', emoji: '🎁', tile: tint.rose, color: tint.roseInk },
  { l: 'Lainnya', emoji: '✨', tile: tint.iris, color: tint.irisInk },
];

const SAMPLE_CAPS = [
  { l: 'Rp 500rb', v: 500_000 },
  { l: 'Rp 1jt', v: 1_000_000 },
  { l: 'Rp 2,5jt', v: 2_500_000 },
  { l: 'Rp 5jt', v: 5_000_000 },
];

function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}

export function TambahBudgetScreen() {
  const router = useRouter();
  const create = useBudgetStore((s) => s.create);
  const categoryItems = useCategoryStore((s) => s.items);
  const fetchCategories = useCategoryStore((s) => s.fetch);

  const [presetIdx, setPresetIdx] = useState(1);
  const [name, setName] = useState(PRESETS[1].l);
  const [capIdx, setCapIdx] = useState<number | null>(1);
  const [customRaw, setCustomRaw] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const sel = PRESETS[presetIdx];
  const customVal = parseDigits(customRaw);
  const cap = capIdx !== null ? SAMPLE_CAPS[capIdx].v : customVal;

  const expenseCategories = categoryItems.filter((c) => c.kind === 'expense');

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    if (categoryItems.length === 0) void fetchCategories();
  }, []);

  const toggleCategory = (cid: string) => {
    haptics.select();
    setCategoryIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid],
    );
  };

  const onSave = async () => {
    if (busy) return;
    if (!name.trim()) {
      Alert.alert('Nama budget wajib diisi');
      return;
    }
    if (cap <= 0) {
      Alert.alert('Plafon belum diisi', 'Tentukan plafon bulanan dulu.');
      return;
    }
    const body: CreateBudgetBody = {
      name: name.trim(),
      icon: sel.emoji,
      color: sel.color,
      amount: String(cap),
      category_ids: categoryIds,
    };
    setBusy(true);
    try {
      await create(body);
      haptics.success();
      router.back();
    } catch (err) {
      Alert.alert('Gagal', err instanceof Error ? err.message : 'Gagal menyimpan budget.');
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
          Budget Baru
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* preview hero — live budget row */}
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
        <Text variant="eyebrow" color={palette.inkMute} style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
          Pratinjau
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
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
            <Text style={{ fontSize: 20, lineHeight: 26 }}>{sel.emoji}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="bodySm"
              numberOfLines={1}
              style={{ fontSize: 14, fontWeight: '600', letterSpacing: -0.2 }}>
              {name.trim() || sel.l}
            </Text>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 2 }}>
              Plafon {cap > 0 ? rupiah(cap, { short: true }) : '—'} ·{' '}
              {categoryIds.length === 0 ? 'semua pengeluaran' : `${categoryIds.length} kategori`}
            </Text>
          </View>
        </View>
      </View>

      {/* name */}
      <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Nama budget
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
          <Text style={{ fontSize: 16, marginRight: 10, lineHeight: 22 }}>{sel.emoji}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={sel.l}
            placeholderTextColor={palette.inkMute}
            maxLength={80}
            style={{ flex: 1, fontSize: 15, fontWeight: '500', letterSpacing: -0.2, color: palette.ink, padding: 0 }}
          />
        </View>
      </View>

      {/* icon preset picker */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Ikon
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p, i) => {
            const on = i === presetIdx;
            return (
              <Pressable
                key={p.l}
                onPress={() => {
                  haptics.select();
                  // Adopt the preset label only if the user hasn't typed a custom name.
                  setName((cur) => (cur === PRESETS[presetIdx].l || cur.trim() === '' ? p.l : cur));
                  setPresetIdx(i);
                }}
                style={{
                  width: '31%',
                  paddingVertical: 14,
                  paddingHorizontal: 8,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  backgroundColor: on ? palette.ink : palette.card,
                  alignItems: 'center',
                  gap: 6,
                }}>
                <Text style={{ fontSize: 22, lineHeight: 28 }}>{p.emoji}</Text>
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
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
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
                  setCustomRaw('');
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
                <Text variant="mono" color={on ? palette.moss : palette.ink} style={{ fontSize: 12, fontWeight: '700' }}>
                  {c.l}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* manual cap input */}
        <View
          style={{
            marginTop: 8,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            boxShadow:
              capIdx === null && customVal > 0
                ? `0 0 0 1.5px ${palette.moss}`
                : `0 0 0 1px ${palette.inkFaint}`,
          }}>
          <Text variant="mono" color={palette.inkMute} style={{ fontSize: 12, fontWeight: '700' }}>
            Rp
          </Text>
          <TextInput
            value={customRaw ? parseDigits(customRaw).toLocaleString('id-ID') : ''}
            onChangeText={(t) => {
              setCustomRaw(t);
              if (t.replace(/[^\d]/g, '').length > 0) setCapIdx(null);
            }}
            onFocus={() => setCapIdx(null)}
            keyboardType="number-pad"
            placeholder="Ketik plafon sendiri"
            placeholderTextColor={palette.inkMute}
            style={{ flex: 1, fontFamily: 'Mono-500', fontSize: 13, color: palette.ink, padding: 0 }}
          />
        </View>
      </View>

      {/* category tracking */}
      <View style={{ marginTop: 18 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 22, paddingBottom: 8 }}>
          Lacak kategori {categoryIds.length > 0 ? `(${categoryIds.length})` : '· semua pengeluaran'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, gap: 6 }}>
          {expenseCategories.map((c) => {
            const on = categoryIds.includes(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => toggleCategory(c.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  paddingVertical: 9,
                  paddingHorizontal: 13,
                  borderRadius: 999,
                  backgroundColor: on ? palette.moss : palette.card,
                  boxShadow: on ? undefined : `0 0 0 1px ${palette.inkFaint}`,
                }}>
                <View style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: c.color }} />
                <Text variant="chip" color={on ? ONDARK : palette.ink} style={{ fontSize: 12, fontWeight: '600' }}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text
          variant="bodySm"
          color={palette.inkMute}
          style={{ fontSize: 11, lineHeight: 16, paddingHorizontal: 22, marginTop: 8 }}>
          Kosongkan untuk melacak semua pengeluaran bulan ini.
        </Text>
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
            {busy ? 'Menyimpan…' : 'Buat budget'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
