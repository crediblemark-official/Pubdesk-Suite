import React from 'react';
import { useSettingsForm } from './SettingsFormContext';
import { useAppContext } from '../../../contexts/AppContext';

const SignatureSection: React.FC = () => {
  const {
    signatureOffice,
    setSignatureOffice,
    signatureLocation,
    setSignatureLocation,
    signatureRole,
    setSignatureRole,
    signatureName,
    setSignatureName,
    signatureImg,
    setSignatureImg,
    signatureSpacing,
    setSignatureSpacing,
    showDefaultSignature,
    setShowDefaultSignature
  } = useSettingsForm();

  const { showToast, rightPanelVisible } = useAppContext();

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: rightPanelVisible ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="compact-form-group">
          <label className="compact-label">Instansi / Nama Kantor</label>
          <input
            type="text"
            className="compact-input"
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            value={signatureOffice}
            onChange={(e) => setSignatureOffice(e.target.value)}
            placeholder="Contoh: Kantor Penerbit Yogyakarta"
          />
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Lokasi Tanda Tangan</label>
          <input
            type="text"
            className="compact-input"
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            value={signatureLocation}
            onChange={(e) => setSignatureLocation(e.target.value)}
            placeholder="Contoh: Yogyakarta"
          />
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Jabatan Penandatangan</label>
          <input
            type="text"
            className="compact-input"
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            value={signatureRole}
            onChange={(e) => setSignatureRole(e.target.value)}
            placeholder="Contoh: CEO Penerbit"
          />
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Nama Lengkap & Gelar</label>
          <input
            type="text"
            className="compact-input"
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Contoh: RUDI HARTONO, M.Kom."
          />
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Gambar Tanda Tangan (PNG Transparan)</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {signatureImg && (
              <div style={{ position: 'relative', width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={signatureImg} alt="Tanda Tangan" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                <button 
                  type="button" 
                  onClick={() => setSignatureImg('')} 
                  style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '0 0 0 4px', cursor: 'pointer', fontSize: '8px', padding: '1px 2px' }}
                  title="Hapus Tanda Tangan"
                >
                  ✕
                </button>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 1024 * 1024) {
                      showToast('Ukuran berkas tanda tangan terlalu besar (maksimal 1MB)!', 'error');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setSignatureImg(event.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ display: 'none' }}
                id="signature-upload-input"
              />
              <label 
                htmlFor="signature-upload-input" 
                className="btn-secondary compact-btn" 
                style={{ cursor: 'pointer', textAlign: 'center', display: 'block', height: '32px', lineHeight: '20px' }}
              >
                {signatureImg ? 'Ubah Gambar' : 'Unggah Gambar'}
              </label>
            </div>
          </div>
        </div>

        {/* Toggle: Tampilkan TTD Default (hanya relevan jika tidak ada gambar) */}
        {!signatureImg && (
          <div className="compact-form-group">
            <label className="compact-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showDefaultSignature}
                onChange={(e) => setShowDefaultSignature(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Tampilkan TTD Kursif Default
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Jika dinonaktifkan, area tanda tangan akan kosong saat tidak ada gambar TTD
            </span>
          </div>
        )}

        {/* Slider: Jarak antara Nama/Tanggal dan TTD */}
        <div className="compact-form-group" style={{ gridColumn: rightPanelVisible ? undefined : '1 / -1' }}>
          <label className="compact-label">Jarak Nama & Tanggal ke TTD ({signatureSpacing}px)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={signatureSpacing}
              onChange={(e) => setSignatureSpacing(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <input
              type="number"
              min={0}
              max={100}
              value={signatureSpacing}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                setSignatureSpacing(val);
              }}
              className="compact-input"
              style={{ width: '56px', textAlign: 'center', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default SignatureSection;

