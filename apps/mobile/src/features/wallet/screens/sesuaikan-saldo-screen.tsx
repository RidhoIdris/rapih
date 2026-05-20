import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette } from '@/theme';
import { Caret, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;
const APP_BALANCE = 8_400_000;

function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}

export function SesuaikanSaldoScreen() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const actual = parseDigits(raw);
  const diff = actual - APP_BALANCE;
  const hasInput = raw.length > 0;

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
          Sesuaikan Saldo
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* hero */}
      <View style={{ paddingHorizontal: 22, marginTop: 16 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700' }}>
          Akurasi
        </Text>
        <Text
          variant="displayS"
          style={{ fontSize: 30, letterSpacing: -1.2, lineHeight: 32, marginTop: 6 }}>
          Cocokin saldo{'\n'}ke realita.
        </Text>
        <Text
          variant="body"
          color={palette.inkSoft}
          style={{ fontSize: 12.5, lineHeight: 19, marginTop: 8 }}>
          Kalau angka di Rapih beda sama saldo asli (lupa catat, salah nominal),
          bikin koreksi di sini.
        </Text>
      </View>

      {/* dompet picker */}
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
          Dompet
        </Text>
        <Pressable
          onPress={() => haptics.select()}
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
              width: 36,
              height: 36,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: '#0060af',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text variant="bodySm" color="#fff" style={{ fontSize: 11, fontWeight: '800' }}>
              BC
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodySm" style={{ fontSize: 14, fontWeight: '600', letterSpacing: -0.2 }}>
              BCA Tahapan
            </Text>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
              ····432
            </Text>
          </View>
          <Caret height={16} />
        </Pressable>
      </View>

      {/* current app balance */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 16,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: palette.sand,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <Text
          variant="label"
          color={palette.inkSoft}
          style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700' }}>
          Saldo di Rapih
        </Text>
        <Text variant="figureM" style={{ fontSize: 20, letterSpacing: -0.5 }}>
          {rupiah(APP_BALANCE)}
        </Text>
      </View>

      {/* actual balance input */}
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
          Saldo aktual sekarang
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
            boxShadow: hasInput
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
            value={raw ? actual.toLocaleString('id-ID') : ''}
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

        {/* diff display */}
        {hasInput && diff !== 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              paddingHorizontal: 4,
            }}>
            <Icon
              name={diff > 0 ? 'arrowUp' : 'arrowDn'}
              size={12}
              color={diff > 0 ? palette.cool : palette.coral}
            />
            <Text
              variant="bodySm"
              color={diff > 0 ? palette.cool : palette.coral}
              style={{ fontSize: 12, fontWeight: '700' }}>
              Selisih {rupiah(Math.abs(diff))}
            </Text>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11 }}>
              · {diff > 0 ? 'kurang dicatat' : 'kelebihan tercatat'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* explanation */}
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
          Rapih bikin 1 transaksi koreksi sesuai selisih ini biar saldo cocok.
          Cuma catatan — gak transfer dana asli.
        </Text>
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Pressable
          onPress={() => {
            if (!hasInput) {
              haptics.tap();
              return;
            }
            haptics.success();
            router.back();
          }}
          style={{
            height: 54,
            borderRadius: 27,
            backgroundColor: hasInput ? palette.moss : palette.sand,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: hasInput ? 1 : 0.7,
          }}>
          <Icon name="check" size={14} color={hasInput ? ONDARK : palette.inkMute} />
          <Text
            variant="button"
            color={hasInput ? ONDARK : palette.inkMute}
            style={{ fontSize: 15 }}>
            Buat koreksi
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
