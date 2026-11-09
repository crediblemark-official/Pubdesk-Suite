import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const WindowControls: React.FC = () => {
  const appWindow = typeof window !== 'undefined' ? getCurrentWindow() : null;

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    if (appWindow) {
      appWindow.onCloseRequested(async (event: any) => {
        // Blokir penutupan window secara instan secara sinkron!
        event.preventDefault();

        try {
          const activeSession = await invoke<any>('get_active_work_session');
          if (activeSession) {
            // Tampilkan dialog konfirmasi interaktif
            const dialog = await import('@tauri-apps/plugin-dialog');
            const shouldClose = await dialog.ask(
              'Sesi jam kerja Anda masih aktif. Apakah Anda ingin mengakhiri sesi kerja dan menutup aplikasi sekarang?',
              {
                title: 'Konfirmasi Menutup Aplikasi',
                kind: 'warning',
                okLabel: 'Akhiri Sesi & Tutup',
                cancelLabel: 'Batal',
              }
            );

            if (shouldClose) {
              try {
                const endTime = new Date().toISOString();
                await invoke('stop_work_session', {
                  id: activeSession.id,
                  endTime,
                  durationSeconds: activeSession.duration_seconds || 0,
                  notes: 'Sesi diakhiri otomatis saat aplikasi ditutup'
                });
              } catch (stopErr) {
                console.error('Gagal menghentikan sesi kerja saat penutupan:', stopErr);
              }
              appWindow.destroy().catch(console.error);
            }
          } else {
            // Jika tidak ada sesi aktif, hancurkan/tutup window paksa
            appWindow.destroy().catch(console.error);
          }
        } catch (err) {
          // Jika error (misal belum login), tetap hancurkan/tutup window
          appWindow.destroy().catch(console.error);
        }
      }).then((unsub: any) => {
        unlisten = unsub;
      });
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [appWindow]);

  const handleMinimize = () => {
    appWindow ? appWindow.minimize().catch(console.error) : console.log('Minimize window (browser mock)');
  };

  const handleMaximize = () => {
    appWindow ? appWindow.toggleMaximize().catch(console.error) : console.log('Maximize window (browser mock)');
  };

  const handleClose = () => {
    if (appWindow) {
      appWindow.close().catch(console.error);
    } else {
      console.log('Close window (browser mock)');
    }
  };

  const handleDragStart = () => {
    appWindow ? appWindow.startDragging().catch(console.error) : console.log('Drag window (browser mock)');
  };

  return (
    <div className="top-bar-gnome-windowcontrols">
      {/* Drag Handle Button untuk menggeser window */}
      <button 
        className="top-bar-window-btn top-bar-window-drag-btn" 
        onMouseDown={handleDragStart}
        data-tauri-drag-region
        style={{ cursor: 'grab' }}
        title="Geser Window"
        aria-label="Drag Window"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </button>

      <button className="top-bar-window-btn" onClick={handleMinimize} aria-label="Minimize">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button className="top-bar-window-btn" onClick={handleMaximize} aria-label="Maximize">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>
      <button className="top-bar-window-btn top-bar-window-close-btn" onClick={handleClose} aria-label="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};
