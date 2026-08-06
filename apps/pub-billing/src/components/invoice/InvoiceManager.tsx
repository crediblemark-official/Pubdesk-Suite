import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useFileState } from '../../contexts/FileContext';
import { useInvoiceContext } from '../../contexts/InvoiceContext';
import { Invoice } from '../../types/invoice.types';
import { formatPrice } from '../../utils/format';
import { getInvoiceMetadata, formatDateId } from '../../utils/invoice';
import { StatusBadge } from '../../ui/atoms/Badge';
import { FilterBar, FilterGroup, FilterChip, FilterDivider } from '../../ui/molecules/FilterBar';
import { TableEmptyState } from '../../ui/molecules/EmptyState';
import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface InvoiceManagerProps {
  searchQuery?: string;
}

// Daftar status pembayaran invoice
const PAYMENT_STATUSES = [
  { value: 'LUNAS', label: 'Lunas', color: '#16a34a' },
  { value: 'BELUM LUNAS', label: 'Belum Lunas', color: '#dc2626' },
  { value: 'DP', label: 'DP', color: '#2563eb' },
  { value: 'BERMASALAH', label: 'Bermasalah', color: '#d97706' },
];

const InvoiceManager: React.FC<InvoiceManagerProps> = ({ searchQuery = '' }) => {
  const { 
    invoices, 
    deleteInvoice, 
    updateInvoice,
    showConfirm, 
    showToast, 
    setActiveModule, 
    registerImportExportActions,
    addInvoice,
  } = useAppContext();

  const {
    files,
    deleteFile,
    updateFile,
    selectedFileId,
    setSelectedFileId,
    setRightPanelVisible,
    previewInvoiceId,
    setPreviewInvoiceId,
  } = useFileState();
  
  const { loadInvoiceToForm } = useInvoiceContext();

  const [sortField, setSortField] = useState<'date' | 'invoiceNo' | 'customerName' | 'total' | 'status' | 'fileStatus'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter status pembayaran — pola identik dengan Smart Folders
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<number | null>(null);

  // State untuk invoice yang ditandai (dipilih)
  const [markedInvoiceIds, setMarkedInvoiceIds] = useState<number[]>([]);

  // Kosongkan seleksi saat status filter atau pencarian berubah
  useEffect(() => {
    setMarkedInvoiceIds([]);
  }, [selectedStatus, searchQuery]);

  const handleToggleSelectAll = () => {
    if (markedInvoiceIds.length === filteredInvoices.length && filteredInvoices.length > 0) {
      setMarkedInvoiceIds([]);
    } else {
      setMarkedInvoiceIds(filteredInvoices.map(inv => inv.id!));
    }
  };

  const handleBulkMarkBermasalah = async () => {
    if (markedInvoiceIds.length === 0) return;

    try {
      let updatedCount = 0;
      for (const id of markedInvoiceIds) {
        const inv = invoices.find(i => i.id === id);
        if (!inv) continue;

        const metadata = getInvoiceMetadata(inv);
        metadata.paymentStatus = 'BERMASALAH';

        const updatedInvoice: Invoice = {
          ...inv,
          file_path: JSON.stringify(metadata)
        };

        await updateInvoice(updatedInvoice);
        updatedCount++;
      }
      showToast(`${updatedCount} invoice berhasil ditandai Bermasalah!`, 'success');
      setMarkedInvoiceIds([]);
    } catch (err) {
      console.error(err);
      showToast('Gagal menandai invoice!', 'error');
    }
  };

  const handleBulkDelete = () => {
    if (markedInvoiceIds.length === 0) return;

    showConfirm({
      title: 'Hapus Invoice Terpilih',
      message: `Apakah Anda yakin ingin menghapus ${markedInvoiceIds.length} invoice terpilih? Tindakan ini juga akan menghapus berkas PDF fisiknya di Smart Folders.`,
      confirmText: 'Hapus Semua',
      type: 'danger',
      onConfirm: async () => {
        try {
          let successCount = 0;
          for (const invoiceId of markedInvoiceIds) {
            // Hapus entri invoice dari SQLite
            await deleteInvoice(invoiceId);

            // Cari & Hapus entri file terkait di SQLite
            const fileEntry = files.find(f => f.type === 'invoice' && f.version_label === String(invoiceId));
            if (fileEntry && fileEntry.id) {
              await deleteFile(fileEntry.id);
            }
            successCount++;
          }
          showToast(`${successCount} invoice berhasil dihapus!`, 'success');
          setMarkedInvoiceIds([]);
        } catch (err) {
          console.error(err);
          showToast('Gagal menghapus beberapa invoice!', 'error');
        }
      }
    });
  };

  const handleSort = (field: 'date' | 'invoiceNo' | 'customerName' | 'total' | 'status' | 'fileStatus') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: 'date' | 'invoiceNo' | 'customerName' | 'total' | 'status' | 'fileStatus') => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ▴' : ' ▾';
  };
  

  
  // Filter, Search & Sort Invoices
  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter((inv) => {
      const metadata = getInvoiceMetadata(inv);
      const invoiceNoLower = (metadata.invoiceNo || '').toLowerCase();
      const customerNameLower = (metadata.customerName || '').toLowerCase();
      const invoiceDateStr = metadata.invoiceDate ? metadata.invoiceDate : '';
      const invoiceDateIdStr = metadata.invoiceDate ? formatDateId(metadata.invoiceDate).toLowerCase() : '';
      const createdAtStr = inv.created_at ? new Date(inv.created_at).toLocaleDateString('id-ID').toLowerCase() : '';
      const searchLower = searchQuery.toLowerCase();
      
      const matchesSearch = 
        invoiceNoLower.includes(searchLower) || 
        customerNameLower.includes(searchLower) ||
        invoiceDateStr.includes(searchLower) ||
        invoiceDateIdStr.includes(searchLower) ||
        createdAtStr.includes(searchLower);
      
      const matchesStatus = selectedStatus === null || (metadata.paymentStatus || 'BERMASALAH') === selectedStatus;
      
      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      const metaA = getInvoiceMetadata(a);
      const metaB = getInvoiceMetadata(b);

      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'date':
          valA = metaA.invoiceDate || a.created_at;
          valB = metaB.invoiceDate || b.created_at;
          break;
        case 'invoiceNo':
          valA = metaA.invoiceNo || '';
          valB = metaB.invoiceNo || '';
          break;
        case 'customerName':
          valA = metaA.customerName || '';
          valB = metaB.customerName || '';
          break;
        case 'total':
          valA = a.total;
          valB = b.total;
          break;
        case 'status':
          valA = metaA.paymentStatus || 'BERMASALAH';
          valB = metaB.paymentStatus || 'BERMASALAH';
          break;
        case 'fileStatus': {
          const fileA = files.find(f => f.type === 'invoice' && f.version_label === String(a.id));
          const fileB = files.find(f => f.type === 'invoice' && f.version_label === String(b.id));
          valA = fileA?.status || 'draft';
          valB = fileB?.status || 'draft';
          break;
        }
        default:
          valA = a.created_at;
          valB = b.created_at;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [invoices, searchQuery, sortField, sortDirection, selectedStatus, files]);

  // Aksi Buka File PDF Secara Native
  const handleOpenPDF = async (invoiceId: number) => {
    const fileEntry = files.find(f => f.type === 'invoice' && f.version_label === String(invoiceId));
    if (!fileEntry) {
      showToast('Berkas PDF tidak ditemukan di database!', 'error');
      return;
    }
    try {
      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
      await tauriInvoke('open_file_physically', { path: fileEntry.path });
      showToast('Membuka PDF invoice...', 'info');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuka berkas PDF secara native!', 'error');
    }
  };

  const handleOpenFileLocation = async (invoiceId: number) => {
    const fileEntry = files.find(f => f.type === 'invoice' && f.version_label === String(invoiceId));
    if (!fileEntry) {
      showToast('Berkas PDF tidak ditemukan di database!', 'error');
      return;
    }
    try {
      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
      await tauriInvoke('open_file_location_physically', { path: fileEntry.path });
      showToast('Membuka lokasi berkas...', 'info');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuka lokasi berkas!', 'error');
    }
  };

  const handleMoveFile = async (invoiceId: number) => {
    const fileEntry = files.find(f => f.type === 'invoice' && f.version_label === String(invoiceId));
    if (!fileEntry) {
      showToast('Berkas PDF tidak ditemukan di database!', 'error');
      return;
    }
    try {
      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
      const destPath = await save({
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        defaultPath: fileEntry.filename
      });
      if (!destPath) return;
      const bytes = await tauriInvoke<number[]>('read_file_bytes', { path: fileEntry.path });
      await tauriInvoke('write_binary_file', { path: destPath, bytes });
      await tauriInvoke('remove_file_physically', { path: fileEntry.path });
      await updateFile({ ...fileEntry, path: destPath });
      showToast('Berkas berhasil dipindahkan!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memindahkan berkas!', 'error');
    }
  };

  // Aksi Hapus Invoice
  const handleDeleteInvoice = (invoiceId: number, invoiceNo: string) => {
    showConfirm({
      title: 'Hapus Invoice',
      message: `Apakah Anda yakin ingin menghapus invoice "${invoiceNo}"? Tindakan ini juga akan menghapus berkas PDF fisiknya di Smart Folders.`,
      confirmText: 'Hapus',
      type: 'danger',
      onConfirm: async () => {
        try {
          // Hapus entri invoice dari SQLite
          await deleteInvoice(invoiceId);
          
          // Cari & Hapus entri file terkait di SQLite
          const fileEntry = files.find(f => f.type === 'invoice' && f.version_label === String(invoiceId));
          if (fileEntry && fileEntry.id) {
            await deleteFile(fileEntry.id);
          }
          
          showToast(`Invoice "${invoiceNo}" berhasil dihapus!`, 'success');
        } catch (err) {
          console.error(err);
          showToast('Gagal menghapus invoice!', 'error');
        }
      }
    });
  };

  // Aksi Edit / Muat Ulang ke Generator
  const handleEdit = (invoice: Invoice) => {
    loadInvoiceToForm(invoice);
    setActiveModule('invoice');
    showToast('Data invoice berhasil dimuat ke editor!', 'success');
  };

  // Core sync logic — returns true on success, false on failure
  const syncOneInvoice = async (invoice: Invoice): Promise<boolean> => {
    const metadata = getInvoiceMetadata(invoice);
    let items = [];
    try {
      items = JSON.parse(invoice.items_json);
    } catch (e) {
      console.error(e);
    }

    const { googleAppsScriptService } = await import('../../services/googleAppsScript');
    if (!googleAppsScriptService.isConfigured()) return false;

    try {
      const itemsPayload = items.map((item: any) => ({
        item_title: item.item_title,
        quantity: item.quantity,
        price: item.price
      }));

      const gasPayload = {
        invoice_no: metadata.invoiceNo || undefined,
        id_invoice: invoice.id,
        tanggal: metadata.invoiceDate || new Date().toISOString().split('T')[0],
        pelanggan: metadata.customerName || '',
        whatsapp: metadata.customerWa || '',
        alamat: metadata.customerAddress || '',
        items: itemsPayload,
        shipping_cost: invoice.shipping_cost,
        admin_fee: invoice.admin_fee,
        total: invoice.total
      };

      const cloudResult = await googleAppsScriptService.sendInvoiceToCloud(gasPayload, []);
      if (cloudResult.success) {
        const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
        await tauriInvoke('update_invoice_sync_status', {
          id: invoice.id,
          syncStatus: 'synced',
          cloudFileUrl: cloudResult.fileUrl || ''
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Sinkronisasi semua invoice ke GAS (bulk)
  const [syncingAll, setSyncingAll] = useState(false);
  const handleSyncAllToCloud = async () => {
    const pending = invoices.filter(inv => inv.sync_status !== 'synced' || !inv.sync_status);
    if (pending.length === 0) {
      showToast('Semua invoice sudah tersinkronisasi!', 'info');
      return;
    }
    setSyncingAll(true);
    let success = 0;
    let failed = 0;
    for (const inv of pending) {
      const ok = await syncOneInvoice(inv);
      if (ok) success++;
      else failed++;
    }
    setSyncingAll(false);
    showToast(`Sinkronisasi selesai: ${success} berhasil, ${failed} gagal`, failed > 0 ? 'error' : 'success');
  };

  // Aksi sinkronisasi manual per invoice
  const handleSyncCloud = async (invoice: Invoice) => {
    if (!invoice.id) return;
    setSyncingInvoiceId(invoice.id);
    try {
      const ok = await syncOneInvoice(invoice);
      if (ok) {
        showToast('Sinkronisasi cloud berhasil!', 'success');
      } else {
        showToast('Gagal sinkronisasi ke cloud!', 'error');
      }
    } finally {
      setSyncingInvoiceId(null);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          showToast('File Excel kosong!', 'error');
          return;
        }

        let importedCount = 0;
        let errorCount = 0;

        for (const row of data) {
          const invoiceNo = row["No. Invoice"] || row.NoInvoice || row.invoice_no;
          const customerName = row["Nama Pelanggan"] || row.Pelanggan || row.customer_name;
          if (!invoiceNo || !customerName) {
            errorCount++;
            continue;
          }

          const invoiceDate = row.Tanggal || row.tanggal || row.invoice_date || new Date().toISOString().split('T')[0];
          const customerWa = row["WhatsApp Pelanggan"] || row.WhatsApp || row.wa || row.customer_wa || '';
          const customerAddress = row["Alamat Pelanggan"] || row.Alamat || row.alamat || row.customer_address || '';
          const invoiceHal = row["Hal / Judul"] || row.Hal || row.hal || row.subject || '';
          const invoiceLampiran = row.Lampiran || row.lampiran || '';
          const paymentStatus = row["Status Pembayaran"] || row.Status || row.status || 'BERMASALAH';
          
          const shipping_cost = parseFloat(row["Biaya Pengiriman"] || row.shipping_cost || '0');
          const admin_fee = parseFloat(row["Biaya Admin"] || row.admin_fee || '0');
          const total = parseFloat(row["Total Nominal"] || row.Total || row.total || '0');

          // Parse Item Pesanan (misal: "Buku AI | 10 | 50000; Layanan Layout | 1 | 250000")
          const itemsStr = row["Item Pesanan"] || row.items || '';
          const items: any[] = [];
          if (itemsStr) {
            const parts = String(itemsStr).split(';');
            for (const part of parts) {
              const info = part.split('|');
              if (info[0] && info[0].trim()) {
                const title = info[0].trim();
                const qty = parseInt(info[1] || '1', 10);
                const price = parseFloat(info[2] || '0');
                items.push({
                  book_id: 0,
                  item_title: title,
                  quantity: isNaN(qty) ? 1 : qty,
                  price: isNaN(price) ? 0 : price,
                  discount: 0
                });
              }
            }
          }

          const metadata = {
            invoiceNo: String(invoiceNo).trim(),
            invoiceDate: String(invoiceDate).trim(),
            invoiceHal: String(invoiceHal).trim(),
            invoiceLampiran: String(invoiceLampiran).trim(),
            paymentStatus: String(paymentStatus).trim(),
            customerName: String(customerName).trim(),
            customerWa: String(customerWa).trim(),
            customerAddress: String(customerAddress).trim(),
            spesifikasiFasilitas: ''
          };

          try {
            await addInvoice({
              created_at: new Date().toISOString(),
              items_json: JSON.stringify(items),
              shipping_cost: isNaN(shipping_cost) ? 0 : shipping_cost,
              admin_fee: isNaN(admin_fee) ? 0 : admin_fee,
              total: isNaN(total) ? 0 : total,
              file_path: JSON.stringify(metadata),
              sync_status: 'pending'
            });
            importedCount++;
          } catch (err) {
            console.error('Gagal mengimpor invoice:', err);
            errorCount++;
          }
        }

        showToast(`Impor invoice berhasil! ${importedCount} data dimasukkan.${errorCount > 0 ? ` Gagal: ${errorCount}` : ''}`, 'success');
        e.target.value = '';
      } catch (err) {
        console.error(err);
        showToast('Gagal memproses file Excel!', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = async () => {
    try {
      if (invoices.length === 0) {
        showToast('Tidak ada data invoice untuk diekspor!', 'info');
        return;
      }

      const exportData = invoices.map((inv, idx) => {
        const metadata = getInvoiceMetadata(inv);
        let itemsDesc = '';
        try {
          const items = JSON.parse(inv.items_json) || [];
          itemsDesc = items.map((it: any) => `${it.item_title} (${it.quantity}x @ ${it.price})`).join('; ');
        } catch (e) {
          itemsDesc = '';
        }

        return {
          "No": idx + 1,
          "ID Invoice": inv.id,
          "No. Invoice": metadata.invoiceNo || 'DRAF',
          "Tanggal": metadata.invoiceDate || inv.created_at.substring(0, 10),
          "Nama Pelanggan": metadata.customerName || 'Umum',
          "WhatsApp Pelanggan": metadata.customerWa || '',
          "Alamat Pelanggan": metadata.customerAddress || '',
          "Hal / Judul": metadata.invoiceHal || '',
          "Lampiran": metadata.invoiceLampiran || '',
          "Status Pembayaran": metadata.paymentStatus || 'BERMASALAH',
          "Biaya Pengiriman": inv.shipping_cost,
          "Biaya Admin": inv.admin_fee,
          "Total Nominal": inv.total,
          "Item Pesanan": itemsDesc,
          "Status Sinkronisasi": inv.sync_status || 'pending',
          "Tautan Cloud": inv.cloud_file_url || ''
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const maxLens = Object.keys(exportData[0] || {}).map(key => {
        return Math.max(
          key.length,
          ...exportData.map(row => String((row as any)[key] || '').length)
        );
      });
      ws['!cols'] = maxLens.map(len => ({ wch: Math.min(len + 3, 50) }));

      XLSX.utils.book_append_sheet(wb, ws, "Daftar Invoice");

      const filePath = await save({
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        defaultPath: 'Daftar_Invoice_Export.xlsx'
      });

      if (!filePath) return;

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const bytes = new Uint8Array(wbout);
      await invoke('write_binary_file', { path: filePath, bytes: Array.from(bytes) });

      showToast('Data Invoice berhasil diekspor ke Excel!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengekspor data invoice!', 'error');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const templateData = [
        {
          "No. Invoice": "INV/2026/001",
          "Tanggal": "2026-06-21",
          "Nama Pelanggan": "Budi Santoso",
          "WhatsApp Pelanggan": "081234567890",
          "Alamat Pelanggan": "Jl. Kaliurang Km 5, Sleman, Yogyakarta",
          "Hal / Judul": "Cetak Buku Kecerdasan Buatan",
          "Lampiran": "1 Berkas",
          "Status Pembayaran": "LUNAS",
          "Biaya Pengiriman": 15000,
          "Biaya Admin": 2500,
          "Total Nominal": 517500,
          "Item Pesanan": "Buku AI | 10 | 50000"
        }
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateData);

      const maxLens = Object.keys(templateData[0] || {}).map(key => {
        return Math.max(
          key.length,
          ...templateData.map(row => String((row as any)[key] || '').length)
        );
      });
      ws['!cols'] = maxLens.map(len => ({ wch: Math.min(len + 3, 50) }));

      XLSX.utils.book_append_sheet(wb, ws, "Template Invoice");

      const filePath = await save({
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        defaultPath: 'Template_Invoice.xlsx'
      });

      if (!filePath) return;

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const bytes = new Uint8Array(wbout);
      await invoke('write_binary_file', { path: filePath, bytes: Array.from(bytes) });

      showToast('Template Excel Invoice berhasil diunduh!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengunduh template!', 'error');
    }
  };

  useEffect(() => {
    const actions = {
      onImport: () => document.getElementById('invoice-excel-import-input')?.click(),
      onExport: handleExportExcel,
      onDownloadTemplate: handleDownloadTemplate
    };
    registerImportExportActions('invoice-manager', actions);
    return () => {
      registerImportExportActions('invoice-manager', null);
    };
  }, [invoices, handleExportExcel, handleDownloadTemplate]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-dark)' }}>

      <FilterBar>
        <input
          type="file"
          id="invoice-excel-import-input"
          accept=".xlsx, .xls"
          style={{ display: 'none' }}
          onChange={handleImportExcel}
        />
        {/* Tombol Buat Invoice Baru */}
        <button
          className="btn-primary"
          onClick={() => {
            loadInvoiceToForm({ id: null, file_path: '', items_json: '[]', shipping_cost: 0, admin_fee: 0, total: 0 });
            setActiveModule('invoice');
          }}
          style={{
            padding: '4px 10px', borderRadius: '6px', border: 'none',
            fontSize: '12px', fontWeight: '600', cursor: 'pointer',
            background: 'var(--accent)', color: '#ffffff',
            display: 'flex', alignItems: 'center', gap: '6px',
            height: '24px', flexShrink: 0
          }}
        >
          <span>➕</span> Buat Invoice
        </button>

        {/* Sinkronisasi ke Google Sheets */}
        <button
          onClick={handleSyncAllToCloud}
          disabled={syncingAll}
          style={{
            padding: '4px 10px', borderRadius: '6px', border: 'none',
            fontSize: '12px', fontWeight: '600', cursor: syncingAll ? 'not-allowed' : 'pointer',
            background: syncingAll ? 'var(--bg-panel)' : '#1a73e8',
            color: '#ffffff',
            display: 'flex', alignItems: 'center', gap: '6px',
            height: '24px', flexShrink: 0
          }}
        >
          {syncingAll ? (
            <>
              <span className="button-spinner" style={{ width: '10px', height: '10px' }}></span>
              Menyinkron...
            </>
          ) : (
            <><span>☁️</span> Sinkron GAS</>
          )}
        </button>

        <FilterDivider />

        <FilterGroup label="🚦 Status:">
          <FilterChip label="Semua" active={selectedStatus === null} onClick={() => setSelectedStatus(null)} />
          {PAYMENT_STATUSES.map((s) => (
            <FilterChip
              key={s.value}
              label={s.label}
              active={selectedStatus === s.value}
              inactiveColor={s.color}
              onClick={() => setSelectedStatus(selectedStatus === s.value ? null : s.value)}
            />
          ))}
        </FilterGroup>
      </FilterBar>

      {/* Panel Aksi Massal */}
      {markedInvoiceIds.length > 0 && (
        <div style={{
          background: 'rgba(217, 119, 6, 0.1)',
          borderBottom: '1px solid var(--border)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
            <strong>{markedInvoiceIds.length}</strong> invoice terpilih
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleBulkMarkBermasalah}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #d97706',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                background: '#d97706',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ⚠️ Tandai Bermasalah
            </button>
            <button
              onClick={handleBulkDelete}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #dc2626',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                background: '#dc2626',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              🗑️ Hapus Terpilih
            </button>
            <button
              onClick={() => setMarkedInvoiceIds([])}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Invoice Table Container */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '8px 12px', width: '3%', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={filteredInvoices.length > 0 && markedInvoiceIds.length === filteredInvoices.length}
                  onChange={handleToggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th 
                onClick={() => handleSort('date')}
                style={{ padding: '8px 12px', fontWeight: '600', width: '10%', cursor: 'pointer', userSelect: 'none' }}
                title="Urutkan berdasarkan Tanggal"
              >
                Tanggal{renderSortIcon('date')}
              </th>
              <th style={{ padding: '8px 12px', fontWeight: '600', width: '7%' }}>Jam</th>
              <th 
                onClick={() => handleSort('invoiceNo')}
                style={{ padding: '8px 12px', fontWeight: '600', width: '14%', cursor: 'pointer', userSelect: 'none' }}
                title="Urutkan berdasarkan Nomor Invoice"
              >
                No. Invoice{renderSortIcon('invoiceNo')}
              </th>
              <th 
                onClick={() => handleSort('customerName')}
                style={{ padding: '8px 12px', fontWeight: '600', width: '18%', cursor: 'pointer', userSelect: 'none' }}
                title="Urutkan berdasarkan Nama Pelanggan"
              >
                Pelanggan{renderSortIcon('customerName')}
              </th>
              <th 
                onClick={() => handleSort('total')}
                style={{ padding: '8px 12px', fontWeight: '600', width: '10%', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                title="Urutkan berdasarkan Total Nominal"
              >
                Nominal{renderSortIcon('total')}
              </th>
              <th 
                onClick={() => handleSort('status')}
                style={{ padding: '8px 12px', fontWeight: '600', width: '10%', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                title="Urutkan berdasarkan Status Pembayaran"
              >
                Status{renderSortIcon('status')}
              </th>
              <th 
                onClick={() => handleSort('fileStatus')}
                style={{ padding: '8px 12px', fontWeight: '600', width: '11%', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                title="Urutkan berdasarkan Status Berkas"
              >
                Berkas{renderSortIcon('fileStatus')}
              </th>
              <th style={{ padding: '8px 12px', fontWeight: '600', width: '20%', textAlign: 'center', position: 'sticky', right: 0, background: 'var(--bg-panel)', zIndex: 2 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <TableEmptyState
                colSpan={9}
                icon="🧾"
                message="Tidak ada invoice yang ditemukan"
                description={searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : undefined}
              />
            ) : (
              filteredInvoices.map((inv) => {
                const metadata = getInvoiceMetadata(inv);
                const status = metadata.paymentStatus || 'BERMASALAH';
                const fileEntry = files.find(f => f.type === 'invoice' && f.version_label === String(inv.id));
                const hasFile = !!fileEntry;
                const isSelected = fileEntry
                  ? fileEntry.id === selectedFileId
                  : previewInvoiceId === inv.id;
                
                return (
                  <tr 
                    key={inv.id} 
                    ref={isSelected ? (el) => {
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                    } : undefined}
                    style={{ 
                      borderBottom: '1px solid var(--border)', 
                      transition: 'background 0.15s ease', 
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(192, 28, 28, 0.12)' : 'transparent'
                    }}
                    onClick={() => {
                      if (fileEntry) {
                        setSelectedFileId(fileEntry.id || null);
                        setPreviewInvoiceId(null);
                      } else {
                        setSelectedFileId(null);
                        setPreviewInvoiceId(inv.id || null);
                      }
                      setRightPanelVisible(true);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isSelected ? 'rgba(192, 28, 28, 0.18)' : 'rgba(0, 0, 0, 0.015)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(192, 28, 28, 0.12)' : 'transparent'}
                  >
                    {/* Checkbox Seleksi */}
                    <td onClick={(e) => e.stopPropagation()} style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={markedInvoiceIds.includes(inv.id!)}
                        onChange={() => {
                          setMarkedInvoiceIds(prev => 
                            prev.includes(inv.id!) ? prev.filter(x => x !== inv.id!) : [...prev, inv.id!]
                          );
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    {/* Tanggal */}
                    <td style={{ padding: '6px 12px', color: 'var(--text-primary)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                      {metadata.invoiceDate ? formatDateId(metadata.invoiceDate) : new Date(inv.created_at).toLocaleDateString('id-ID')}
                    </td>
                    
                    {/* Jam */}
                    <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const dateStr = metadata.invoiceDate || inv.created_at;
                        try {
                          const d = new Date(dateStr);
                          if (isNaN(d.getTime())) return '-';
                          return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        } catch { return '-'; }
                      })()}
                    </td>
                    
                    {/* No Invoice */}
                    <td style={{ padding: '6px 12px', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {metadata.invoiceNo || 'DRAF'}
                    </td>
                    
                    {/* Pelanggan */}
                    <td style={{ padding: '6px 12px', color: 'var(--text-primary)' }}>
                      <div style={{ fontWeight: '600' }}>{metadata.customerName || 'Umum'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        WA: {metadata.customerWa || '-'}
                      </div>
                    </td>
                    
                    {/* Nominal */}
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: '13px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {formatPrice(inv.total)}
                      </span>
                      {status === 'DP' && inv.paid_amount && inv.paid_amount > 0 && (
                        <>
                          <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>–</span>
                          <span style={{ color: '#2563eb', fontWeight: '600' }}>DP: {formatPrice(inv.paid_amount)}</span>
                          <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>–</span>
                          <span style={{ color: '#dc2626', fontWeight: '600' }}>Sisa: {formatPrice(inv.total - inv.paid_amount)}</span>
                        </>
                      )}
                    </td>
                    
                    {/* Status Invoice */}
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <StatusBadge status={status} size="sm" />
                    </td>

                    {/* Status Berkas */}
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <StatusBadge status={fileEntry?.status || 'draft'} size="sm" />
                    </td>
                    
                    {/* Aksi */}
                    <td onClick={(e) => e.stopPropagation()} style={{ padding: '6px 12px', textAlign: 'center', position: 'sticky', right: 0, background: isSelected ? '#fce8e8' : 'var(--bg-card)', zIndex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {/* Edit / Reload */}
                        <button
                          onClick={() => handleEdit(inv)}
                          title="Edit / Muat Ulang ke Generator"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        
                        {/* Cetak / Lihat PDF */}
                        {hasFile && (
                          <button
                            onClick={() => handleOpenPDF(inv.id!)}
                            title="Buka Berkas PDF Invoice"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                              <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                          </button>
                        )}
                        {/* Buka Lokasi */}
                        {hasFile && (
                          <button
                            onClick={() => handleOpenFileLocation(inv.id!)}
                            title="Buka Lokasi Berkas"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                          </button>
                        )}
                        {/* Pindahkan */}
                        {hasFile && (
                          <button
                            onClick={() => handleMoveFile(inv.id!)}
                            title="Pindahkan Berkas"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 11H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2M12 3v12m0 0l-4-4m4 4l4-4"/>
                            </svg>
                          </button>
                        )}

                        {/* Sync Cloud Ulang (jika pending/gagal) */}
                        {inv.sync_status !== 'synced' && (
                          <button
                            onClick={() => handleSyncCloud(inv)}
                            title={syncingInvoiceId === inv.id ? "Sedang menyinkronkan..." : "Sinkronkan Ulang ke Cloud"}
                            disabled={syncingInvoiceId !== null}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-secondary)',
                              cursor: syncingInvoiceId !== null ? 'not-allowed' : 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {syncingInvoiceId === inv.id ? (
                              <span className="button-spinner" style={{ width: '10px', height: '10px' }}></span>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                              </svg>
                            )}
                          </button>
                        )}

                        {/* Hapus Single Invoice */}
                        <button
                          onClick={() => handleDeleteInvoice(inv.id!, metadata.invoiceNo || 'DRAF')}
                          title="Hapus Invoice Ini"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#dc2626',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceManager;
