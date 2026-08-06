import { useMemo } from 'react';

/**
 * Hook untuk mengekstrak nilai unik dari sebuah field pada array objek.
 * Menghilangkan pattern `Array.from(new Set(items.map(i => i[field]).filter(Boolean)))`
 * yang berulang di banyak komponen filter.
 */
export function useUniqueValues<T>(items: T[], field: keyof T): string[] {
  return useMemo(
    () => Array.from(
      new Set(
        items
          .map((i) => String(i[field] ?? ''))
          .filter((v) => v.length > 0)
      )
    ),
    [items, field]
  );
}
