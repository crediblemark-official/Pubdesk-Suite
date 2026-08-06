/**
 * Loader template invoice — fully dinamis via import.meta.glob.
 *
 * Untuk menambah template baru:
 * 1. Buat file JSON di src/assets/invoice-templates/
 * 2. Pastikan file JSON memiliki field: templateId, label, description, category
 *    beserta seluruh field InvoiceProfile (tanpa id)
 * 3. Template akan otomatis tersedia tanpa perlu mendaftar di sini
 */

import { InvoiceProfile } from '@pubhub/shared-types';

export interface InvoiceTemplate {
  /** ID unik template — berbeda dari ID profil yang akan dibuat */
  templateId: string;
  /** Nama template yang ditampilkan ke user */
  label: string;
  /** Deskripsi singkat pola kolom yang dipakai */
  description: string;
  /** Tag kategori untuk mengelompokkan template dalam modal */
  category: string;
  /** Data profil lengkap — tanpa field id agar tidak bentrok dengan profil baru */
  profile: Omit<InvoiceProfile, 'id'>;
}

// Muat semua JSON di folder invoice-templates secara otomatis
const templateModules = import.meta.glob<Record<string, unknown>>(
  '../assets/invoice-templates/*.json',
  { eager: true }
);

/**
 * Daftar semua template bawaan yang tersedia.
 * Diurutkan berdasarkan category lalu label secara alfabetis.
 */
export const invoiceTemplates: InvoiceTemplate[] = Object.values(templateModules)
  .filter((mod) => {
    // Validasi field wajib agar JSON yang tidak lengkap tidak menyebabkan error
    return (
      typeof mod['templateId'] === 'string' &&
      typeof mod['label'] === 'string' &&
      typeof mod['category'] === 'string'
    );
  })
  .map((mod) => ({
    templateId: mod['templateId'] as string,
    label: mod['label'] as string,
    description: (mod['description'] as string) ?? '',
    category: mod['category'] as string,
    profile: mod as unknown as Omit<InvoiceProfile, 'id'>,
  }))
  .sort((a, b) => {
    const catDiff = a.category.localeCompare(b.category, 'id');
    return catDiff !== 0 ? catDiff : a.label.localeCompare(b.label, 'id');
  });
