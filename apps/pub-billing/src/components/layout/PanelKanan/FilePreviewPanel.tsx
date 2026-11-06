import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../../../contexts/AppContext';
import { useFileState } from '../../../contexts/FileContext';
import { useInvoiceContext } from '../../../contexts/InvoiceContext';
import { useDataMasterContext } from '../../../contexts/DataMasterContext';
import InvoicePreview from '../../invoice/InvoicePreview';
import { parseModifiedBy, formatBytes, getMimeLabel } from '../../../utils/gdrive';
import { formatPrice } from '../../../utils/format';

interface FilePreviewPanelProps {
  /** ID berkas yang dipilih */
  selectedFileId: number | null;
}

/**
 * Panel kanan untuk konteks modul Smart Folders dan Manajemen Invoice.
 * Menampilkan preview berkas (lokal, GDrive, atau invoice PDF).
 */
const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({ selectedFileId }) => {
  const {
    invoices,
    showToast,
    refreshAccessToken,
    gdriveAccounts,
    refreshAccountToken,
    setActiveModule,
  } = useAppContext();

  const {
    files,
    updateFile,
    addFileTag,
    removeFileTag,
    getFileTags,
    previewInvoiceId,
  } = useFileState();

  const { loadInvoiceToForm } = useInvoiceContext();
  const { tim } = useDataMasterContext();

  const [fileMetadata, setFileMetadata] = useState<any | null>(null);
  const [relatedFiles, setRelatedFiles] = useState<any[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'inspector'>('preview');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [selectedTimId, setSelectedTimId] = useState<number | ''>('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [invoiceTimeline, setInvoiceTimeline] = useState<any[]>([]);

  const currentFileSelected = files.find(f => f.id === selectedFileId);

  useEffect(() => {
    setActiveTab('preview');
  }, [selectedFileId]);

  useEffect(() => {
    if (currentFileSelected) {
      setDescriptionInput(currentFileSelected.description || '');
    } else {
      setDescriptionInput('');
    }
  }, [selectedFileId, currentFileSelected?.id, currentFileSelected?.description]);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!selectedFileId) {
        setFileMetadata(null);
        setRelatedFiles([]);
        setCurrentTags([]);
        return;
      }

      const file = files.find(f => f.id === selectedFileId);
      if (!file) return;

      setFileMetadata(null);
      setRelatedFiles([]);
      setCurrentTags([]);

      // Service dan GDrive tidak didukung di penganalisis teks lokal
      if (file.type === 'service' || file.type === 'gdrive') {
        return;
      }

      // Invoice: data metadata sudah dari sintetis dan files array — skip backend call
      if (file.type === 'invoice') {
        setLoadingMetadata(false);
        return;
      }

      setLoadingMetadata(true);
      try {
        // 1. Ambil tag berkas (didukung semua berkas di SQLite)
        try {
          const tags = await getFileTags(selectedFileId);
          setCurrentTags(tags || []);
        } catch (err) {
          console.error('Gagal mengambil tag:', err);
        }

        // 2. Ambil metadata semantik
        try {
          const metadata = await invoke<any>('get_file_metadata', { fileId: selectedFileId });
          setFileMetadata(metadata);
        } catch (err) {
          console.error('Gagal mengambil metadata semantik:', err);
        }

        // 3. Ambil berkas terkait
        try {
          const related = await invoke<any[]>('get_related_files', { fileId: selectedFileId });
          setRelatedFiles(related || []);
        } catch (err) {
          console.error('Gagal mengambil berkas terkait:', err);
        }
      } catch (err) {
        console.error('Gagal memuat metadata berkas:', err);
      } finally {
        setLoadingMetadata(false);
      }
    };

    fetchMetadata();
  }, [selectedFileId, files]);

  // Ambil timeline invoice (riwayat status pembayaran, pembuatan, dll)
  useEffect(() => {
    const fetchTimeline = async () => {
      // Cari invoice ID dari selectedFileId atau previewInvoiceId
      let invoiceId: number | null = null;
      if (selectedFileId) {
        const file = files.find(f => f.id === selectedFileId);
        if (file?.type === 'invoice' && file.version_label) {
          invoiceId = parseInt(file.version_label);
        }
      } else if (previewInvoiceId) {
        invoiceId = previewInvoiceId;
      }

      if (!invoiceId) {
        setInvoiceTimeline([]);
        return;
      }

      try {
        const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
        const timeline = await tauriInvoke<any[]>('get_invoice_timeline', { invoiceId });
        setInvoiceTimeline(timeline || []);
      } catch (err) {
        console.error('Gagal mengambil timeline invoice:', err);
        setInvoiceTimeline([]);
      }
    };
    fetchTimeline();
  }, [selectedFileId, previewInvoiceId, files]);

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim() || !selectedFileId) return;
    let tag = newTagInput.trim();
    if (!tag.startsWith('#')) tag = '#' + tag;
    try {
      await addFileTag(selectedFileId, tag);
      setCurrentTags(prev => [...prev.filter(t => t !== tag), tag]);
      setNewTagInput('');
      showToast('Tag berhasil ditambahkan', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal menambahkan tag', 'error');
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedFileId) return;
    try {
      await removeFileTag(selectedFileId, tag);
      setCurrentTags(prev => prev.filter(t => t !== tag));
      showToast('Tag berhasil dihapus', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal menghapus tag', 'error');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const file = files.find(f => f.id === selectedFileId);
    if (!file) return;
    try {
      await updateFile({ ...file, status: newStatus });
      setFileMetadata((prev: any) => prev ? { ...prev, status: newStatus } : null);
      showToast('Status berkas berhasil diperbarui', 'success');
    } catch (err) {
      console.error('Gagal memperbarui status berkas:', err);
      showToast('Gagal memperbarui status berkas', 'error');
    }
  };

  const handleSaveDescription = async () => {
    const fileObj = files.find(f => f.id === selectedFileId);
    if (!fileObj) return;
    if (descriptionInput === (fileObj.description || '')) return;
    try {
      await updateFile({ ...fileObj, description: descriptionInput });
      showToast('Deskripsi berkas berhasil diperbarui', 'success');
    } catch (err) {
      console.error('Gagal memperbarui deskripsi berkas:', err);
      showToast('Gagal memperbarui deskripsi berkas', 'error');
    }
  };

  const getResponsiblePartiesList = (currentFile: any): Array<{ name: string; timestamp: string; tim_id?: number }> => {
    try {
      if (currentFile.responsible_parties) {
        const parsed = JSON.parse(currentFile.responsible_parties);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  };

  const handleAddResponsibleParty = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileObj = files.find(f => f.id === selectedFileId);
    if (!fileObj || !selectedTimId) return;

    const timMember = tim.find(t => t.id === selectedTimId);
    if (!timMember) {
      showToast('Pilih anggota tim terlebih dahulu', 'error');
      return;
    }

    const parties = getResponsiblePartiesList(fileObj);

    if (parties.some(p => p.tim_id === timMember.id || p.name.toLowerCase() === timMember.name.toLowerCase())) {
      showToast('Anggota tim sudah terdaftar sebagai penanggung jawab', 'error');
      return;
    }

    const newParty = {
      tim_id: timMember.id,
      name: timMember.name,
      timestamp: new Date().toISOString()
    };

    const updatedParties = [...parties, newParty];
    try {
      await updateFile({ ...fileObj, responsible_parties: JSON.stringify(updatedParties) });
      setSelectedTimId('');
      showToast('Penanggung jawab berhasil ditambahkan', 'success');
    } catch (err) {
      console.error('Gagal menambahkan penanggung jawab:', err);
      showToast('Gagal menambahkan penanggung jawab', 'error');
    }
  };

  const handleRemoveResponsibleParty = async (nameToRemove: string) => {
    const fileObj = files.find(f => f.id === selectedFileId);
    if (!fileObj) return;

    const parties = getResponsiblePartiesList(fileObj);
    const updatedParties = parties.filter(p => p.name !== nameToRemove);
    try {
      await updateFile({ ...fileObj, responsible_parties: JSON.stringify(updatedParties) });
      showToast('Penanggung jawab berhasil dihapus', 'success');
    } catch (err) {
      console.error('Gagal menghapus penanggung jawab:', err);
      showToast('Gagal menghapus penanggung jawab', 'error');
    }
  };



  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
  const handleZoomReset = () => setZoomLevel(1);

  const handleDownloadPdf = async () => {
    try {
      const { generateInvoicePDFBytes, downloadPDFBytes } = await import('../../../utils/pdfGenerator');
      const bytes = await generateInvoicePDFBytes('file-preview-panel-export');
      const defaultFileName = currentFileSelected?.filename || 'Invoice.pdf';
      const saved = await downloadPDFBytes(bytes, defaultFileName);
      if (saved) {
        showToast('PDF berhasil diunduh', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal mengunduh PDF', 'error');
    }
  };

  const renderInspectorContent = (currentFile: any) => {
    const invoiceId = currentFile.version_label ? parseInt(currentFile.version_label) : null;
    // 1. Dapatkan metadata invoice tiruan jika metadata semantik null
    let resolvedMetadata = fileMetadata;

    if (currentFile.type === 'invoice' && (!resolvedMetadata || !resolvedMetadata.summary)) {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      let invoiceNo = 'DRAF';
      let customerName = 'Umum';
      let paymentStatus = 'LUNAS';
      let formattedTotal = 'Rp 0';

      if (invoice) {
        formattedTotal = formatPrice(invoice.total);
        try {
          if (invoice.file_path) {
            const metaObj = JSON.parse(invoice.file_path);
            invoiceNo = metaObj.invoiceNo || 'DRAF';
            customerName = metaObj.customerName || 'Umum';
            paymentStatus = metaObj.paymentStatus || 'LUNAS';
          }
        } catch { }
      }

      resolvedMetadata = {
        filename: currentFile.filename,
        type: 'Invoice PDF',
        version_label: currentFile.version_label || 'Lokal',
        summary: `Invoice tagihan nomor ${invoiceNo} untuk pelanggan ${customerName}. Total nominal pembayaran sebesar ${formattedTotal} dengan status ${paymentStatus}.`,
        entities: [
          { entity_type: 'nomor', entity_value: invoiceNo },
          { entity_type: 'pelanggan', entity_value: customerName },
          { entity_type: 'status', entity_value: paymentStatus }
        ]
      };
    }

    // 1b. Tampilkan Linimasa: untuk invoice pakai invoiceTimeline dari DB,
    // non-invoice pakai relatedFiles dari backend (Smart Folders)
    let displayRelated: any[] = [];
    let displayTimeline: any[] = [];
    if (currentFile.type === 'invoice') {
      displayTimeline = invoiceTimeline;
    } else {
      displayRelated = relatedFiles;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Status Berkas */}
        <div>
          <h5 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Status Berkas</h5>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={currentFile.status || 'draft'}
              onChange={e => handleStatusChange(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="final">Final</option>
            </select>
          </div>
        </div>

        {/* Deskripsi Berkas */}
        <div>
          <h5 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Deskripsi Berkas</h5>
          <textarea
            placeholder="Tambahkan deskripsi berkas di sini..."
            value={descriptionInput}
            onChange={e => setDescriptionInput(e.target.value)}
            onBlur={handleSaveDescription}
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.15s ease'
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onBlurCapture={handleSaveDescription}
          />
        </div>

        {/* Pihak Penanggung Jawab — terhubung dengan Tim */}
        <div>
          <h5 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Pihak Penanggung Jawab</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* List Penanggung Jawab */}
            {getResponsiblePartiesList(currentFile).length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-card)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                Belum ada penanggung jawab yang ditambahkan.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {getResponsiblePartiesList(currentFile).map(party => {
                  const timMember = party.tim_id ? tim.find(t => t.id === party.tim_id) : null;
                  return (
                    <div key={party.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>👤 {party.name}</strong>
                          {timMember && (
                            <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                              {timMember.role}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                          🕒 {new Date(party.timestamp).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveResponsibleParty(party.name)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', padding: '4px' }}
                        title="Hapus penanggung jawab"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Form Tambah Penanggung Jawab — dropdown dari Tim */}
            {tim.length > 0 && (
              <form onSubmit={handleAddResponsibleParty} style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <select
                  value={selectedTimId}
                  onChange={e => setSelectedTimId(e.target.value ? Number(e.target.value) : '')}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="">Pilih anggota tim...</option>
                  {tim.filter(t => t.is_active !== 0).map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.role}</option>
                  ))}
                </select>
                <button type="submit" style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#ffffff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Tambah
                </button>
              </form>
            )}
            {tim.length === 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Tidak ada anggota tim. Tambah anggota tim di menu Master Data &gt; Tim.
              </span>
            )}
          </div>
        </div>

        {/* Entitas Terdeteksi */}
        <div>
          <h5 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Entitas Terdeteksi</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {!resolvedMetadata || !resolvedMetadata.entities || resolvedMetadata.entities.length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Tidak ada entitas penerbitan khusus yang terdeteksi.</span>
            ) : (
              resolvedMetadata.entities.filter((ent: any) => ent.entity_type !== 'hash').map((ent: any, idx: number) => {
                const iconMap: Record<string, string> = { judul: '📖', penulis: '✍️', bab: '📑', ISBN: '🔢', nomor: '🔢', pelanggan: '👤', status: '🚦' };
                const icon = iconMap[ent.entity_type] || '📑';
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: idx < resolvedMetadata.entities.filter((e: any) => e.entity_type !== 'hash').length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: idx < resolvedMetadata.entities.filter((e: any) => e.entity_type !== 'hash').length - 1 ? '6px' : '0' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {icon} <span style={{ textTransform: 'capitalize' }}>{ent.entity_type}</span>
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{ent.entity_value}</strong>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tag Berkas */}
        <div>
          <h5 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Tag Berkas</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {currentTags.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Belum ada tag untuk berkas ini.</span>
              ) : (
                currentTags.map(tag => (
                  <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', padding: '0 2px', fontSize: '10px', display: 'flex', alignItems: 'center', fontWeight: 'bold' }} title="Hapus tag">×</button>
                  </span>
                ))
              )}
            </div>
            <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="Tambah tag baru (misal: #final)..."
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
              />
              <button type="submit" style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#ffffff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                Tambah
              </button>
            </form>
          </div>
        </div>

        {/* Ringkasan */}
        <div>
          <h5 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Ringkasan Konten Otomatis</h5>
          <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5', fontStyle: 'italic' }}>
            "{resolvedMetadata?.summary || 'Tidak ada ringkasan teks untuk berkas ini.'}"
          </div>
        </div>

        {/* Linimasa Versi — invoice: riwayat aktivitas & daftar berkas; non-invoice: file relations */}
        <div>
          <h5 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>Linimasa Versi</h5>
          {currentFile.type === 'invoice' ? (
            <>
              {(() => {
                const invoicePDFs = files.filter(f => f.type === 'invoice' && f.version_label === String(invoiceId));
                if (invoicePDFs.length === 0) return null;
                return (
                  <div style={{ marginBottom: '20px' }}>
                    <h6 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daftar Dokumen PDF (Cetak)</h6>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {invoicePDFs.map((pdf, pIdx) => (
                        <div key={pIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <span style={{ fontSize: '16px' }}>📄</span>
                            <span style={{ fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={pdf.filename}>
                              {pdf.filename}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
                                await tauriInvoke('open_file_physically', { path: pdf.path });
                              } catch (err: any) {
                                console.error('Gagal membuka file:', err);
                                showToast(`Gagal membuka file PDF: ${err?.message || err}`, 'error');
                              }
                            }}
                            style={{
                              background: 'var(--accent)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '10px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              marginLeft: '8px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Buka PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <h6 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Linimasa Aktivitas</h6>
              {displayTimeline.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  Belum ada riwayat aktivitas untuk invoice ini.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '16px', borderLeft: '2px solid var(--border)', gap: '12px', marginLeft: '6px' }}>
                  {displayTimeline.map((item: any, idx: number) => {
                  const isCreate = item.action === 'CREATE';
                  const isPaymentChange = item.action === 'PAYMENT_CHANGE';
                  const isSync = item.action === 'SYNC' || (item.description || '').includes('sinkronisasi');
                  const dotColor = isCreate ? '#2ec27e' : isPaymentChange ? '#d97706' : isSync ? '#8b5cf6' : '#1e90ff';
                  const badgeColor = isCreate ? 'rgba(46, 194, 126, 0.15)' : isPaymentChange ? 'rgba(217, 119, 6, 0.15)' : isSync ? 'rgba(139, 92, 246, 0.15)' : 'rgba(30, 144, 255, 0.15)';
                  const badgeText = isCreate ? 'DIBUAT' : isPaymentChange ? 'STATUS BERUBAH' : isSync ? 'SINKRON' : 'DIEDIT';
                  const date = new Date(item.created_at);
                  const dateStr = date.toLocaleDateString('id-ID');
                  const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={idx} style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-23px', top: '12px', width: '12px', height: '12px', borderRadius: '50%', background: dotColor, border: '2.5px solid var(--bg-panel)', boxShadow: '0 0 0 1px var(--border)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '12px', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700', background: badgeColor, color: dotColor, textTransform: 'uppercase' }}>{badgeText}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{dateStr} {timeStr}</span>
                        </div>
                        <span style={{ color: 'var(--text-primary)' }}>{item.description}</span>
                        {isPaymentChange && item.old_value && item.new_value && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginTop: '2px' }}>
                            <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', fontWeight: '600' }}>{item.old_value}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>→</span>
                            <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(46, 194, 126, 0.15)', color: '#2ec27e', fontWeight: '700' }}>{item.new_value}</span>
                          </div>
                        )}
                        {item.performed_by_name && (
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>oleh {item.performed_by_name}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
          ) : (
            displayRelated.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                Tidak ada berkas terkait atau versi lain terdeteksi.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '16px', borderLeft: '2px solid var(--border)', gap: '16px', marginLeft: '6px' }}>
                {displayRelated.map((rel: any, idx: number) => {
                  const isVersion = rel.relation_type === 'version_of';
                  const isDup = rel.relation_type === 'duplicate_of';
                  const dotColor = isDup ? '#ef4444' : (isVersion ? '#2ec27e' : '#1e90ff');
                  const badgeColor = isDup ? 'rgba(239, 68, 68, 0.15)' : (isVersion ? 'rgba(46, 194, 126, 0.15)' : 'rgba(30, 144, 255, 0.15)');
                  const badgeText = isDup ? 'Duplikat Persis' : (isVersion ? `Revisi (${Math.round(rel.confidence * 100)}%)` : 'Terkait');
                  return (
                    <div key={idx} style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-23px', top: '12px', width: '12px', height: '12px', borderRadius: '50%', background: dotColor, border: '2.5px solid var(--bg-panel)', boxShadow: '0 0 0 1px var(--border)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '12px', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700', background: badgeColor, color: dotColor, textTransform: 'uppercase' }}>{badgeText}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{new Date(rel.last_modified).toLocaleDateString('id-ID')}</span>
                        </div>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{rel.filename}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  // ---------- Invoice tanpa file entry — tampilkan preview langsung ----------
  if (!selectedFileId && previewInvoiceId) {
    const invoice = invoices.find(inv => inv.id === previewInvoiceId);
    if (invoice) {
      let meta: any = {};
      try { if (invoice.file_path) meta = JSON.parse(invoice.file_path); } catch { }
      let items: any[] = [];
      try { items = JSON.parse(invoice.items_json); } catch { }
      const overrideInvoice = {
        customerName: meta.customerName || '',
        waNumber: meta.customerWa || '',
        address: meta.customerAddress || '',
        items, shippingCost: invoice.shipping_cost,
        adminFee: invoice.admin_fee, invoiceType: invoice.export_format || '',
        profileId: meta.profileId || '',
        pdfFilenameFormat: meta.pdfFilenameFormat || '',
        invoiceNo: meta.invoiceNo || '', invoiceHal: meta.invoiceHal || '',
        invoiceLampiran: meta.invoiceLampiran || '',
        invoiceDate: meta.invoiceDate || '',
        paymentStatus: meta.paymentStatus || 'LUNAS',
        spesifikasiFasilitas: meta.spesifikasiFasilitas || '',
        paidAmount: invoice.paid_amount ?? meta.paidAmount ?? 0,
        paymentNotes: invoice.payment_notes ?? meta.paymentNotes ?? ''
      };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)' }}>
          <div style={{ padding: '10px 16px', background: '#fef3cd', borderBottom: '1px solid #fbbf24', fontSize: '12px', fontWeight: '600', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠️ Invoice ini belum memiliki file PDF terindex.
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <InvoicePreview overrideInvoice={overrideInvoice} />
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', fontWeight: '500' }}>
          Data invoice tidak ditemukan
        </p>
      </div>
    );
  }

  // ---------- Tidak ada berkas terpilih ----------
  if (!selectedFileId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', fontWeight: '500' }}>
          Pilih berkas untuk melihat pratinjau
        </p>
      </div>
    );
  }

  const file = files.find(f => f.id === selectedFileId);
  if (!file) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', fontWeight: '500' }}>
          Pilih berkas invoice untuk melihat pratinjau
        </p>
      </div>
    );
  }

  // ---------- Berkas Invoice — render InvoicePreview ----------
  if (file.type === 'invoice') {
    const invoiceId = file.version_label ? parseInt(file.version_label) : null;
    const invoice = invoices.find(inv => inv.id === invoiceId);

    if (!invoice) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '13px' }}>Data invoice tidak ditemukan</span>
        </div>
      );
    }

    let metadata: any = { invoiceNo: '', invoiceDate: '', invoiceHal: '', invoiceLampiran: '', paymentStatus: 'LUNAS', spesifikasiFasilitas: '', customerName: '', customerWa: '', customerAddress: '' };
    try { if (invoice.file_path) metadata = JSON.parse(invoice.file_path); } catch { }

    let items: any[] = [];
    try { items = JSON.parse(invoice.items_json); } catch { }

    const overrideInvoice = {
      customerName: metadata.customerName || '',
      waNumber: metadata.customerWa || '',
      address: metadata.customerAddress || '',
      items,
      shippingCost: invoice.shipping_cost,
      adminFee: invoice.admin_fee,
      invoiceType: invoice.export_format || '',
      profileId: metadata.profileId || '',
      pdfFilenameFormat: metadata.pdfFilenameFormat || '',
      invoiceNo: metadata.invoiceNo || '',
      invoiceHal: metadata.invoiceHal || '',
      invoiceLampiran: metadata.invoiceLampiran || '',
      invoiceDate: metadata.invoiceDate || '',
      paymentStatus: metadata.paymentStatus || 'LUNAS',
      spesifikasiFasilitas: metadata.spesifikasiFasilitas || '',
      paidAmount: invoice.paid_amount ?? metadata.paidAmount ?? 0,
      paymentNotes: invoice.payment_notes ?? metadata.paymentNotes ?? ''
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)' }}>
        {/* Header: Tab Switcher + Zoom + Edit */}
        <div style={{ padding: '6px 12px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', zIndex: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setActiveTab('preview')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: activeTab === 'preview' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'preview' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              📄 Preview
            </button>
            <button
              onClick={() => setActiveTab('inspector')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: activeTab === 'inspector' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'inspector' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              🔍 Info
            </button>
          </div>

          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {activeTab === 'preview' && (
              <button
                className="btn-primary compact-btn"
                onClick={() => { loadInvoiceToForm(invoice); setActiveModule('invoice'); }}
                style={{ height: '24px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '0 8px' }}
              >
                📝 Edit
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: activeTab === 'inspector' ? '16px 20px' : '0' }}>
          {activeTab === 'preview' ? (
            <InvoicePreview id="file-preview-panel-export" overrideInvoice={overrideInvoice} hideToolbar externalZoom={zoomLevel} />
          ) : (
            <>
              <div style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0', wordBreak: 'break-all' }}>
                  {file.filename}
                </h4>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: 'rgba(192, 28, 28, 0.1)', color: 'var(--accent)', textTransform: 'uppercase' }}>
                    {file.type}
                  </span>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: 'rgba(0, 0, 0, 0.05)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Lokal
                  </span>
                </div>
              </div>

              {renderInspectorContent(file)}
            </>
          )}
        </div>

        {/* Bottom Bar: Zoom + Download PDF */}
        {activeTab === 'preview' && (
          <div style={{ flexShrink: 0, padding: '6px 12px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button onClick={handleZoomOut} title="Perkecil" style={{ width: '26px', height: '26px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>−</button>
              <button onClick={handleZoomReset} title="Reset zoom" style={{ width: '26px', height: '26px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600' }}>⟲</button>
              <button onClick={handleZoomIn} title="Perbesar" style={{ width: '26px', height: '26px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '36px', textAlign: 'center', fontWeight: '600' }}>{Math.round(zoomLevel * 100)}%</span>
            </div>
            <button onClick={handleDownloadPdf} className="btn-primary compact-btn" style={{ height: '26px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '0 10px' }}>
              ⬇ Download PDF
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---------- Berkas GDrive ----------
  if (file.type === 'gdrive') {
    const isFolder = file.version_label === 'application/vnd.google-apps.folder';
    const { accountEmail } = parseModifiedBy(file.modified_by);

    const handleOpenGDrivePhysically = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const fileId = file.path.replace('gdrive://', '');
        let account = gdriveAccounts.find(acc => acc.email === accountEmail);
        let token = account ? account.token : localStorage.getItem('gdrive_token');

        if (!token && accountEmail && refreshAccountToken) {
          showToast('Memperbarui koneksi akun Google...', 'info');
          token = await refreshAccountToken(accountEmail);
        } else if (!token && refreshAccessToken) {
          showToast('Memperbarui koneksi Google Drive...', 'info');
          token = await refreshAccessToken();
        }

        if (!token) { showToast('Google Drive belum dikonfigurasi. Hubungkan akun di Pengaturan.', 'error'); return; }

        showToast('Mengunduh berkas dari Google Drive...', 'info');
        const mimeType = file.version_label || '';
        const isGoogleDoc = mimeType.startsWith('application/vnd.google-apps.');
        let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        let filename = file.filename;

        if (isGoogleDoc) {
          let exportMime = 'application/pdf';
          let ext = '.pdf';
          if (mimeType === 'application/vnd.google-apps.document') { exportMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; ext = '.docx'; }
          else if (mimeType === 'application/vnd.google-apps.spreadsheet') { exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; ext = '.xlsx'; }
          else if (mimeType === 'application/vnd.google-apps.presentation') { exportMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'; ext = '.pptx'; }
          url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
          if (!filename.toLowerCase().endsWith(ext)) filename = filename + ext;
        }

        let response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

        if (response.status === 401) {
          showToast('Token kedaluwarsa. Memperbarui token...', 'info');
          let newToken = null;
          if (accountEmail && refreshAccountToken) newToken = await refreshAccountToken(accountEmail);
          else if (refreshAccessToken) newToken = await refreshAccessToken();
          if (newToken) { token = newToken; response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } }); }
        }

        if (!response.ok) throw new Error('HTTP error');
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const localPath = await invoke<string>('create_physical_file', { filename, bytes: Array.from(bytes), folder: 'gdrive_cache' });
        await updateFile({ ...file, status: 'Tersimpan' });
        showToast('Membuka berkas...', 'info');
        await invoke('open_file_physically', { path: localPath });
      } catch (error) {
        console.error(error);
        showToast('Gagal membuka berkas Drive', 'error');
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)', padding: '30px', overflow: 'auto', alignItems: 'center' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          {isFolder ? 'Detail Folder Google Drive' : 'Detail Berkas Google Drive'}
        </h3>

        <div style={{ width: '100%', padding: '24px', borderRadius: '16px', background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', boxShadow: '0 12px 28px rgba(0,0,0,0.15)', color: '#ffffff', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', fontSize: '96px', opacity: 0.05, userSelect: 'none' }}>{isFolder ? '📁' : '☁️'}</div>
          <span style={{ fontSize: '48px' }}>{isFolder ? '📁' : '☁️'}</span>
          <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: isFolder ? 'rgba(30, 144, 255, 0.2)' : (file.status === 'Tersimpan' ? 'rgba(46, 194, 126, 0.2)' : 'rgba(255, 255, 255, 0.1)'), backdropFilter: 'blur(4px)', color: isFolder ? '#1e90ff' : (file.status === 'Tersimpan' ? '#2ec27e' : '#e5e7eb'), textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.1)' }}>
            {isFolder ? 'Folder Cloud' : (file.status === 'Tersimpan' ? 'Tersimpan Lokal (Cached)' : 'Tersedia di Cloud')}
          </span>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, textAlign: 'center', wordBreak: 'break-all' }}>{file.filename}</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ukuran File</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatBytes(file.modified_by, file.version_label)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Format MIME</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '11px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.version_label}>{getMimeLabel(file.version_label)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Modifikasi Terakhir</span>
              <strong style={{ color: 'var(--text-primary)' }}>{new Date(file.last_modified).toLocaleString('id-ID')}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!isFolder ? (
              <button className="btn-primary compact-btn" onClick={handleOpenGDrivePhysically} style={{ width: '100%', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span>📥</span> {file.status === 'Tersimpan' ? 'Buka Berkas Native' : 'Unduh & Buka Native'}
              </button>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', lineHeight: '1.4' }}>
                💡 <strong>Klik dua kali</strong> pada baris folder di sebelah kiri untuk masuk dan menjelajah isinya.
              </div>
            )}
            <button className="btn-secondary compact-btn" onClick={() => window.open(`https://drive.google.com/open?id=${file.path.replace('gdrive://', '')}`, '_blank')} style={{ width: '100%', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--bg-card)' }}>
              <span>🌐</span> Buka di Web Browser
            </button>
            <button className="btn-secondary compact-btn" onClick={() => { navigator.clipboard.writeText(`https://drive.google.com/open?id=${file.path.replace('gdrive://', '')}`); showToast('Link Google Drive berhasil disalin', 'success'); }} style={{ width: '100%', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--bg-card)' }}>
              <span>📋</span> {isFolder ? 'Salin Link Folder' : 'Salin Link Drive'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Loading metadata ----------
  if (loadingMetadata) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        <span style={{ fontSize: '13px' }}>Memuat metadata & analisis berkas...</span>
      </div>
    );
  }

  // ---------- Berkas lokal — tampilkan metadata semantik ----------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)', padding: '24px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px 0', wordBreak: 'break-all' }}>
          {file.filename}
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: 'rgba(192, 28, 28, 0.1)', color: 'var(--accent)', textTransform: 'uppercase' }}>
            {file.type}
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: 'rgba(0, 0, 0, 0.05)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            {file.version_label || 'Lokal'}
          </span>
        </div>
      </div>

      {renderInspectorContent(file)}
    </div>
  );
};

export default FilePreviewPanel;
