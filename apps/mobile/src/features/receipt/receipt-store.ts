import type { ConsumeBody, ReceiptScanDto, ReceiptScanSource } from '@rapih/shared';
import { create } from 'zustand';
import {
  consumeScan,
  createScan,
  deleteScan,
  finalizeScan,
  getScan,
  listScans,
  uploadToR2,
} from './api';

type CurrentScan = { image_url: string; scan: ReceiptScanDto };

type ReceiptState = {
  current: CurrentScan | null;
  error: string | null;
  scans: ReceiptScanDto[];
  status: 'idle' | 'loading' | 'ready' | 'error';

  consume: (id: string, body: ConsumeBody) => Promise<string[]>;
  loadScan: (id: string) => Promise<void>;
  loadScans: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  startScan: (
    fileUri: string,
    source: ReceiptScanSource,
    contentType: string,
    sizeBytes: number
  ) => Promise<string>;
};

export const useReceiptStore = create<ReceiptState>((set, get) => ({
  current: null,
  error: null,
  scans: [],
  status: 'idle',

  loadScans: async () => {
    set({ status: 'loading', error: null });
    try {
      const scans = await listScans({ limit: 100 });
      set({ status: 'ready', scans });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat struk.';
      set({ status: 'error', error: message });
    }
  },

  loadScan: async (id) => {
    set({ status: 'loading', error: null });
    try {
      const current = await getScan(id);
      set({ current, status: 'ready' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat detail struk.';
      set({ status: 'error', error: message });
    }
  },

  startScan: async (fileUri, source, contentType, sizeBytes) => {
    const { scan, upload } = await createScan({
      source,
      content_type: contentType,
      size_bytes: sizeBytes,
    });
    set({ scans: [scan, ...get().scans], status: 'ready' });
    await uploadToR2(upload.url, upload.headers, fileUri);
    const processing = await finalizeScan(scan.id);
    set({ scans: get().scans.map((s) => (s.id === scan.id ? processing : s)) });
    return processing.id;
  },

  consume: async (id, body) => {
    const data = await consumeScan(id, body);
    const current = get().current;
    set({
      current:
        current?.scan.id === id
          ? { ...current, scan: { ...current.scan, status: 'consumed' } }
          : current,
      scans: get().scans.map((s) => (s.id === id ? { ...s, status: 'consumed' } : s)),
    });
    return data.transaction_ids;
  },

  remove: async (id) => {
    await deleteScan(id);
    set({
      current: get().current?.scan.id === id ? null : get().current,
      scans: get().scans.filter((s) => s.id !== id),
    });
  },
}));
