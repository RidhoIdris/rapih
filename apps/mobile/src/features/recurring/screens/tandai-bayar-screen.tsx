import type { RecurringDto } from '@rapih/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons/icon';
import { Text } from '@/components/ui';
import { getRecurring } from '@/features/recurring/api';
import { useRecurringStore } from '@/features/recurring/recurring-store';
import { daysUntil, fmtDate } from '@/features/recurring/display';
import { useWalletStore } from '@/features/wallet/wallet-store';
import { haptics } from '@/lib/haptics';
import { palette } from '@/theme';

const ONDARK = palette.onDark;

export function TandaiBayarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const fromStore = useRecurringStore((s) => (id ? s.recurring.find((r) => r.id === id) : undefined));
  const pay = useRecurringStore((s) => s.pay);
  const wallets = useWalletStore((s) => s.wallets);
  const fetchWallets = useWalletStore((s) => s.fetch);

  const [fetched, setFetched] = useState<RecurringDto | null>(null);
  const [busy, setBusy] = useState(false);
  const bill = fromStore ?? fetched;

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on id only
  useEffect(() => {
    if (wallets.length === 0) void fetchWallets();
    if (id && !fromStore) {
      getRecurring(id).then(setFetched).catch(() => setFetched(null));
    }
  }, [id]);

  const wallet = useMemo(() => (bill ? wallets.find((w) => w.id === bill.wallet_id) : undefined), [bill, wallets]);

  const close = () => {
    haptics.tap();
    router.back();
  };

  const onConfirm = async () => {
    if (!bill || busy) return;
    setBusy(true);
    try {
      await pay(bill.id);
      haptics.success();
      router.back();
    } catch (err) {
      setBusy(false);
      haptics.tap();
      // surface via re-enabling; keep it simple
      console.warn('pay failed', err);
    }
  };

  const d = bill ? daysUntil(bill.next_due_date) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(28,36,24,0.55)', justifyContent: 'flex-end' }}>
      <StatusBar style="light" />

      {/* tap-to-dismiss area */}
      <Pressable style={{ flex: 1 }} onPress={close} />

      {/* sheet */}
      <View
        style={{
          backgroundColor: palette.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderCurve: 'continuous',
          paddingBottom: insets.bottom + 20,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.18)',
        }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 46, height: 5, borderRadius: 5, backgroundColor: palette.inkFaint }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 8 }}>
            <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
              Tandai Sudah Dibayar
            </Text>
            <Pressable onPress={close} style={{ width: 30, height: 30, borderRadius: 30, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={12} color={palette.ink} />
            </Pressable>
          </View>

          {!bill ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <ActivityIndicator color={palette.moss} />
            </View>
          ) : (
            <>
              {/* notice */}
              <View
                style={{
                  marginHorizontal: 18,
                  marginTop: 14,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: palette.limeSoft,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                }}>
                <Text style={{ fontSize: 14 }}>ℹ️</Text>
                <Text variant="bodySm" color={palette.moss} style={{ flex: 1, fontSize: 11.5, lineHeight: 17 }}>
                  Menandai bayar akan mencatat transaksi di {wallet?.provider_name ?? 'dompet terkait'} dan
                  menjadwalkan ulang tagihan berikutnya.
                </Text>
              </View>

              {/* hero */}
              <View style={{ paddingHorizontal: 28, paddingTop: 18, alignItems: 'center' }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: `${bill.color}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ fontSize: 24 }}>{bill.icon}</Text>
                </View>
                <Text variant="label" color={palette.inkMute} style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: '600', marginTop: 12 }}>
                  {bill.name}
                  {wallet ? ` · ${wallet.provider_name}` : ''}
                </Text>
                <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 10.5, marginTop: 4 }}>
                  {d < 0 ? `Telat ${Math.abs(d)} hari` : `Jatuh tempo ${fmtDate(bill.next_due_date)}`}
                </Text>
              </View>

              {/* amount (read-only — equals the bill) */}
              <View style={{ marginHorizontal: 18, marginTop: 14 }}>
                <Text variant="label" color={palette.inkMute} style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 6 }}>
                  Nominal dibayar
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 6,
                    paddingVertical: 14,
                    paddingHorizontal: 18,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: palette.card,
                    boxShadow: `0 0 0 1.5px ${palette.lime}, 0 4px 18px ${palette.limeSoft}`,
                  }}>
                  <Text variant="figureS" color={palette.inkMute} style={{ fontSize: 22 }}>
                    Rp
                  </Text>
                  <Text variant="figureM" style={{ flex: 1, fontSize: 32, letterSpacing: -1, lineHeight: 34 }}>
                    {Number(bill.amount).toLocaleString('id-ID')}
                  </Text>
                  <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: palette.limeSoft }}>
                    <Text variant="chip" color={palette.moss} style={{ fontSize: 10, fontWeight: '700' }}>
                      = tagihan
                    </Text>
                  </View>
                </View>
              </View>

              {/* CTA */}
              <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
                <Pressable
                  onPress={onConfirm}
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
                    {busy ? 'Menyimpan…' : 'Tandai sudah dibayar'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
