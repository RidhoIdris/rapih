import DateTimePicker from '@react-native-community/datetimepicker';
import type { CreateRecurringBody, RecurringPeriod, WalletDto } from '@rapih/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Screen, Text } from '@/components/ui';
import { fmtDate, projectedPayoffISO } from '@/features/recurring/display';
import { useRecurringStore } from '@/features/recurring/recurring-store';
import { useCategoryStore } from '@/features/category/category-store';
import { useWalletStore } from '@/features/wallet/wallet-store';
import { haptics } from '@/lib/haptics';
import { palette } from '@/theme';

const ONDARK = palette.onDark;

type Kind = 'expense' | 'income';
const COLOR_BY_KIND: Record<Kind, string> = { expense: '#0060af', income: '#1a7d4a' };

const EMOJIS = [
  '🏠', '🚗', '📺', '🎙️', '💡', '📡', '🛡️', '🏥', '💳', '🎓',
  '🏋️', '☁️', '🍔', '🛒', '💰', '🎁', '📱', '✈️', '👨‍👩‍👧', '💧',
];

const FREQS: { l: string; period: RecurringPeriod }[] = [
  { l: 'Bulanan', period: 'monthly' },
  { l: 'Mingguan', period: 'weekly' },
  { l: 'Tahunan', period: 'yearly' },
];

function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}

