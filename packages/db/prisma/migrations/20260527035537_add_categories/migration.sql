-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('expense', 'income');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "kind" "CategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_user_id_deleted_at_idx" ON "categories"("user_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed system categories (user_id = NULL means global / not user-owned)
INSERT INTO "categories" ("id", "user_id", "kind", "name", "color", "icon", "created_at", "updated_at") VALUES
  ('cat_sys_makan',      NULL, 'expense', 'Makan & Minum',      '#FF6B6B', 'utensils',       NOW(), NOW()),
  ('cat_sys_transport',  NULL, 'expense', 'Transport',          '#4ECDC4', 'car',             NOW(), NOW()),
  ('cat_sys_belanja',    NULL, 'expense', 'Belanja',            '#FFE66D', 'shopping-bag',    NOW(), NOW()),
  ('cat_sys_tagihan',    NULL, 'expense', 'Tagihan & Utilitas', '#A8E6CF', 'zap',             NOW(), NOW()),
  ('cat_sys_hiburan',    NULL, 'expense', 'Hiburan',            '#FF8B94', 'music',           NOW(), NOW()),
  ('cat_sys_kesehatan',  NULL, 'expense', 'Kesehatan',          '#88D8B0', 'heart',           NOW(), NOW()),
  ('cat_sys_pendidikan', NULL, 'expense', 'Pendidikan',         '#7EC8E3', 'book',            NOW(), NOW()),
  ('cat_sys_perawatan',  NULL, 'expense', 'Perawatan Diri',     '#D4A5A5', 'sparkles',        NOW(), NOW()),
  ('cat_sys_rumah',      NULL, 'expense', 'Rumah & Properti',   '#B5C9E0', 'home',            NOW(), NOW()),
  ('cat_sys_lain_keluar',NULL, 'expense', 'Lainnya',            '#C9C9C9', 'more-horizontal', NOW(), NOW()),
  ('cat_sys_gaji',       NULL, 'income',  'Gaji & Upah',        '#95D47A', 'briefcase',       NOW(), NOW()),
  ('cat_sys_bisnis',     NULL, 'income',  'Bisnis',             '#F7C59F', 'trending-up',     NOW(), NOW()),
  ('cat_sys_investasi',  NULL, 'income',  'Investasi',          '#B8A9C9', 'bar-chart',       NOW(), NOW()),
  ('cat_sys_lain_masuk', NULL, 'income',  'Lainnya',            '#C9C9C9', 'more-horizontal', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
