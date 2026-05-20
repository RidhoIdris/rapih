import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette } from '@/theme';
import { Caret, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}

export function TambahDompetDetailScreen() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const balance = parseDigits(raw);

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
          Catat saldo kamu sekarang. Setelah ini, semua transaksi yang kamu
          catat yang ngeupdate angka ini.
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
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <Text
            variant="bodySm"
            style={{ flex: 1, fontSize: 15, fontWeight: '500', letterSpacing: -0.2 }}>
            BCA Tahapan
          </Text>
          <Caret height={16} />
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
              balance > 0
                ? `0 0 0 1.5px ${palette.moss}`
                : `0 0 0 1px ${palette.inkFaint}`,
          }}>
          <Text
            variant="figureL"
            color={palette.inkMute}
            style={{ fontSize: 26, letterSpacing: -0.8 }}>
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

      {/* date field */}
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
          Per tanggal
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
          <Text style={{ fontSize: 16, marginRight: 10, lineHeight: 22 }}>📅</Text>
          <Text
            variant="bodySm"
            style={{ flex: 1, fontSize: 14, fontWeight: '500' }}>
            17 Mei 2026 · hari ini
          </Text>
          <Caret height={16} />
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
          onPress={() => {
            haptics.success();
            router.back();
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
          <Icon name="check" size={14} color={ONDARK} />
          <Text variant="button" color={ONDARK} style={{ fontSize: 15 }}>
            Simpan dompet
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
