import type { PrismaClient } from '@rapih/db';

const SYSTEM_CATEGORIES = [
  {
    id: 'cat_sys_makan',
    user_id: null,
    kind: 'expense' as const,
    name: 'Makan & Minum',
    color: '#FF6B6B',
    icon: 'utensils',
  },
  {
    id: 'cat_sys_transport',
    user_id: null,
    kind: 'expense' as const,
    name: 'Transport',
    color: '#4ECDC4',
    icon: 'car',
  },
  {
    id: 'cat_sys_belanja',
    user_id: null,
    kind: 'expense' as const,
    name: 'Belanja',
    color: '#FFE66D',
    icon: 'shopping-bag',
  },
  {
    id: 'cat_sys_tagihan',
    user_id: null,
    kind: 'expense' as const,
    name: 'Tagihan & Utilitas',
    color: '#A8E6CF',
    icon: 'zap',
  },
  {
    id: 'cat_sys_hiburan',
    user_id: null,
    kind: 'expense' as const,
    name: 'Hiburan',
    color: '#FF8B94',
    icon: 'music',
  },
  {
    id: 'cat_sys_kesehatan',
    user_id: null,
    kind: 'expense' as const,
    name: 'Kesehatan',
    color: '#88D8B0',
    icon: 'heart',
  },
  {
    id: 'cat_sys_pendidikan',
    user_id: null,
    kind: 'expense' as const,
    name: 'Pendidikan',
    color: '#7EC8E3',
    icon: 'book',
  },
  {
    id: 'cat_sys_perawatan',
    user_id: null,
    kind: 'expense' as const,
    name: 'Perawatan Diri',
    color: '#D4A5A5',
    icon: 'sparkles',
  },
  {
    id: 'cat_sys_rumah',
    user_id: null,
    kind: 'expense' as const,
    name: 'Rumah & Properti',
    color: '#B5C9E0',
    icon: 'home',
  },
  {
    id: 'cat_sys_lain_keluar',
    user_id: null,
    kind: 'expense' as const,
    name: 'Lainnya',
    color: '#C9C9C9',
    icon: 'more-horizontal',
  },
  {
    id: 'cat_sys_gaji',
    user_id: null,
    kind: 'income' as const,
    name: 'Gaji & Upah',
    color: '#95D47A',
    icon: 'briefcase',
  },
  {
    id: 'cat_sys_bisnis',
    user_id: null,
    kind: 'income' as const,
    name: 'Bisnis',
    color: '#F7C59F',
    icon: 'trending-up',
  },
  {
    id: 'cat_sys_investasi',
    user_id: null,
    kind: 'income' as const,
    name: 'Investasi',
    color: '#B8A9C9',
    icon: 'bar-chart',
  },
  {
    id: 'cat_sys_lain_masuk',
    user_id: null,
    kind: 'income' as const,
    name: 'Lainnya',
    color: '#C9C9C9',
    icon: 'more-horizontal',
  },
] as const;

export const SYSTEM_CATEGORY_COUNT = SYSTEM_CATEGORIES.length;

export async function seedSystemCategories(prisma: PrismaClient): Promise<void> {
  await prisma.category.createMany({
    data: SYSTEM_CATEGORIES.map((c) => ({ ...c })),
    skipDuplicates: true,
  });
}
