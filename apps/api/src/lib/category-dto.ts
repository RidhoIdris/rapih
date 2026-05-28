import type { Category } from '@rapih/db';
import type { CategoryDto } from '@rapih/shared';

export function categoryToDto(row: Category): CategoryDto {
  return {
    id: row.id,
    is_system: row.user_id === null,
    kind: row.kind,
    name: row.name,
    color: row.color,
    icon: row.icon,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
