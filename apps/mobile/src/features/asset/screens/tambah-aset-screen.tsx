import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type AssetType = 'rdpu' | 'saham' | 'crypto' | 'emas' | 'obli' | 'prop';

const TYPES: { id: AssetType; e: string; l: string; sub: string }[] = [
  { id: 'rdpu', e: '💧', l: 'Pasar Uang', sub: 'Reksadana RDPU' },
  { id: 'saham', e: '📈', l: 'Saham', sub: 'BBCA, TLKM, dst.' },
  { id: 'crypto', e: '₿', l: 'Kripto', sub: 'BTC, ETH, lainnya' },
  { id: 'emas', e: '🪙', l: 'Emas', sub: 'Digital atau fisik' },
  { id: 'obli', e: '📜', l: 'Obligasi', sub: 'ORI, SBR, FR' },
  { id: 'prop', e: '🏘️', l: 'Properti', sub: 'Tanah, rumah, kos' },
];


type Stock = { tick: string; name: string; last: string; d: string };

const STOCKS: Stock[] = [
  { tick: 'BBCA', name: 'Bank Central Asia', last: 'Rp 9.450', d: '+0,3%' },
  { tick: 'TLKM', name: 'Telkom Indonesia', last: 'Rp 3.120', d: '−0,6%' },
  { tick: 'GOTO', name: 'GoTo Gojek Tokopedia', last: 'Rp 78', d: '+1,3%' },
  { tick: 'BMRI', name: 'Bank Mandiri', last: 'Rp 5.825', d: '+0,9%' },
  { tick: 'UNVR', name: 'Unilever Indonesia', last: 'Rp 2.180', d: '−0,2%' },
];

export function TambahAsetScreen() {
  const router = useRouter();
  const [picked, setPicked] = useState<AssetType>('saham');
  const [selectedStock, setSelectedStock] = useState(0);

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
          onPress={() => { haptics.tap(); router.back(); }}
          style={{
            width: 38, height: 38, borderRadius: 38,
            backgroundColor: palette.card,
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Icon name="x" size={12} color={palette.ink} />
        </Pressable>
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Tambah Aset
        </Text>
        <View style={{ width: 38 }} />
      </View>


      {/* step 1 title */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700' }}>
          Langkah 1 dari 2
        </Text>
        <Text
          variant="figureS"
          style={{ fontSize: 28, letterSpacing: -1.1, lineHeight: 30, marginTop: 6 }}>
          Pilih jenis aset
        </Text>
      </View>

      {/* type grid */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}>
        {TYPES.map((t) => {
          const sel = t.id === picked;
          return (
            <Pressable
              key={t.id}
              onPress={() => { haptics.select(); setPicked(t.id); }}
              style={{
                width: '31%',
                paddingVertical: 14,
                paddingHorizontal: 10,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: sel ? palette.moss : palette.card,
                borderWidth: sel ? 0 : 1,
                borderColor: palette.inkFaint,
                alignItems: 'center',
                gap: 6,
              }}>
              <Text style={{ fontSize: 22 }}>{t.e}</Text>
              <Text
                variant="bodySm"
                color={sel ? ONDARK : palette.ink}
                style={{ fontSize: 12, fontWeight: '700' }}>
                {t.l}
              </Text>
              <Text
                variant="bodySm"
                color={sel ? 'rgba(240,240,232,0.65)' : palette.inkMute}
                style={{ fontSize: 9.5, textAlign: 'center', lineHeight: 12 }}>
                {t.sub}
              </Text>
            </Pressable>
          );
        })}
      </View>


      {/* step 2 title */}
      <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700' }}>
          Langkah 2 dari 2
        </Text>
        <Text
          variant="figureS"
          style={{ fontSize: 24, letterSpacing: -0.9, lineHeight: 26, marginTop: 4 }}>
          Pilih saham yang kamu miliki
        </Text>
      </View>

      {/* search */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Icon name="search" size={16} color={palette.inkMute} />
        <Text variant="bodySm" color={palette.inkMute} style={{ flex: 1, fontSize: 13 }}>
          Cari kode atau nama emiten…
        </Text>
        <View
          style={{
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderRadius: 999,
            backgroundColor: palette.limeSoft,
          }}>
          <Text variant="chip" color={palette.moss} style={{ fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 }}>
            IDX
          </Text>
        </View>
      </View>


      {/* stock list */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {STOCKS.map((s, i) => {
          const isPicked = i === selectedStock;
          return (
            <Pressable
              key={s.tick}
              onPress={() => { haptics.select(); setSelectedStock(i); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderBottomWidth: i < STOCKS.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <View
                style={{
                  width: 38, height: 38, borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: '#5e88c4',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                <Text color="#fff" style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>
                  {s.tick}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
                  {s.tick}{' '}
                  <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, fontWeight: '500' }}>
                    · {s.name}
                  </Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                  <Text variant="mono" color={palette.inkMute} style={{ fontSize: 11 }}>
                    {s.last}
                  </Text>
                  <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11 }}>·</Text>
                  <Text
                    variant="mono"
                    color={s.d.startsWith('+') ? palette.cool : palette.coral}
                    style={{ fontSize: 11, fontWeight: '600' }}>
                    {s.d}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: 24, height: 24, borderRadius: 24,
                  backgroundColor: isPicked ? palette.moss : 'transparent',
                  borderWidth: isPicked ? 0 : 1.5,
                  borderColor: palette.inkFaint,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                {isPicked && <Icon name="check" size={12} color={palette.lime} />}
              </View>
            </Pressable>
          );
        })}
      </View>


      {/* selection summary */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 16,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: palette.lime,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <View
          style={{
            width: 28, height: 28, borderRadius: 8,
            backgroundColor: palette.moss,
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text color={palette.lime} style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>
            {STOCKS[selectedStock].tick}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" color={palette.moss} style={{ fontSize: 12.5, fontWeight: '700' }}>
            1 saham dipilih
          </Text>
          <Text variant="bodySm" color="rgba(28,36,24,0.65)" style={{ fontSize: 10.5, marginTop: 1 }}>
            Selanjutnya isi jumlah lot & harga beli
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Pressable
          onPress={() => { haptics.success(); router.back(); }}
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
            Lanjut · isi detail
          </Text>
          <Icon name="arrowR" size={14} color={ONDARK} />
        </Pressable>
      </View>
    </Screen>
  );
}
