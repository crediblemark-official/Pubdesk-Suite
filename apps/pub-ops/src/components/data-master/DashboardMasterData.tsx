import React, { useMemo } from 'react';
import { useDataMasterContext } from '../../contexts/DataMasterContext';
import { useAppContext } from '../../contexts/AppContext';

const CARDS_CONFIG = [
  { key: 'penulis', label: 'Kontak & Penulis', color: '#3b82f6', icon: '👤', module: 'kontak' as const, desc: 'Kelola database penulis & kontak pelanggan' },
  { key: 'penerbit', label: 'Penerbit', color: '#10b981', icon: '🏢', module: 'penerbit' as const, desc: 'Kelola data instansi & penerbit mitra' },
  { key: 'naskah', label: 'Buku & Naskah', color: '#f59e0b', icon: '📚', module: 'naskah' as const, desc: 'Pantau katalog buku & pesanan naskah masuk' },
  { key: 'legalitas', label: 'Legalitas', color: '#ec4899', icon: '⚖️', module: 'legalitas' as const, desc: 'Kelola dokumen perjanjian & MoU' },
  { key: 'services', label: 'Layanan & Jasa', color: '#06b6d4', icon: '🛠️', module: 'services' as const, desc: 'Daftar layanan operasional penerbitan' },
] as const;

const DashboardMasterData: React.FC = () => {
  const { penulis, penerbit, naskah, legalitas } = useDataMasterContext();
  const { services, books, setActiveModule } = useAppContext();

  const counts = useMemo(() => ({
    penulis: penulis.length,
    penerbit: penerbit.length,
    naskah: naskah.length + (books ? books.length : 0),
    legalitas: legalitas.length,
    services: services.length,
  }), [penulis, penerbit, naskah, books, legalitas, services]);

  const totalData = Object.values(counts).reduce((acc, curr) => acc + curr, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-dark)' }}>
      {/* Header Bar Seragam */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        height: 44,
        boxSizing: 'border-box',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🗃️</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Dashboard Master Data</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Kelola entitas data utama pendukung alur kerja dan operasional penerbitan.
        </span>
      </div>

      {/* Konten Dashboard yang scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Grid Summary Info Cards terpadu tanpa space/gap dan siku */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap',
        background: 'var(--bg-card)', 
        borderBottom: '1px solid var(--border)', 
        borderRadius: '0px', 
        overflow: 'hidden',
        boxSizing: 'border-box',
        flexShrink: 0
      }}>
        {CARDS_CONFIG.map(card => {
          const count = counts[card.key];
          return (
            <div
              key={card.key}
              onClick={() => setActiveModule(card.module)}
              style={{
                flex: '1 1 33.33%',
                minWidth: '250px',
                padding: '20px',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                transition: 'all 0.2s ease-in-out',
                overflow: 'hidden',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-panel)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Background gradient subtle */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                background: `radial-gradient(circle, ${card.color}15 0%, transparent 70%)`,
                pointerEvents: 'none'
              }} />

              {/* Garis aksen warna kecil di sisi atas */}
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                height: '3px', 
                background: card.color 
              }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '28px' }}>{card.icon}</span>
                <span style={{ 
                  fontSize: '28px', 
                  fontWeight: '700', 
                  color: 'var(--text-primary)' 
                }}>
                  {count}
                </span>
              </div>

              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                  {card.label}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  {card.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Distribusi Data */}
      <div style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '24px',
        boxSizing: 'border-box'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 20px 0' }}>
          📊 Distribusi Kategori Master Data
        </h3>

        {totalData === 0 ? (
          <div style={{ padding: '40px 0', color: 'var(--text-secondary)' }}>
            Tidak ada data master yang terdaftar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {CARDS_CONFIG.map(card => {
              const count = counts[card.key];
              const percentage = totalData > 0 ? (count / totalData) * 100 : 0;
              return (
                <div key={card.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{card.label}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <strong>{count}</strong> ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  {/* Progress Bar Container */}
                  <div style={{ 
                    height: '8px', 
                    background: 'var(--bg-panel)', 
                    borderRadius: '4px', 
                    overflow: 'hidden' 
                  }}>
                    {/* Active Progress */}
                    <div style={{ 
                      width: `${percentage}%`, 
                      height: '100%', 
                      background: card.color, 
                      borderRadius: '4px',
                      transition: 'width 0.4s ease-in-out'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Petunjuk Penggunaan */}
      <div style={{
        background: 'var(--bg-card)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxSizing: 'border-box'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
          💡 Informasi Master Data
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
          Halaman Master Data menyimpan relasi entitas inti sistem. Pastikan untuk selalu memperbarui data kontak penulis, perjanjian legalitas, serta tim produksi agar proses otomatisasi invoice dan alokasi tugas berjalan lancar.
        </p>
        <div style={{ 
          padding: '12px', 
          borderRadius: '0px', 
          background: 'var(--bg-panel)', 
          borderLeft: '4px solid var(--accent)',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <strong>Tip Impor:</strong> Anda bisa mengimpor data massal melalui dokumen Excel dari sub-menu masing-masing.
        </div>
      </div>
    </div>
  </div>
);
};

export default DashboardMasterData;
