import { apiRequest } from '@/lib/api';
import type {
  ReceiptDto,
  ReceiptListResponse,
  ReceiptResponse,
  UpdateReceiptBody,
} from '@rapih/shared';

type ListData = ReceiptListResponse['data'];
type OneData = ReceiptResponse['data'];

export async function listReceipts(): Promise<ReceiptDto[]> {
  const data = await apiRequest<ListData>('/receipts');
  return data.receipts;
}

export async function getReceipt(id: string): Promise<ReceiptDto> {
  const data = await apiRequest<OneData>(`/receipts/${id}`);
  return data.receipt;
}

/**
 * Upload a receipt image + metadata. Sends multipart/form-data so the API
 * can upload the image to R2. Pass `imageUri` as the local file URI from
 * the camera/picker; omit to create a metadata-only receipt.
 */
export async function createReceipt(opts: {
  imageUri?: string;
  merchantName?: string;
  totalAmount?: string;
  scannedAt: string;
}): Promise<ReceiptDto> {
  const form = new FormData();
  form.append('scanned_at', opts.scannedAt);
  if (opts.merchantName) form.append('merchant_name', opts.merchantName);
  if (opts.totalAmount) form.append('total_amount', opts.totalAmount);
  if (opts.imageUri) {
    const filename = opts.imageUri.split('/').pop() ?? 'receipt.jpg';
    const type = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    // React Native FormData accepts { uri, name, type } as a file entry
    form.append('image', { uri: opts.imageUri, name: filename, type } as unknown as Blob);
  }
  const data = await apiRequest<OneData>('/receipts', {
    method: 'POST',
    body: form as unknown as Record<string, unknown>,
    headers: { 'content-type': 'multipart/form-data' },
  });
  return data.receipt;
}

export async function updateReceipt(id: string, body: UpdateReceiptBody): Promise<ReceiptDto> {
  const data = await apiRequest<OneData>(`/receipts/${id}`, { method: 'PATCH', body });
  return data.receipt;
}

export async function deleteReceipt(id: string): Promise<void> {
  await apiRequest<void>(`/receipts/${id}`, { method: 'DELETE' });
}
