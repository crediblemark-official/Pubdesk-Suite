import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Modal } from '../../../ui/molecules/Modal';

interface WorkSessionTimerProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onSessionChange?: (isRunning: boolean) => void;
}

export const WorkSessionTimer: React.FC<WorkSessionTimerProps> = ({ showToast, onSessionChange }) => {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [sessionNote, setSessionNote] = useState('');

  // Load active session on mount
  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        const session = await invoke<any>('get_active_work_session');
        if (session) {
          setActiveSession(session);
          setIsTimerRunning(true);
          onSessionChange?.(true);
          const startTime = new Date(session.start_time).getTime();
          const now = Date.now();
          const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
          setTimerSeconds(elapsed);
        } else {
          onSessionChange?.(false);
        }
      } catch (err) {
        console.error('Gagal memuat sesi kerja aktif:', err);
        onSessionChange?.(false);
      }
    };
    fetchActiveSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update timer seconds every second if running
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning && activeSession) {
      interval = setInterval(() => {
        const startTime = new Date(activeSession.start_time).getTime();
        const now = Date.now();
        const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
        setTimerSeconds(elapsed);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, activeSession]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');
  };

  const handleStartWork = async () => {
    try {
      const startTime = new Date().toISOString();
      const sessionId = await invoke<number>('start_work_session', { startTime });
      const newSession = {
        id: sessionId,
        start_time: startTime,
        duration_seconds: 0,
        created_at: startTime
      };
      setActiveSession(newSession);
      setIsTimerRunning(true);
      onSessionChange?.(true);
      showToast('Sesi jam kerja dimulai!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Gagal memulai sesi kerja: ${err.message || String(err)}`, 'error');
    }
  };

  const handleStopWorkClick = () => {
    setSessionNote('');
    setShowNoteModal(true);
  };

  const handleConfirmStopWork = async () => {
    try {
      const endTime = new Date().toISOString();
      const startTime = activeSession?.start_time ? new Date(activeSession.start_time).getTime() : Date.now();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      
      await invoke('stop_work_session', {
        id: activeSession?.id || 0,
        endTime,
        durationSeconds: elapsedSeconds,
        notes: sessionNote.trim() || null
      });

      setIsTimerRunning(false);
      setActiveSession(null);
      setShowNoteModal(false);
      onSessionChange?.(false);
      showToast('Sesi jam kerja telah disimpan!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Gagal menghentikan sesi kerja: ${err.message || String(err)}`, 'error');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '6px' }}>
        {isTimerRunning ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '2px 10px', 
            borderRadius: '20px',
            fontFamily: '"JetBrains Mono", "Courier New", monospace',
            fontSize: '13px',
            fontWeight: '600',
            color: '#10b981',
            boxShadow: '0 0 10px rgba(16, 185, 129, 0.05)'
          }}>
            <span className="timer-pulse" style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'inline-block',
              boxShadow: '0 0 8px #10b981'
            }} />
            <span>{formatTime(timerSeconds)}</span>
            <button
              onClick={handleStopWorkClick}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                marginLeft: '4px',
                borderRadius: '4px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Selesai Kerja"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartWork}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Mulai Sesi Kerja"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span className="top-bar-btn-text">Mulai Kerja</span>
          </button>
        )}
      </div>

      {showNoteModal && (
        <Modal 
          open={showNoteModal} 
          onClose={() => setShowNoteModal(false)} 
          title="Akhiri Sesi Kerja" 
          width="400px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Durasi kerja Anda hari ini adalah <strong>{formatTime(timerSeconds)}</strong>. Tambahkan catatan pekerjaan (opsional) sebelum menyimpan sesi kerja Anda:
            </p>
            <textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="Contoh: Menyelesaikan desain halaman login, sinkronisasi file..."
              style={{
                width: '100%',
                height: '80px',
                background: 'var(--bg-dark)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setShowNoteModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmStopWork}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: 'white',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Simpan & Selesai
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
