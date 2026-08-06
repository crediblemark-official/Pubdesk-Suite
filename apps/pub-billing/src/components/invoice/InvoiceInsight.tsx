import React, { useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { formatPrice } from '../../utils/format';
import { getInvoiceMetadata } from '../../utils/invoice';

interface InvoiceInsightProps {
  hideHeader?: boolean;
  padding?: string;
  height?: string;
  overflowY?: 'auto' | 'hidden' | 'scroll' | 'visible';
  variant?: 'standalone' | 'dashboard';
}

const InvoiceInsight: React.FC<InvoiceInsightProps> = ({
  hideHeader = false,
  padding = '20px',
  height = '100%',
  overflowY = 'auto',
  variant = 'standalone'
}) => {
  const { 
    invoices, 
    selectedInsightMetric, 
    setSelectedInsightMetric, 
    setRightPanelVisible 
  } = useAppContext();

  const isDashboard = variant === 'dashboard';

  const stats = useMemo(() => {
    let totalLunas = 0;
    let totalBelumLunas = 0;
    let totalDp = 0;
    let totalBermasalah = 0;
    let countLunas = 0;
    let countBelumLunas = 0;
    let countDp = 0;
    let countBermasalah = 0;
    const uniqueCustomers = new Set();

    invoices.forEach((inv) => {
      const metadata = getInvoiceMetadata(inv);
      const status = metadata.paymentStatus || 'BERMASALAH';
      
      const customerName = (metadata.customerName || 'Umum').trim();
      if (customerName && customerName !== '-') {
        uniqueCustomers.add(customerName.toLowerCase());
      }

      if (status === 'LUNAS') {
        totalLunas += inv.total;
        countLunas++;
      } else if (status === 'BELUM LUNAS') {
        totalBelumLunas += inv.total;
        countBelumLunas++;
      } else if (status === 'DP') {
        const paid = Number(metadata.paidAmount ?? (inv as any).paid_amount ?? 0);
        if (paid > 0 && paid < inv.total) {
          totalDp += paid;
          totalBelumLunas += (inv.total - paid);
        } else {
          totalDp += inv.total;
        }
        countDp++;
      } else {
        totalBermasalah += inv.total;
        countBermasalah++;
      }
    });

    const grandTotal = totalLunas + totalBelumLunas + totalDp + totalBermasalah;
    const totalCount = invoices.length;

    return {
      count: totalCount,
      lunas: totalLunas,
      belumLunas: totalBelumLunas,
      dp: totalDp,
      bermasalah: totalBermasalah,
      grandTotal,
      countLunas,
      countBelumLunas,
      countDp,
      countBermasalah,
      uniqueCustomersCount: uniqueCustomers.size
    };
  }, [invoices]);

  // Persentase pembulatan rasio keuangan
  const percentLunas = stats.grandTotal > 0 ? (stats.lunas / stats.grandTotal) * 100 : 0;
  const percentBelumLunas = stats.grandTotal > 0 ? (stats.belumLunas / stats.grandTotal) * 100 : 0;
  const percentDp = stats.grandTotal > 0 ? (stats.dp / stats.grandTotal) * 100 : 0;
  const percentBermasalah = stats.grandTotal > 0 ? (stats.bermasalah / stats.grandTotal) * 100 : 0;

  // Visualisasi lingkaran SVG
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  // Rumus panjang busur SVG strokeDasharray
  const strokeLengthLunas = (percentLunas / 100) * circumference;
  const strokeLengthBelumLunas = (percentBelumLunas / 100) * circumference;
  const strokeLengthDp = (percentDp / 100) * circumference;
  const strokeLengthBermasalah = (percentBermasalah / 100) * circumference;

  // Sudut rotasi kumulatif
  const rotateBelumLunas = percentLunas * 3.6;
  const rotateDp = (percentLunas + percentBelumLunas) * 3.6;
  const rotateBermasalah = (percentLunas + percentBelumLunas + percentDp) * 3.6;

  const handleMetricClick = (metric: 'total' | 'lunas' | 'belum_lunas' | 'bermasalah' | 'dp') => {
    setSelectedInsightMetric(metric);
    setRightPanelVisible(true);
  };

  const cardData = [
    {
      key: 'total' as const,
      label: 'Total Invoice Terbit',
      value: `${stats.count} Lembar`,
      subText: <>Akumulasi omzet kotor: <strong>{formatPrice(stats.grandTotal)}</strong></>,
      color: 'var(--accent)',
      colorLight: 'rgba(59, 130, 246, 0.04)',
      clickable: true,
    },
    {
      key: 'lunas' as const,
      label: 'Total Dana Diterima (Lunas)',
      value: formatPrice(stats.lunas),
      subText: <>Dari <strong>{stats.countLunas}</strong> invoice lunas</>,
      color: '#16a34a',
      colorLight: 'rgba(22, 163, 74, 0.08)',
      clickable: true,
    },
    {
      key: 'belum_lunas' as const,
      label: 'Total Piutang (Belum Lunas)',
      value: formatPrice(stats.belumLunas),
      subText: <>Dari <strong>{stats.countBelumLunas}</strong> invoice belum lunas</>,
      color: '#dc2626',
      colorLight: 'rgba(220, 38, 38, 0.08)',
      clickable: true,
    },
    {
      key: 'dp' as const,
      label: 'Total Pembayaran DP',
      value: formatPrice(stats.dp),
      subText: <>Dari <strong>{stats.countDp}</strong> invoice DP</>,
      color: '#2563eb',
      colorLight: 'rgba(37, 99, 235, 0.08)',
      clickable: true,
    },
    {
      key: 'bermasalah' as const,
      label: 'Total Dana Bermasalah',
      value: formatPrice(stats.bermasalah),
      subText: <>Dari <strong>{stats.countBermasalah}</strong> invoice bermasalah</>,
      color: '#d97706',
      colorLight: 'rgba(217, 119, 6, 0.08)',
      clickable: true,
    },
    {
      key: 'average' as const,
      label: 'Rata-Rata Nilai Invoice',
      value: formatPrice(stats.count > 0 ? stats.grandTotal / stats.count : 0),
      subText: <>Nilai rata-rata per lembar tagihan</>,
      color: '#8b5cf6',
      colorLight: 'rgba(139, 92, 246, 0.04)',
      clickable: false,
    },
    {
      key: 'ratio' as const,
      label: 'Rasio Pelunasan',
      value: `${(stats.grandTotal > 0 ? ((stats.lunas + stats.dp) / stats.grandTotal) * 100 : 0).toFixed(1)}%`,
      subText: <>Persentase pelunasan dari omzet</>,
      color: '#6366f1',
      colorLight: 'rgba(99, 102, 241, 0.04)',
      clickable: false,
    },
    {
      key: 'unique_customers' as const,
      label: 'Mitra & Pelanggan Unik',
      value: `${stats.uniqueCustomersCount} Pelanggan`,
      subText: <>Jumlah kontak bisnis aktif</>,
      color: '#06b6d4',
      colorLight: 'rgba(6, 182, 212, 0.04)',
      clickable: false,
    },
  ];

  return (
    <div className="invoice-insight" style={{ padding: isDashboard ? '0' : padding, display: 'flex', flexDirection: 'column', height, overflowY, gap: isDashboard ? '0' : '20px' }}>
      {!hideHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>📊 Analisis & Statistik Invoice</h1>
        </div>
      )}

      {/* Ringkasan Statistik Kartu */}
      <div 
        style={
          isDashboard
            ? {
                display: 'flex',
                flexWrap: 'wrap',
                background: 'var(--bg-card)',
                borderBottom: '1px solid var(--border)',
                borderRadius: '0px',
                overflow: 'hidden',
                boxSizing: 'border-box',
                flexShrink: 0
              }
            : {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                flexShrink: 0
              }
        }
      >
        {cardData.map((card) => {
          const isSelected = selectedInsightMetric === card.key;
          
          const cardStyle: React.CSSProperties = isDashboard
            ? {
                flex: '1 1 25%',
                minWidth: '220px',
                padding: '20px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                boxSizing: 'border-box',
                borderRadius: '0px',
                background: isSelected ? card.colorLight : 'transparent',
                cursor: card.clickable ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              }
            : {
                background: isSelected ? card.colorLight : 'var(--bg-panel)',
                border: isSelected ? `2px solid ${card.color}` : '1px solid var(--border)',
                borderRadius: '12px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: isSelected ? `0 4px 12px ${card.color}15` : '0 2px 8px rgba(0,0,0,0.02)',
                cursor: card.clickable ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                transform: isSelected ? 'translateY(-2px)' : 'none',
              };

          return (
            <div
              key={card.key}
              onClick={() => {
                if (card.clickable) {
                  handleMetricClick(card.key as any);
                }
              }}
              style={cardStyle}
              onMouseEnter={(e) => {
                if (!isDashboard) {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                  if (!isSelected) e.currentTarget.style.borderColor = card.color;
                } else if (card.clickable && !isSelected) {
                  e.currentTarget.style.background = 'var(--bg-panel)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDashboard) {
                  e.currentTarget.style.boxShadow = isSelected ? `0 4px 12px ${card.color}15` : '0 2px 8px rgba(0,0,0,0.02)';
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)';
                } else if (card.clickable && !isSelected) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {isDashboard && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: card.color
                }} />
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: isDashboard ? '4px' : '0' }}>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  textTransform: 'uppercase', 
                  color: isDashboard ? 'var(--text-secondary)' : isSelected ? card.color : 'var(--text-secondary)',
                  letterSpacing: isDashboard ? '0.5px' : 'normal'
                }}>
                  {card.label}
                </span>
                {isDashboard && (
                  <span style={{ fontSize: '18px' }}>
                    {card.key === 'total' && '🧾'}
                    {card.key === 'lunas' && '💰'}
                    {card.key === 'belum_lunas' && '🚨'}
                    {card.key === 'dp' && '💳'}
                    {card.key === 'bermasalah' && '⚠️'}
                    {card.key === 'average' && '📈'}
                    {card.key === 'ratio' && '🎯'}
                    {card.key === 'unique_customers' && '👤'}
                  </span>
                )}
              </div>
              
              <strong style={{ 
                fontSize: '24px', 
                color: isDashboard ? 'var(--text-primary)' : card.clickable && card.key !== 'total' ? card.color : 'var(--text-primary)' 
              }}>
                {card.value}
              </strong>
              
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {card.subText}
              </span>
            </div>
          );
        })}
      </div>

      {/* Visualisasi Analytics Section */}
      <div style={isDashboard ? { padding: '24px 24px 0 24px', display: 'flex', flexDirection: 'column', gap: '20px' } : undefined}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', flexShrink: 0 }}>
          
          {/* Distribusi Pembayaran Donut Chart */}
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>📊 Distribusi Keuangan</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '20px', padding: '10px 0' }}>
              {/* SVG Donat */}
              <div style={{ position: 'relative', width: '150px', height: '150px' }}>
                <svg width="100%" height="100%" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background circle */}
                  <circle cx="60" cy="60" r={radius} fill="transparent" stroke="var(--border)" strokeWidth="12" />
                  
                  {/* Lunas segment (Green) - rotasi = 0 */}
                  {stats.lunas > 0 && (
                    <circle 
                      cx="60" 
                      cy="60" 
                      r={radius} 
                      fill="transparent" 
                      stroke="#16a34a" 
                      strokeWidth={selectedInsightMetric === 'lunas' ? '16' : '12'} 
                      strokeDasharray={`${strokeLengthLunas} ${circumference}`}
                      strokeDashoffset="0"
                      style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                      onClick={() => handleMetricClick('lunas')}
                    />
                  )}
                  
                  {/* Belum Lunas segment (Red) - rotasi = percentLunas * 3.6 */}
                  {stats.belumLunas > 0 && (
                    <circle 
                      cx="60" 
                      cy="60" 
                      r={radius} 
                      fill="transparent" 
                      stroke="#dc2626" 
                      strokeWidth={selectedInsightMetric === 'belum_lunas' ? '16' : '12'} 
                      strokeDasharray={`${strokeLengthBelumLunas} ${circumference}`}
                      strokeDashoffset="0"
                      style={{ 
                        transform: `rotate(${rotateBelumLunas}deg)`, 
                        transformOrigin: '60px 60px', 
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleMetricClick('belum_lunas')}
                    />
                  )}

                  {/* DP segment (Blue) - rotasi = (percentLunas + percentBelumLunas) * 3.6 */}
                  {stats.dp > 0 && (
                    <circle 
                      cx="60" 
                      cy="60" 
                      r={radius} 
                      fill="transparent" 
                      stroke="#2563eb" 
                      strokeWidth={selectedInsightMetric === 'dp' ? '16' : '12'} 
                      strokeDasharray={`${strokeLengthDp} ${circumference}`}
                      strokeDashoffset="0"
                      style={{ 
                        transform: `rotate(${rotateDp}deg)`, 
                        transformOrigin: '60px 60px', 
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleMetricClick('dp')}
                    />
                  )}

                  {/* Bermasalah segment (Orange/Yellow) - rotasi = (percentLunas + percentBelumLunas + percentDp) * 3.6 */}
                  {stats.bermasalah > 0 && (
                    <circle 
                      cx="60" 
                      cy="60" 
                      r={radius} 
                      fill="transparent" 
                      stroke="#d97706" 
                      strokeWidth={selectedInsightMetric === 'bermasalah' ? '16' : '12'} 
                      strokeDasharray={`${strokeLengthBermasalah} ${circumference}`}
                      strokeDashoffset="0"
                      style={{ 
                        transform: `rotate(${rotateBermasalah}deg)`, 
                        transformOrigin: '60px 60px', 
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleMetricClick('bermasalah')}
                    />
                  )}
                </svg>
                
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Lunas</span>
                  <strong style={{ fontSize: '18px', color: '#16a34a' }}>{percentLunas.toFixed(0)}%</strong>
                </div>
              </div>

              {/* Keterangan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div 
                  onClick={() => handleMetricClick('lunas')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: selectedInsightMetric && selectedInsightMetric !== 'lunas' ? 0.6 : 1 }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#16a34a', display: 'inline-block' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Lunas ({percentLunas.toFixed(1)}%)</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{formatPrice(stats.lunas)}</strong>
                  </div>
                </div>
                <div 
                  onClick={() => handleMetricClick('belum_lunas')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: selectedInsightMetric && selectedInsightMetric !== 'belum_lunas' ? 0.6 : 1 }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#dc2626', display: 'inline-block' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Belum Lunas ({percentBelumLunas.toFixed(1)}%)</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{formatPrice(stats.belumLunas)}</strong>
                  </div>
                </div>
                <div 
                  onClick={() => handleMetricClick('dp')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: selectedInsightMetric && selectedInsightMetric !== 'dp' ? 0.6 : 1 }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#2563eb', display: 'inline-block' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>DP ({percentDp.toFixed(1)}%)</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{formatPrice(stats.dp)}</strong>
                  </div>
                </div>
                <div 
                  onClick={() => handleMetricClick('bermasalah')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: selectedInsightMetric && selectedInsightMetric !== 'bermasalah' ? 0.6 : 1 }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#d97706', display: 'inline-block' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Bermasalah ({percentBermasalah.toFixed(1)}%)</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{formatPrice(stats.bermasalah)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Indikator Status & Kesehatan Penagihan */}
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>📈 Kesehatan Penagihan</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Persentase Pembayaran Berhasil</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{percentLunas.toFixed(1)}%</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${percentLunas}%`, height: '100%', background: '#16a34a', borderRadius: '4px' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Persentase Tunggakan Aktif</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{(percentBelumLunas + percentBermasalah).toFixed(1)}%</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${percentBelumLunas + percentBermasalah}%`, height: '100%', background: '#dc2626', borderRadius: '4px' }} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Rasio Kolektibilitas Layak:</span>
                  <strong style={{ color: percentLunas >= 80 ? '#16a34a' : '#d97706' }}>
                    {percentLunas >= 80 ? 'Sangat Baik' : percentLunas >= 50 ? 'Cukup Baik' : 'Perlu Perhatian'}
                  </strong>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  * Semakin tinggi tingkat persentase pembayaran berhasil, semakin sehat arus kas unit usaha penerbitan buku Anda.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default InvoiceInsight;
