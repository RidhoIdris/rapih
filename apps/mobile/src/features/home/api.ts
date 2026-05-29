import { apiRequest } from '@/lib/api';
import type { HomeResponse, HomeSummary } from '@rapih/shared';

type Data = HomeResponse['data'];

/** One aggregated call powering the whole Beranda dashboard. */
export async function getHome(): Promise<HomeSummary> {
  const data = await apiRequest<Data>('/home');
  return data.home;
}
