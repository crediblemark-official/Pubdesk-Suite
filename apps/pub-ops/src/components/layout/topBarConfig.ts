export const MODULE_LABELS: Record<string, string> = {
  'home': 'Beranda Utama',
  'pekerjaan-saya': 'Pekerjaan Saya',
  'produksi-parent': 'Produksi Naskah',
  'produksi-board': 'Board Produksi',
  'produksi-list': 'Daftar Tugas',
  'produksi-kendala': 'Revisi & Kendala',
  'produksi-approval': 'Approval',
  'produksi-timeline': 'Timeline',
  'tambah-tugas': 'Tambah Tugas Baru',
  'edit-tugas': 'Edit Tugas',
  'laporan-operasional': 'Laporan Operasional',
  'kontak': 'Kontak',
  'penulis': 'Penulis',
  'penerbit': 'Penerbit',
  'naskah': 'Buku / Naskah',
  'legalitas': 'Legalitas',
  'activity-log': 'Activity Log',
};

export const SEARCHABLE_MODULES = new Set([
  'kontak', 'penulis', 'penerbit', 'naskah',
  'legalitas', 'produksi-list', 'produksi-board',
  'pekerjaan-saya', 'produksi-kendala', 'produksi-approval', 'produksi-timeline',
]);

export const SEARCH_PLACEHOLDERS: Record<string, string> = {
  'kontak': 'Cari nama, email, WA...',
  'penulis': 'Cari nama, email, WA...',
  'penerbit': 'Cari nama penerbit...',
  'naskah': 'Cari judul, penulis, genre...',
  'legalitas': 'Cari judul, tipe...',
  'produksi-list': 'Cari judul, tugas...',
  'produksi-board': 'Cari judul, tugas...',
  'pekerjaan-saya': 'Cari tugas...',
  'produksi-kendala': 'Cari judul, kendala...',
  'produksi-approval': 'Cari judul...',
  'produksi-timeline': 'Cari riwayat...',
};

export const SEARCH_HINTS: Record<string, string> = {
  'kontak': '🔍 Cari nama, email, WA...',
  'penulis': '🔍 Cari nama, email, WA...',
  'penerbit': '🔍 Cari nama penerbit...',
  'naskah': '🔍 Cari judul, penulis, genre...',
  'legalitas': '🔍 Cari judul, tipe...',
  'produksi-list': '🔍 Cari judul, tugas...',
  'produksi-board': '🔍 Cari judul, tugas...',
  'pekerjaan-saya': '🔍 Cari tugas...',
  'produksi-kendala': '🔍 Cari judul, kendala...',
  'produksi-approval': '🔍 Cari judul...',
  'produksi-timeline': '🔍 Cari riwayat...',
};

export const DEFAULT_SEARCH_PLACEHOLDER = 'Cari judul naskah...';
export const DEFAULT_SEARCH_HINT = '🔍 Cari naskah, tugas, atau penulis...';
