import { apiRequest } from '@/lib/api';
import type {
  ConsumeBody,
  ConsumeResponse,
  CreateScanBody,
  CreateScanResponse,
  FinalizeScanResponse,
  ListScansResponse,
  ReceiptScanDto,
  ScanDetailResponse,
} from '@rapih/shared';

export async function createScan(
  body: CreateScanBody
): Promise<CreateScanResponse['data']> {
  return apiRequest<CreateScanResponse['data']>('/receipts/scans', { method: 'POST', body });
}

export async function uploadToR2(
  url: string,
  headers: Record<string, string>,
  fileUri: string
): Promise<void> {
  const blob = await (await fetch(fileUri)).blob();
  const res = await fetch(url, { method: 'PUT', headers, body: blob });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
}

export async function finalizeScan(id: string): Promise<ReceiptScanDto> {
  const data = await apiRequest<FinalizeScanResponse['data']>(`/receipts/scans/${id}/finalize`, {
    method: 'POST',
  });
  return data.scan;
}

export async function listScans(opts: {
  limit?: number;
  status?: ReceiptScanDto['status'];
} = {}): Promise<ReceiptScanDto[]> {
  const qs = new URLSearchParams();
  if (opts.status) qs.set('status', opts.status);
  if (opts.limit) qs.set('limit', String(opts.limit));
  const data = await apiRequest<ListScansResponse['data']>(
    `/receipts/scans${qs.size ? `?${qs.toString()}` : ''}`
  );
  return data.scans;
}

export async function getScan(id: string): Promise<ScanDetailResponse['data']> {
  return apiRequest<ScanDetailResponse['data']>(`/receipts/scans/${id}`);
}

export async function consumeScan(
  id: string,
  body: ConsumeBody
): Promise<ConsumeResponse['data']> {
  return apiRequest<ConsumeResponse['data']>(`/receipts/scans/${id}/consume`, {
    method: 'POST',
    body,
  });
}

export async function deleteScan(id: string): Promise<void> {
  await apiRequest<void>(`/receipts/scans/${id}`, { method: 'DELETE' });
}
