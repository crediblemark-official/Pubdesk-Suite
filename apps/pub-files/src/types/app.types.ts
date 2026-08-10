/**
 * Tipe data domain: Aplikasi (module routing, app state)
 */

export type AppModule =
  | 'home'
  | 'files'
  | 'files-parent'
  | 'settings-local-folders'
  | 'settings-gdrive'
  | 'settings-p2p';


export interface AppState {
  activeModule: AppModule;
}
