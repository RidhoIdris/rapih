import type { WalletKind } from '@rapih/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Screen, Text } from '@/components/ui';
import { useWalletStore } from '@/features/wallet/wallet-store';
import { haptics } from '@/lib/haptics';
import { palette } from '@/theme';

const ONDARK = palette.onDark;

function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}

const VALID_KINDS: WalletKind[] = ['bank', 'ewallet', 'cash', 'investment', 'other'];

function asKind(value: unknown): WalletKind {
  if (typeof value === 'string' && VALID_KINDS.includes(value as WalletKind)) {
    return value as WalletKind;
  }
  return 'other';
}

export function TambahDompetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string;
    provider_name?: string;
    sub?: string;
    brand_color?: string;
  }>();

  const kind = asKind(params.kind);
  const initialProviderName = params.provider_name ?? 'Lainnya';
  const subtitleHint = params.sub ?? '';

  const [name, setName] = useState(initialProviderName);
  const [label, setLabel] = useState('');
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const balance = parseDigits(raw);

  const create = useWalletStore((s) => s.create);

  const onSave = async () => {
    if (busy) return;
    if (!name.trim()) {
      Alert.alert('Nama dompet wajib diisi');
      return;
    }
    setBusy(true);
    try {
      await create({
        kind,
        provider_name: name.trim(),
        label: label.trim() || null,
        initial_balance: String(balance),
      });
      haptics.success();
      router.back();
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan dompet.';
      Alert.alert('Gagal', message);
    } finally {
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
          <Icon name="chevronLeft" size={14} color={palette.ink} />
        </Pressable>
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Tambah Dompet
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* hero */}
      <View style={{ paddingHorizontal: 22, marginTop: 16 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700' }}>
          Langkah 2 dari 2
        </Text>
        <Text
          variant="displayS"
          style={{ fontSize: 30, letterSpacing: -1.2, lineHeight: 32, marginTop: 6 }}>
          Saldo awal{'\n'}di sini.
        </Text>
        <Text
          variant="body"
          color={palette.inkSoft}
          style={{ fontSize: 12.5, lineHeight: 19, marginTop: 8 }}>
          Catat saldo kamu sekarang. Setelah ini, semua transaksi yang kamu catat yang
          ngeupdate angka ini.
        </Text>
      </View>

      {/* name field */}
      <View style={{ paddingHorizontal: 18, marginTop: 22 }}>
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
          Nama dompet
        </Text>
        <View
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
          }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={initialProviderName}
            placeholderTextColor={palette.inkMute}
            maxLength={60}
            style={{
              fontSize: 15,
              fontWeight: '500',
              letterSpacing: -0.2,
              color: palette.ink,
              padding: 0,
            }}
          />
        </View>
        {subtitleHint ? (
          <Text
            variant="bodySm"
            color={palette.inkMute}
            style={{ fontSize: 11, marginTop: 6, paddingHorizontal: 4 }}>
            {subtitleHint}
          </Text>
        ) : null}
      </View>

      {/* label field (optional) */}
      <View style={{ paddingHorizontal: 18, marginTop: 16 }}>
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
          Label (opsional)
        </Text>
        <View
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
          }}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={'mis. "Tahapan ····432"'}
            placeholderTextColor={palette.inkMute}
            maxLength={60}
            style={{
              fontSize: 15,
              fontWeight: '500',
              letterSpacing: -0.2,
              color: palette.ink,
              padding: 0,
            }}
          />
        </View>
      </View>

      {/* balance field */}
      <View style={{ paddingHorizontal: 18, marginTop: 16 }}>
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
          Saldo saat ini
        </Text>
        <View
          style={{
            paddingVertical: 18,
            paddingHorizontal: 18,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 6,
            boxShadow:
              balance > 0 ? `0 0 0 1.5px ${palette.moss}` : `0 0 0 1px ${palette.inkFaint}`,
          }}>
          <Text variant="figureL" color={palette.inkMute} style={{ fontSize: 26, letterSpacing: -0.8 }}>
            Rp
          </Text>
          <TextInput
            value={raw ? balance.toLocaleString('id-ID') : ''}
            onChangeText={setRaw}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={palette.inkFaint}
            style={{
              flex: 1,
              fontFamily: 'Bricolage-500',
              fontSize: 30,
              letterSpacing: -1,
              color: palette.ink,
              padding: 0,
            }}
          />
        </View>
      </View>

      {/* AI hint */}
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
        <Icon name="sparkle" size={14} color={palette.moss} />
        <Text
          variant="bodySm"
          color={palette.moss}
          style={{ flex: 1, fontSize: 11.5, lineHeight: 17 }}>
          Saldo ini titik nol. Kalau nanti ada selisih sama bank, pakai{' '}
          <Text variant="bodySm" color={palette.moss} style={{ fontSize: 11.5, fontWeight: '800' }}>
            Sesuaikan saldo
          </Text>
          .
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
            {busy ? 'Menyimpan…' : 'Simpan dompet'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
