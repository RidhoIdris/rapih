import { apiRequest } from '@/lib/api';
import type { DeviceTokenDto, DeviceTokenResponse, RegisterDeviceBody } from '@rapih/shared';

type OneData = DeviceTokenResponse['data'];

export async function registerDevice(body: RegisterDeviceBody): Promise<DeviceTokenDto> {
  const data = await apiRequest<OneData>('/devices/register', { method: 'POST', body });
  return data.device;
}

export async function unregisterDevice(token: string): Promise<void> {
  await apiRequest<void>(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
}