export function TambahRutinScreen() {
  const router = useRouter();
  const create = useRecurringStore((s) => s.create);
  const wallets = useWalletStore((s) => s.wallets);
  const fetchWallets = useWalletStore((s) => s.fetch);
  const categoryItems = useCategoryStore((s) => s.items);
  const fetchCategories = useCategoryStore((s) => s.fetch);

  const [kind, setKind] = useState<Kind>('expense');
  const [raw, setRaw] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [freqIdx, setFreqIdx] = useState(0);
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [isCicilan, setIsCicilan] = useState(false);
  const [tenorRaw, setTenorRaw] = useState('');
  const [paidRaw, setPaidRaw] = useState('');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = parseDigits(raw);
  const tenor = parseDigits(tenorRaw);
  const paid = parseDigits(paidRaw);
  const period = FREQS[freqIdx].period;
  const cicilanOn = kind === 'expense' && isCicilan;

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    if (wallets.length === 0) void fetchWallets();
    if (categoryItems.length === 0) void fetchCategories();
  }, []);

  useEffect(() => {
    if (!walletId && wallets.length > 0) setWalletId(wallets[0].id);
  }, [wallets, walletId]);

  const categories = useMemo(
    () => categoryItems.filter((c) => c.kind === kind),
    [categoryItems, kind],
  );

  // Live cicilan preview
  const preview = useMemo(() => {
    if (!cicilanOn || tenor <= 0) return null;
    const payoff = projectedPayoffISO({
      total_occurrences: tenor,
      occurrences_paid: paid,
      next_due_date: dueDate.toISOString(),
      period,
    } as never);
    return {
      current: Math.min(paid + 1, tenor),
      remaining: Math.max(0, tenor - paid),
      payoff: payoff ? fmtDate(payoff) : null,
    };
  }, [cicilanOn, tenor, paid, dueDate, period]);

  const onSave = async () => {
    if (busy) return;
    if (!name.trim()) return Alert.alert('Nama tagihan wajib diisi');
    if (amount <= 0) return Alert.alert('Nominal belum diisi');
    if (!walletId) return Alert.alert('Pilih dompet', kind === 'income' ? 'Masuk ke dompet mana?' : 'Dibayar dari dompet mana?');
    if (cicilanOn) {
      if (tenor <= 0) return Alert.alert('Total angsuran belum diisi');
      if (paid > tenor) return Alert.alert('Sudah dibayar melebihi total', 'Periksa lagi jumlahnya.');
    }

    const body: CreateRecurringBody = {
      name: name.trim(),
      icon: emoji,
      color: COLOR_BY_KIND[kind],
      kind,
      wallet_id: walletId,
      amount: String(amount),
      period,
      next_due_date: dueDate.toISOString(),
      ...(cicilanOn ? { total_occurrences: tenor, occurrences_paid: paid } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
    };
    setBusy(true);
    try {
      await create(body);
      haptics.success();
      router.back();
    } catch (err) {
      Alert.alert('Gagal', err instanceof Error ? err.message : 'Gagal menyimpan tagihan.');
      setBusy(false);
    }
  };

  return (
    <Screen background={palette.bg} bottomInset={28}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 }}>
        <Pressable
          onPress={() => { haptics.tap(); router.back(); }}
          style={{ width: 38, height: 38, borderRadius: 38, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={12} color={palette.ink} />
        </Pressable>
        {/* jenis toggle */}
        <View style={{ flexDirection: 'row', gap: 4, backgroundColor: palette.card, borderRadius: 999, padding: 4 }}>
          {(['expense', 'income'] as const).map((k) => {
            const on = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  haptics.select();
                  setKind(k);
                  setCategoryId(null);
                  if (k === 'income') setIsCicilan(false);
                }}
                style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? palette.moss : 'transparent' }}>
                <Text variant="chip" color={on ? ONDARK : palette.inkSoft} style={{ fontSize: 11.5, fontWeight: '700' }}>
                  {k === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* amount */}
      <View style={{ paddingHorizontal: 28, paddingTop: 40, alignItems: 'center' }}>
        <Text variant="label" color={palette.inkMute} style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>
          Nominal per periode
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
          <Text variant="figureXL" color={palette.inkSoft} style={{ fontSize: 28, marginRight: 6 }}>
            Rp
          </Text>
          <TextInput
            value={raw ? amount.toLocaleString('id-ID') : ''}
            onChangeText={setRaw}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={palette.inkFaint}
            style={{ fontFamily: 'Bricolage-500', fontSize: 52, letterSpacing: -2.4, color: palette.ink, padding: 0, minWidth: 80, textAlign: 'center' }}
          />
        </View>
      </View>

      {/* name + icon */}
      <View style={{ paddingHorizontal: 18, paddingTop: 28 }}>
        <Text variant="label" color={palette.inkMute} style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Nama tagihan
        </Text>
        <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, borderCurve: 'continuous', backgroundColor: palette.card, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${COLOR_BY_KIND[kind]}22`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Text style={{ fontSize: 16 }}>{emoji}</Text>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={kind === 'income' ? 'mis. Gaji bulanan' : 'mis. Netflix / KPR rumah'}
            placeholderTextColor={palette.inkMute}
            maxLength={100}
            style={{ flex: 1, fontSize: 15, fontWeight: '500', letterSpacing: -0.2, color: palette.ink, padding: 0 }}
          />
        </View>
        {/* icon picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
          {EMOJIS.map((e) => {
            const on = e === emoji;
            return (
              <Pressable
                key={e}
                onPress={() => { haptics.select(); setEmoji(e); }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: palette.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: on ? `0 0 0 2px ${palette.moss}` : `0 0 0 1px ${palette.inkFaint}`,
                }}>
                <Text style={{ fontSize: 18 }}>{e}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* frequency */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <Text variant="label" color={palette.inkMute} style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Seberapa sering
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {FREQS.map((f, i) => {
            const on = i === freqIdx;
            return (
              <Pressable
                key={f.l}
                onPress={() => { haptics.select(); setFreqIdx(i); }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: on ? palette.lime : palette.card,
                  alignItems: 'center',
                  boxShadow: on ? undefined : `0 0 0 1px ${palette.inkFaint}`,
                }}>
                <Text variant="bodySm" color={on ? palette.moss : palette.ink} style={{ fontSize: 13, fontWeight: '700' }}>
                  {f.l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* next due date — native picker */}
      <View style={{ marginHorizontal: 18, marginTop: 16 }}>
        <Text variant="label" color={palette.inkMute} style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Jatuh tempo berikutnya
        </Text>
        <View
          style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 18, borderCurve: 'continuous', backgroundColor: palette.card, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 }}>
          <Text style={{ fontSize: 16 }}>📅</Text>
          {Platform.OS === 'ios' ? (
            <>
              <Text variant="bodySm" color={palette.inkMute} style={{ flex: 1, fontSize: 13, fontWeight: '500' }}>
                Setiap
              </Text>
              <DateTimePicker
                value={dueDate}
                mode="date"
                display="compact"
                minimumDate={new Date()}
                accentColor={palette.moss}
                themeVariant="light"
                onChange={(_, d) => {
                  if (d) setDueDate(d);
                }}
              />
            </>
          ) : (
            <Pressable
              onPress={() => { haptics.tap(); setShowPicker(true); }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="bodySm" style={{ flex: 1, fontSize: 15, fontWeight: '600' }}>
                {fmtDate(dueDate.toISOString())}
              </Text>
              <Icon name="chevronR" size={12} color={palette.inkMute} />
            </Pressable>
          )}
        </View>
        {Platform.OS === 'android' && showPicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(_, d) => {
              setShowPicker(false);
              if (d) setDueDate(d);
            }}
          />
        )}
      </View>

      {/* cicilan toggle — expense only */}
      {kind === 'expense' && (
        <View style={{ marginHorizontal: 18, marginTop: 16 }}>
          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 18,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodySm" style={{ fontSize: 14, fontWeight: '600' }}>
                Cicilan (ada tenornya)
              </Text>
              <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
                KPR, cicilan kendaraan, paylater
              </Text>
            </View>
            <Switch
              value={isCicilan}
              onValueChange={(v) => { haptics.select(); setIsCicilan(v); }}
              trackColor={{ true: palette.moss, false: palette.sandDeep }}
              thumbColor="#fff"
            />
          </View>

          {isCicilan && (
            <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: palette.card, boxShadow: `0 0 0 1px ${palette.inkFaint}` }}>
                <Text variant="label" color={palette.inkMute} style={{ fontSize: 10, letterSpacing: 0.8, fontWeight: '700' }}>
                  TOTAL ANGSURAN
                </Text>
                <TextInput
                  value={tenorRaw}
                  onChangeText={(t) => setTenorRaw(t.replace(/[^\d]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="60"
                  placeholderTextColor={palette.inkMute}
                  style={{ fontFamily: 'Mono-500', fontSize: 18, fontWeight: '700', color: palette.ink, padding: 0, marginTop: 2 }}
                />
              </View>
              <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: palette.card, boxShadow: `0 0 0 1px ${palette.inkFaint}` }}>
                <Text variant="label" color={palette.inkMute} style={{ fontSize: 10, letterSpacing: 0.8, fontWeight: '700' }}>
                  SUDAH DIBAYAR
                </Text>
                <TextInput
                  value={paidRaw}
                  onChangeText={(t) => setPaidRaw(t.replace(/[^\d]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="31"
                  placeholderTextColor={palette.inkMute}
                  style={{ fontFamily: 'Mono-500', fontSize: 18, fontWeight: '700', color: palette.ink, padding: 0, marginTop: 2 }}
                />
              </View>
            </View>
          )}

          {preview && (
            <View style={{ marginTop: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: palette.limeSoft }}>
              <Text variant="bodySm" color={palette.moss} style={{ fontSize: 12, fontWeight: '700' }}>
                Cicilan ke-{preview.current} dari {tenor} · sisa {preview.remaining} bulan
              </Text>
              {preview.payoff && (
                <Text variant="bodySm" color="rgba(45,71,51,0.7)" style={{ fontSize: 11, marginTop: 2 }}>
                  Lunas sekitar {preview.payoff}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* wallet picker */}
      <View style={{ marginTop: 18 }}>
        <Text variant="label" color={palette.inkMute} style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 22, paddingBottom: 8 }}>
          {kind === 'income' ? 'Masuk ke dompet' : 'Dibayar dari dompet'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 6 }}>
          {wallets.map((w: WalletDto) => {
            const on = walletId === w.id;
            return (
              <Pressable
                key={w.id}
                onPress={() => { haptics.select(); setWalletId(w.id); }}
                style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? palette.moss : palette.card, boxShadow: on ? undefined : `0 0 0 1px ${palette.inkFaint}` }}>
                <Text variant="chip" color={on ? ONDARK : palette.ink} style={{ fontSize: 12.5, fontWeight: '600' }}>
                  {w.provider_name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* category (optional) */}
      {categories.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text variant="label" color={palette.inkMute} style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 22, paddingBottom: 8 }}>
            Kategori (opsional)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 6 }}>
            {categories.map((c) => {
              const on = categoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => { haptics.select(); setCategoryId(on ? null : c.id); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, backgroundColor: on ? palette.moss : palette.card, boxShadow: on ? undefined : `0 0 0 1px ${palette.inkFaint}` }}>
                  <View style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: c.color }} />
                  <Text variant="chip" color={on ? ONDARK : palette.ink} style={{ fontSize: 12, fontWeight: '600' }}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={{ flex: 1, minHeight: 20 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Pressable
          onPress={onSave}
          disabled={busy}
          style={{ height: 54, borderRadius: 27, backgroundColor: palette.moss, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.5 : 1 }}>
          <Icon name="check" size={14} color={ONDARK} />
          <Text variant="button" color={ONDARK} style={{ fontSize: 15 }}>
            {busy ? 'Menyimpan…' : 'Simpan tagihan rutin'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
