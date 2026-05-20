import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, shadow, tint } from '@/theme';
import { BackButton, Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Range = '30d' | '3m' | '6m' | 'ytd' | 'all';
type Format = 'csv' | 'pdf' | 'xlsx' | 'json';

const RANGES: { id: Range; l: string; sub: string }[] = [
  { id: '30d', l: '30 hari', sub: '21 Apr — 20 Mei' },
  { id: '3m', l: '3 bulan', sub: 'Feb — Mei 2026' },
  { id: '6m', l: '6 bulan', sub: 'Nov 2025 — Mei 2026' },
  { id: 'ytd', l: 'Sejak Januari', sub: 'Year to date' },
  { id: 'all', l: 'Semua waktu', sub: 'Sejak Mar 2026' },
];

const FORMATS: { id: Format; e: string; l: string; sub: string }[] = [
  { id: 'csv', e: '◷', l: 'CSV', sub: 'Spreadsheet polos' },
  { id: 'xlsx', e: '☷', l: 'Excel', sub: 'Lengkap dengan rumus' },
  { id: 'pdf', e: '☵', l: 'PDF', sub: 'Laporan siap cetak' },
  { id: 'json', e: '{ }', l: 'JSON', sub: 'Untuk developer' },
];

const INCLUDE_ROWS = [
  { key: 'tx', l: 'Transaksi', sub: 'Semua mutasi dompet & kartu' },
  { key: 'budget', l: 'Budget & kantong', sub: 'Alokasi dan pemakaian per bulan' },
  { key: 'goal', l: 'Goal & target', sub: 'Progress tabungan tujuan' },
  { key: 'aset', l: 'Aset & investasi', sub: 'Snapshot nilai per tanggal ekspor' },
  { key: 'rules', l: 'Aturan otomatis', sub: 'Konfigurasi & riwayat eksekusi' },
];

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

export function EksporDataScreen() {
  const router = useRouter();
  const [range, setRange] = useState<Range>('3m');
  const [fmt, setFmt] = useState<Format>('csv');
  const [include, setInclude] = useState<Record<string, boolean>>({
    tx: true,
    budget: true,
    goal: true,
    aset: false,
    rules: false,
  });

  const includedCount = Object.values(include).filter(Boolean).length;

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
          Ekspor data
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* intro */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
        <Text
          variant="figureS"
          style={{ fontSize: 26, letterSpacing: -1, lineHeight: 30 }}>
          Bawa data kamu
        </Text>
        <Text
          variant="bodySm"
          color={palette.inkSoft}
          style={{ fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          Pilih rentang dan format. File terenkripsi & dikirim ke email kamu.
        </Text>
      </View>

      {/* range */}
      <View style={{ marginHorizontal: 18, marginTop: 22 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Rentang waktu
        </Text>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {RANGES.map((r, i) => {
            const sel = r.id === range;
            return (
              <Pressable
                key={r.id}
                onPress={() => {
                  haptics.select();
                  setRange(r.id);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderBottomWidth: i < RANGES.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="bodySm"
                    style={{ fontSize: 14, fontWeight: '600', letterSpacing: -0.2 }}>
                    {r.l}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={palette.inkMute}
                    style={{ fontSize: 11, marginTop: 2 }}>
                    {r.sub}
                  </Text>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 22,
                    backgroundColor: sel ? palette.moss : 'transparent',
                    borderWidth: sel ? 0 : 1.5,
                    borderColor: palette.inkFaint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {sel && <Icon name="check" size={11} color={palette.lime} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* format */}
      <View style={{ marginHorizontal: 18, marginTop: 22 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Format file
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}>
          {FORMATS.map((f) => {
            const sel = f.id === fmt;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  haptics.select();
                  setFmt(f.id);
                }}
                style={{
                  width: '48.5%',
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  backgroundColor: sel ? palette.moss : palette.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: sel ? undefined : shadow.ring,
                }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    backgroundColor: sel ? palette.lime : palette.sand,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text color={palette.moss} style={{ fontSize: 13, fontWeight: '700' }}>
                    {f.e}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="bodySm"
                    color={sel ? ONDARK : palette.ink}
                    style={{ fontSize: 13, fontWeight: '700' }}>
                    {f.l}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={sel ? 'rgba(240,240,232,0.65)' : palette.inkMute}
                    style={{ fontSize: 10.5, marginTop: 2 }}>
                    {f.sub}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* include */}
      <View style={{ marginHorizontal: 18, marginTop: 22 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Sertakan data
        </Text>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {INCLUDE_ROWS.map((r, i) => (
            <View
              key={r.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: i < INCLUDE_ROWS.length - 1 ? 1 : 0,
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
              <Toggle
                on={include[r.key]}
                onPress={() =>
                  setInclude((p) => ({ ...p, [r.key]: !p[r.key] }))
                }
              />
            </View>
          ))}
        </View>
      </View>

      {/* delivery summary */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: tint.amber,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text color={tint.amberInk} style={{ fontSize: 13, fontWeight: '700' }}>
            ✉
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            variant="bodySm"
            color={tint.amberInk}
            style={{ fontSize: 12.5, fontWeight: '700' }}>
            Dikirim ke adelia.r@gmail.com
          </Text>
          <Text
            variant="bodySm"
            color={tint.amberInk}
            style={{ fontSize: 10.5, marginTop: 1, opacity: 0.75 }}>
            File ZIP terenkripsi · tautan unduh berlaku 24 jam
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Pressable
          onPress={() => {
            haptics.success();
            router.back();
          }}
          disabled={includedCount === 0}
          style={{
            height: 54,
            borderRadius: 27,
            backgroundColor: includedCount === 0 ? palette.sandDeep : palette.moss,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
          <Text variant="button" color={ONDARK} style={{ fontSize: 15 }}>
            {includedCount === 0
              ? 'Pilih minimal 1 data'
              : `Buat ekspor · ${includedCount} jenis data`}
          </Text>
          {includedCount > 0 && <Icon name="arrowR" size={14} color={ONDARK} />}
        </Pressable>
      </View>
    </Screen>
  );
}
