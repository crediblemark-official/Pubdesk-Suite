import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Belum pernah';
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'baru saja';
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const jam = Math.floor(min / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  return `${hari} hari lalu`;
}

export interface SyncConnectionPanelProps {
  isAdmin?: boolean;
}

export const SyncConnectionPanel: React.FC<SyncConnectionPanelProps> = ({ isAdmin = false }) => {
  const [enabled, setEnabled] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 3000); };

  const load = useCallback(async () => {
    try {
      const raw = await invoke<string>('get_sync_config_full');
      const c = JSON.parse(raw);
      setEnabled(c.enabled);
      setDeviceId(c.device_id);

      const st = await invoke<any>('get_sync_status');
      setLastSyncAt(st.last_sync_at || null);
      setError(st.error || null);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await invoke<string>('test_sync_connection');
      showMsg(res);
      load();
    } catch (e: any) {
      showMsg('Gagal: ' + (e.message || String(e)));
    } finally { setTesting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
      {/* Header Status */}
      <div style={{ padding: '16px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderLeft: '4px solid #10b981' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {enabled ? '● Aktif' : '○ Nonaktif'}
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', fontSize: '12px' }}>
          {message}
        </div>
      )}

      {/* Detail Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Sync Terakhir</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{timeAgo(lastSyncAt)}</div>
        </div>
        <div style={{ padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Device ID</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {deviceId || '-'}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={testConnection} disabled={testing} style={btnSecondaryStyle}>
          {testing ? 'Testing...' : 'Test Koneksi'}
        </button>
        <SyncNowButton />
      </div>

      {/* Config */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Konfigurasi</h4>
        <SyncConfigForm isAdmin={isAdmin} onSaved={() => { load(); showMsg('Konfigurasi disimpan.'); }} />
      </div>
    </div>
  );
};

const SyncNowButton: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const raw = await invoke<string>('run_sync_now');
      const r = JSON.parse(raw);
      setMsg(`Push: ${r.pushed}, Pull: ${r.pulled}` + (r.error ? ` (Error: ${r.error})` : ''));
      if (r.pulled > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (e: any) {
      setMsg('Gagal: ' + (e.message || String(e)));
    } finally { setSyncing(false); setTimeout(() => setMsg(null), 5000); }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button onClick={syncNow} disabled={syncing} style={btnPrimaryStyle}>
        {syncing ? 'Syncing...' : 'Sync Sekarang'}
      </button>
      {msg && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{msg}</span>}
    </div>
  );
};

const SyncConfigForm: React.FC<{ isAdmin?: boolean; onSaved: () => void }> = ({ isAdmin = false, onSaved }) => {
  const [gasUrl, setGasUrl] = useState('');
  const [gasToken, setGasToken] = useState('');
  const [hideInOtherApps, setHideInOtherApps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return localStorage.getItem('pubdesk_sync_config_locked') !== 'false';
  });

  useEffect(() => {
    invoke<string>('get_sync_config_full').then((raw) => {
      try {
        const c = JSON.parse(raw);
        const urlVal = c.gas_url || '';
        const tokenVal = c.gas_token || '';
        setGasUrl(urlVal);
        setGasToken(tokenVal);
        setHideInOtherApps(!!c.hide_sync_menu_in_other_apps);
        if (urlVal.trim().length > 0) {
          setIsLocked(true);
          localStorage.setItem('pubdesk_sync_config_locked', 'true');
        } else {
          setIsLocked(false);
        }
      } catch {}
    }).catch(() => {});
  }, []);

  const toggleLock = () => {
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    localStorage.setItem('pubdesk_sync_config_locked', String(nextLocked));
  };

  const save = async () => {
    setSaving(true);
    try {
      await invoke('set_sync_config', {
        syncMethod: 'gas',
        workerUrl: '',
        gasUrl,
        gasToken,
        hideSyncMenuInOtherApps: hideInOtherApps
      });
      setIsLocked(true);
      localStorage.setItem('pubdesk_sync_config_locked', 'true');
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {isLocked ? '🔒 Konfigurasi Terkunci' : '🔓 Mode Edit Konfigurasi'}
        </span>
        <button
          type="button"
          onClick={toggleLock}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '0px',
            border: isLocked ? '1px solid #10b981' : '1px solid #eab308',
            background: isLocked ? 'rgba(16,185,129,0.1)' : 'rgba(234,179,8,0.1)',
            color: isLocked ? '#10b981' : '#eab308',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isLocked ? '🔓 Buka Kunci Edit' : '🔒 Kunci Kembali'}
        </button>
      </div>

      {isLocked && (
        <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '11px', color: '#10b981' }}>
          🔒 URL &amp; Token terlindungi dari perubahan tak disengaja. Klik <strong>"Buka Kunci Edit"</strong> jika ingin mengubah URL.
        </div>
      )}

      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        URL Google Apps Script
        <input
          type="text"
          disabled={isLocked}
          value={gasUrl}
          onChange={(e) => setGasUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/.../exec"
          style={{
            ...inputStyle,
            marginTop: '4px',
            opacity: isLocked ? 0.65 : 1,
            cursor: isLocked ? 'not-allowed' : 'text',
            borderColor: isLocked ? 'var(--border)' : '#10b981'
          }}
        />
      </label>

      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Token GAS
        <input
          type="text"
          disabled={isLocked}
          value={gasToken}
          onChange={(e) => setGasToken(e.target.value)}
          placeholder="Token rahasia Anda"
          style={{
            ...inputStyle,
            marginTop: '4px',
            opacity: isLocked ? 0.65 : 1,
            cursor: isLocked ? 'not-allowed' : 'text',
            borderColor: isLocked ? 'var(--border)' : '#10b981'
          }}
        />
      </label>

      {/* Control Admin: Hanya tampil jika isAdmin === true */}
      {isAdmin && (
        <div
          onClick={() => {
            const nextVal = !hideInOtherApps;
            setHideInOtherApps(nextVal);
            invoke('set_sync_config', {
              syncMethod: 'gas',
              workerUrl: '',
              gasUrl,
              gasToken,
              hideSyncMenuInOtherApps: nextVal
            }).then(() => onSaved()).catch(() => {});
          }}
          style={{
            padding: '10px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            borderRadius: '4px',
            marginTop: '4px'
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              🙈 Sembunyikan Menu Sinkronisasi dari Aplikasi Lain
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Menu 🔗 Sinkronisasi di Billing, Ops, &amp; Files akan disembunyikan di seluruh PC lain.
            </div>
          </div>
          <input
            type="checkbox"
            checked={hideInOtherApps}
            onChange={(e) => {
              e.stopPropagation();
              const nextVal = e.target.checked;
              setHideInOtherApps(nextVal);
              invoke('set_sync_config', {
                syncMethod: 'gas',
                workerUrl: '',
                gasUrl,
                gasToken,
                hideSyncMenuInOtherApps: nextVal
              }).then(() => onSaved()).catch(() => {});
            }}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>
      )}

      {!isLocked && (
        <button onClick={save} disabled={saving} style={btnPrimaryStyle}>
          {saving ? 'Menyimpan...' : '💾 Simpan Konfigurasi Baru'}
        </button>
      )}

      {/* Panduan Setup */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
          <span>📖</span> Panduan Singkat Hubungkan Google Apps Script
        </h4>
        <div style={{ padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: '12px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <ol style={{ paddingLeft: '18px', margin: 0 }}>
            <li>Buka <strong>Google Sheets</strong> Anda → <strong>Ekstensi</strong> → <strong>Apps Script</strong>.</li>
            <li>Salin seluruh kode dari berkas <code>docs/google-apps-script/code.js</code> dan paste ke editor script.</li>
            <li>Klik tombol <strong>Deploy</strong> → <strong>Deployment Baru (New deployment)</strong>.</li>
            <li>Setel <em>Jalankan Sebagai (Execute as)</em>: <strong>Saya (Email Anda)</strong>.</li>
            <li>Setel <em>Siapa yang memiliki akses (Who has access)</em>: <strong>Siapa saja (Anyone)</strong>.</li>
            <li>Klik <strong>Deploy</strong>, lalu salin <strong>URL Web App</strong> yang dihasilkan (berakhiran <code>/exec</code>).</li>
            <li>Tempelkan URL tersebut pada kolom di atas, lalu klik <strong>Simpan Konfigurasi</strong>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', marginBottom: '10px', borderRadius: '0px',
  border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
};
const btnPrimaryStyle: React.CSSProperties = {
  width: '100%', padding: '10px', borderRadius: '0px', border: 'none',
  background: '#10b981', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};
const btnSecondaryStyle: React.CSSProperties = {
  padding: '8px 14px', borderRadius: '0px', border: '1px solid var(--border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer',
};
