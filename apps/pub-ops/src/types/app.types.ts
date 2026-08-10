/**
 * Tipe data domain: Aplikasi (module routing, app state)
 */

export type AppModule =
  | 'home'
  | 'kontak'
  | 'penulis'
  | 'penerbit'
  | 'naskah'
  | 'legalitas'

  | 'activity-log'
  | 'pekerjaan-saya'
  | 'produksi-board'
  | 'produksi-list'
  | 'produksi-kendala'
  | 'produksi-approval'
  | 'produksi-timeline'
  | 'laporan-operasional'
  | 'services'
  | 'tambah-tugas'
  | 'edit-tugas'
  | 'produksi-parent'
  | 'master-data-parent'
  | 'settings-p2p';

export interface AppState {
  activeModule: AppModule;
}
