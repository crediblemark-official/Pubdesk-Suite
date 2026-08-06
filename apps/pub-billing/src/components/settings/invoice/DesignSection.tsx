import React from 'react';
import { useSettingsForm } from './SettingsFormContext';
import { useAppContext } from '../../../contexts/AppContext';

const DesignSection: React.FC = () => {
  const {
    profileName,
    setProfileName,
    tableType,
    setTableType,
    accentColor,
    setAccentColor,
    accentColorDark,
    setAccentColorDark,
    headerPrimaryColor,
    setHeaderPrimaryColor,
    headerSecondaryColor,
    setHeaderSecondaryColor,
    headerBgColor,
    setHeaderBgColor,
    footerBgColor,
    setFooterBgColor,
    footerPrimaryColor,
    setFooterPrimaryColor,
    footerSecondaryColor,
    setFooterSecondaryColor,
    watermarkColor,
    setWatermarkColor,
    watermarkOpacity,
    setWatermarkOpacity,
    tableHeaderBg,
    setTableHeaderBg,
    tableHeaderNoBg,
    setTableHeaderNoBg,
    tableHeaderTextColor,
    setTableHeaderTextColor,
    tableBodyTextColor,
    setTableBodyTextColor,
    tableRowEvenBg,
    setTableRowEvenBg,
    tableRowOddBg,
    setTableRowOddBg,
    tableBorderColor,
    setTableBorderColor
  } = useSettingsForm();

  const { rightPanelVisible } = useAppContext();

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: rightPanelVisible ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="compact-form-group">
          <label className="compact-label">Nama Profil (Internal)</label>
          <input
            type="text"
            className="compact-input"
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            value={profileName}
            onChange={(e) => {
              const val = e.target.value;
              setProfileName(val);
              const clean = val
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');
              setTableType(clean);
            }}
            placeholder="Contoh: Profil Cetak Kustom"
          />
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Kode Tipe Tabel (bebas, untuk identifikasi)</label>
          <input
            type="text"
            className="compact-input"
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            value={tableType}
            onChange={(e) => setTableType(e.target.value)}
            placeholder="Contoh: layanan_desain, cetak_buku, haki, dll."
          />
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Aksen Utama</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder="#1e70cd"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Aksen Gelap</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={accentColorDark}
              onChange={(e) => setAccentColorDark(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={accentColorDark}
              onChange={(e) => setAccentColorDark(e.target.value)}
              placeholder="#1e3a8a"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Utama Header SVG (Kiri)</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={headerPrimaryColor}
              onChange={(e) => setHeaderPrimaryColor(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={headerPrimaryColor}
              onChange={(e) => setHeaderPrimaryColor(e.target.value)}
              placeholder="#d93838"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Aksen Header SVG (Tengah)</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={headerSecondaryColor}
              onChange={(e) => setHeaderSecondaryColor(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={headerSecondaryColor}
              onChange={(e) => setHeaderSecondaryColor(e.target.value)}
              placeholder="#d93838"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Latar Header SVG (Kanan)</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={headerBgColor}
              onChange={(e) => setHeaderBgColor(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={headerBgColor}
              onChange={(e) => setHeaderBgColor(e.target.value)}
              placeholder="#222933"
            />
          </div>
        </div>

         <div className="compact-form-group">
           <label className="compact-label">Warna Latar Footer SVG (Kiri)</label>
           <div style={{ display: 'flex', gap: '6px' }}>
             <input
               type="color"
               style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
               value={footerBgColor}
               onChange={(e) => setFooterBgColor(e.target.value)}
             />
             <input
               type="text"
               className="compact-input"
               style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
               value={footerBgColor}
               onChange={(e) => setFooterBgColor(e.target.value)}
               placeholder="#222933"
             />
           </div>
         </div>

         <div className="compact-form-group">
           <label className="compact-label">Warna Utama Footer SVG (Kanan)</label>
           <div style={{ display: 'flex', gap: '6px' }}>
             <input
               type="color"
               style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
               value={footerPrimaryColor}
               onChange={(e) => setFooterPrimaryColor(e.target.value)}
             />
             <input
               type="text"
               className="compact-input"
               style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
               value={footerPrimaryColor}
               onChange={(e) => setFooterPrimaryColor(e.target.value)}
               placeholder="#d93838"
             />
           </div>
         </div>

         <div className="compact-form-group">
           <label className="compact-label">Warna Aksen Footer SVG (Tengah)</label>
           <div style={{ display: 'flex', gap: '6px' }}>
             <input
               type="color"
               style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
               value={footerSecondaryColor}
               onChange={(e) => setFooterSecondaryColor(e.target.value)}
             />
             <input
               type="text"
               className="compact-input"
               style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
               value={footerSecondaryColor}
               onChange={(e) => setFooterSecondaryColor(e.target.value)}
               placeholder="#d93838"
             />
           </div>
         </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Watermark (Kosongkan untuk otomatis)</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={watermarkColor || '#cccccc'}
              onChange={(e) => setWatermarkColor(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={watermarkColor}
              onChange={(e) => setWatermarkColor(e.target.value)}
              placeholder="Gunakan warna bawaan status"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Opasitas Watermark ({watermarkOpacity}%)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '32px' }}>
            <input
              type="range"
              min="0"
              max="100"
              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              value={watermarkOpacity}
              onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
            />
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', width: '36px', textAlign: 'right' }}>
              {watermarkOpacity}%
            </span>
          </div>
        </div>

        {/* Separator / Section Header for Table Colors */}
        <div style={{ gridColumn: rightPanelVisible ? undefined : '1 / -1', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            📊 Pengaturan Warna Tabel Invoice
          </h4>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Header Tabel (Kolom Utama)</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={tableHeaderBg}
              onChange={(e) => setTableHeaderBg(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={tableHeaderBg}
              onChange={(e) => setTableHeaderBg(e.target.value)}
              placeholder="#1e70cd"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Header Tabel (Kolom No)</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={tableHeaderNoBg}
              onChange={(e) => setTableHeaderNoBg(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={tableHeaderNoBg}
              onChange={(e) => setTableHeaderNoBg(e.target.value)}
              placeholder="#1e3a8a"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Teks Header Tabel</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={tableHeaderTextColor}
              onChange={(e) => setTableHeaderTextColor(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={tableHeaderTextColor}
              onChange={(e) => setTableHeaderTextColor(e.target.value)}
              placeholder="#ffffff"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Teks Isi Tabel & Catatan</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={tableBodyTextColor}
              onChange={(e) => setTableBodyTextColor(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={tableBodyTextColor}
              onChange={(e) => setTableBodyTextColor(e.target.value)}
              placeholder="#000000"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Latar Baris Genap (Zebra)</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={tableRowEvenBg}
              onChange={(e) => setTableRowEvenBg(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={tableRowEvenBg}
              onChange={(e) => setTableRowEvenBg(e.target.value)}
              placeholder="#fdf2f2"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Latar Baris Ganjil</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={tableRowOddBg}
              onChange={(e) => setTableRowOddBg(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={tableRowOddBg}
              onChange={(e) => setTableRowOddBg(e.target.value)}
              placeholder="#ffffff"
            />
          </div>
        </div>

        <div className="compact-form-group">
          <label className="compact-label">Warna Garis Pembatas Tabel</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="color"
              style={{ width: '32px', height: '32px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer' }}
              value={tableBorderColor}
              onChange={(e) => setTableBorderColor(e.target.value)}
            />
            <input
              type="text"
              className="compact-input"
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              value={tableBorderColor}
              onChange={(e) => setTableBorderColor(e.target.value)}
              placeholder="#e5e7eb"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default DesignSection;
