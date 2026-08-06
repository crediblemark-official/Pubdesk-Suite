import React, { useState, useMemo, useEffect } from 'react';
import { useDataMasterContext } from '../../contexts/DataMasterContext';
import { useAppContext } from '../../contexts/AppContext';
import { Naskah } from '../../types/data-master.types';
import NaskahOrderForm from './NaskahOrderForm';
import { TableEmptyState } from '../../ui/molecules/EmptyState';
import { Button } from '../../ui/atoms/Button';
import { Badge } from '../../ui/atoms/Badge';
import { FilterBar, FilterGroup, FilterChip, FilterDivider } from '../../ui/molecules/FilterBar';
import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface NaskahOrdersManagerProps {
  searchQuery?: string;
}

const statusVariantMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'> = {
  'Belum Dimulai': 'neutral',
  'Sedang Dikerjakan': 'warning',
  'Selesai': 'success',
  'Batal': 'danger'
};

const STATUS_LIST = ['Belum Dimulai', 'Sedang Dikerjakan', 'Selesai', 'Batal'];

const NaskahOrdersManager: React.FC<NaskahOrdersManagerProps> = ({ searchQuery = '' }) => {
  const { naskah, penulis, penerbit, addNaskah, updateNaskah, deleteNaskah } = useDataMasterContext();
  const { 
    books,
    showConfirm, 
    showToast, 
    setSelectedNaskahId, 
    setRightPanelVisible, 
    addFile, 
    files, 
    registerImportExportActions,
    directAddNewModule,
    setDirectAddNewModule
  } = useAppContext();

  useEffect(() => {
    const actions = {
      onImport: () => document.getElementById('naskah-excel-import-input')?.click(),
      onExport: handleExportExcel,
      onDownloadTemplate: handleDownloadTemplate
    };
    registerImportExportActions('naskah', actions);
    return () => {
      registerImportExportActions('naskah', null);
    };
  }, [naskah, penulis, penerbit]);

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
          const title = row["Judul Naskah"] || row.Judul || row.judul || row.Title || row.title;
          if (!title) {
            errorCount++;
            continue;
          }

          // Lookup penulis_id by name
          let penulis_id: number | undefined = undefined;
          const penulisName = row.Penulis || row["Nama Penulis"] || row.penulis || row.Author || row.author;
          if (penulisName) {
            const foundPenulis = penulis.find(p => p.name.toLowerCase() === String(penulisName).trim().toLowerCase());
            if (foundPenulis) {
              penulis_id = foundPenulis.id;
            }
          }

          // Lookup penerbit_id by name
          let penerbit_id: number | undefined = undefined;
          const penerbitName = row.Penerbit || row["Nama Penerbit"] || row.penerbit || row.Publisher || row.publisher;
          if (penerbitName) {
            const foundPenerbit = penerbit.find(p => p.name.toLowerCase() === String(penerbitName).trim().toLowerCase());
            if (foundPenerbit) {
              penerbit_id = foundPenerbit.id;
            }
          }

          const genre = row.Genre || row.genre || row.Kategori || row.kategori;
          const total_pages = parseInt(row.Halaman || row.halaman || row.Pages || row.pages || '0', 10);
          const copies = parseInt(row.Eksemplar || row.eksemplar || row.Copies || row.copies || '0', 10);
          const book_size = row["Ukuran Buku"] || row["Ukuran"] || row.book_size || row.size;
          const order_type = row["Tipe Pesanan"] || row["Jenis Pesanan"] || row.order_type;
          const legal_type = row["Tipe Legalitas"] || row["Legalitas"] || row.legal_type;
          const status = row.Status || row.status || 'Belum Dimulai';

          try {
            const newId = await addNaskah({
              title: String(title).trim(),
              penulis_id,
              penerbit_id,
              genre: genre ? String(genre).trim() : undefined,
              total_pages: isNaN(total_pages) ? undefined : total_pages,
              copies: isNaN(copies) ? undefined : copies,
              book_size: book_size ? String(book_size).trim() : undefined,
              order_type: order_type ? String(order_type).trim() : undefined,
              legal_type: legal_type ? String(legal_type).trim() : undefined,
              status: status ? String(status).trim() : 'Belum Dimulai',
            });

            if (newId && status && String(status).trim() !== 'Belum Dimulai') {
              await updateNaskah({
                id: newId,
                title: String(title).trim(),
                penulis_id,
                penerbit_id,
                genre: genre ? String(genre).trim() : undefined,
                total_pages: isNaN(total_pages) ? undefined : total_pages,
                copies: isNaN(copies) ? undefined : copies,
                book_size: book_size ? String(book_size).trim() : undefined,
                order_type: order_type ? String(order_type).trim() : undefined,
                legal_type: legal_type ? String(legal_type).trim() : undefined,
                status: String(status).trim(),
                created_at: new Date().toISOString()
              });
            }
            importedCount++;
          } catch (err) {
            console.error('Gagal mengimpor baris naskah:', err);
            errorCount++;
          }
        }

        showToast(`Impor naskah berhasil! ${importedCount} data dimasukkan.${errorCount > 0 ? ` Gagal: ${errorCount}` : ''}`, 'success');
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
      if (naskah.length === 0) {
        showToast('Tidak ada naskah untuk diekspor!', 'info');
        return;
      }

      const exportData = naskah.map((o, idx) => ({
        "No": idx + 1,
        "Kode Naskah": o.naskah_id_code || '',
        "Judul Naskah": o.title,
        "Penulis": getPenulisName(o.penulis_id),
        "Penerbit": getPenerbitName(o.penerbit_id),
        "Genre": o.genre || '',
        "Halaman": o.total_pages || 0,
        "Tipe Pesanan": o.order_type || '',
        "Eksemplar": o.copies || 0,
        "Ukuran Buku": o.book_size || '',
        "Tipe Legalitas": o.legal_type || '',
        "Alamat Pengiriman": o.shipping_address || '',
        "Status": o.status || 'Belum Dimulai',
        "Tanggal Dibuat": o.created_at ? o.created_at.substring(0, 10) : ''
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const maxLens = Object.keys(exportData[0] || {}).map(key => {
        return Math.max(
          key.length,
          ...exportData.map(row => String((row as any)[key] || '').length)
        );
      });
      ws['!cols'] = maxLens.map(len => ({ wch: Math.min(len + 3, 50) }));

      XLSX.utils.book_append_sheet(wb, ws, "Daftar Naskah");

      const filePath = await save({
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        defaultPath: 'Naskah_Orders_Export.xlsx'
      });

      if (!filePath) return;

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const bytes = new Uint8Array(wbout);
      await invoke('write_binary_file', { path: filePath, bytes: Array.from(bytes) });

      showToast('Data Naskah berhasil diekspor!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengekspor data naskah!', 'error');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const templateData = [
        {
          "Judul Naskah": "Lentera Senja",
          "Penulis": "Budi Santoso",
          "Penerbit": "PT. Aksara Nusantara",
          "Genre": "Novel Fiksi",
          "Halaman": 240,
          "Tipe Pesanan": "Cetak Aja",
          "Eksemplar": 1000,
          "Ukuran Buku": "14x20 cm",
          "Tipe Legalitas": "ISBN",
          "Status": "Belum Dimulai"
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

      XLSX.utils.book_append_sheet(wb, ws, "Template Naskah");

      const filePath = await save({
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        defaultPath: 'Template_Naskah_Orders.xlsx'
      });

      if (!filePath) return;

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const bytes = new Uint8Array(wbout);
      await invoke('write_binary_file', { path: filePath, bytes: Array.from(bytes) });

      showToast('Template Excel Naskah berhasil diunduh!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengunduh template!', 'error');
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Naskah | null>(null);

  useEffect(() => {
    if (directAddNewModule === 'naskah') {
      setCurrentOrder(null);
      setActiveStatuses([]);
      setGenreFilter('');
      setIsEditing(true);
      setDirectAddNewModule(null);
    }
  }, [directAddNewModule]);

  // ID baris yang sedang terseleksi (highlight lokal)
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Filter badge state (bisa multi-pilih status)
  const [filterType, setFilterType] = useState<'status' | 'genre'>('status');
  const [activeStatuses, setActiveStatuses] = useState<string[]>([]);
  const [genreFilter, setGenreFilter] = useState('');

  const allBukuNaskah = useMemo(() => {
    const booksAsNaskah: Naskah[] = (books || []).map((b) => ({
      id: b.id ? b.id + 1000000 : Math.floor(Math.random() * 100000),
      title: b.title,
      penulis_id: b.author_id,
      order_type: 'Karya / Buku',
      copies: 0,
      book_size: b.weight_grams ? `${b.weight_grams}g` : '-',
      status: 'Selesai',
      genre: 'Karya',
      created_at: b.created_at || new Date().toISOString(),
      naskah_id_code: b.isbn ? `ISBN: ${b.isbn}` : `BOOK-${b.id}`
    }));

    return [...naskah, ...booksAsNaskah];
  }, [naskah, books]);

  // Daftar genre unik dari data yang ada
  const genres = useMemo(() => {
    const set = new Set(allBukuNaskah.map((o) => o.genre).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [allBukuNaskah]);

  const getPenulisName = (id?: number) => {
    if (!id) return '-';
    const found = penulis.find((p) => p.id === id);
    return found ? found.name : `Penulis #${id}`;
  };

  const getPenerbitName = (id?: number) => {
    if (!id) return '-';
    const found = penerbit.find((p) => p.id === id);
    return found ? found.name : `Penerbit #${id}`;
  };

  // Toggle status badge filter
  const toggleStatus = (status: string) => {
    setActiveStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  // Filter naskah / buku
  const filteredOrders = useMemo(() => {
    return allBukuNaskah.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        o.title.toLowerCase().includes(q) ||
        (o.naskah_id_code && o.naskah_id_code.toLowerCase().includes(q)) ||
        getPenulisName(o.penulis_id).toLowerCase().includes(q) ||
        getPenerbitName(o.penerbit_id).toLowerCase().includes(q) ||
        (o.genre && o.genre.toLowerCase().includes(q));
      const matchStatus = activeStatuses.length === 0 || activeStatuses.includes(o.status);
      const matchGenre = genreFilter ? o.genre === genreFilter : true;
      return matchSearch && matchStatus && matchGenre;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBukuNaskah, searchQuery, activeStatuses, genreFilter, penulis, penerbit]);

  // Hitung per-status untuk badge info
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_LIST.forEach((s) => { counts[s] = 0; });
    allBukuNaskah.forEach((o) => { if (counts[o.status] !== undefined) counts[o.status]++; });
    return counts;
  }, [allBukuNaskah]);

  const handleAddNew = () => {
    setCurrentOrder(null);
    setActiveStatuses([]);
    setGenreFilter('');
    setIsEditing(true);
  };

  const handleEdit = (order: Naskah, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentOrder(order);
    setIsEditing(true);
  };

  // Single click — seleksi baris & simpan ke context
  const handleRowClick = (id?: number) => {
    if (id) {
      setSelectedId(id);
      setSelectedNaskahId(id);
    }
  };

  // Double click — buka panel preview kanan
  const handleRowDoubleClick = (id?: number) => {
    if (id) {
      setSelectedId(id);
      setSelectedNaskahId(id);
      setRightPanelVisible(true);
    }
  };

  const handleDelete = (id: number, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm({
      title: 'Hapus Naskah',
      message: `Apakah Anda yakin ingin menghapus naskah "${title}"?`,
      confirmText: 'Hapus',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteNaskah(id);
          showToast('Data naskah berhasil dihapus!', 'success');
        } catch (err) {
          console.error(err);
          showToast('Gagal menghapus naskah!', 'error');
        }
      }
    });
  };

  const registerNaskahFile = async (naskahId: number, naskahData: Naskah) => {
    try {
      const filename = `Naskah-${naskahId}.json`;
      const jsonString = JSON.stringify(naskahData);
      const bytes = new TextEncoder().encode(jsonString);
      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
      const physicalPath = await tauriInvoke<string>('create_physical_file', {
        filename,
        bytes: Array.from(bytes),
        folder: 'naskah'
      });
      const alreadyExists = files.some(f => f.filename === filename && f.type === 'naskah');
      if (!alreadyExists) {
        await addFile({
          filename,
          path: physicalPath,
          type: 'naskah',
          project_id: undefined,
          version_label: String(naskahId),
          status: 'Tersimpan',
          last_modified: new Date().toISOString(),
          is_readonly: false
        });
      }
    } catch (err) {
      console.error('Gagal mendaftarkan file naskah:', err);
    }
  };

  const handleFormSubmit = async (data: Omit<Naskah, 'created_at' | 'id'> & { id?: number }) => {
    try {
      if (data.id) {
        const original = naskah.find((o) => o.id === data.id);
        if (original) {
          await updateNaskah({ ...original, ...data } as Naskah);
          showToast('Data naskah berhasil diperbarui!', 'success');
          await registerNaskahFile(data.id, { ...original, ...data } as Naskah);
        }
      } else {
        const newId = await addNaskah(data as Omit<Naskah, 'created_at'>);
        if (!newId) throw new Error('Gagal menyimpan naskah');
        showToast('Naskah baru berhasil ditambahkan!', 'success');
        await registerNaskahFile(newId, { ...data, id: newId } as Naskah);
      }
      setIsEditing(false);
      setCurrentOrder(null);
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan data naskah!', 'error');
    }
  };

  if (isEditing) {
    return (
      <NaskahOrderForm
        initialData={currentOrder}
        onSubmit={handleFormSubmit}
        onCancel={() => { setIsEditing(false); setCurrentOrder(null); }}
      />
    );
  }

  const hasActiveFilter = activeStatuses.length > 0 || !!genreFilter || !!searchQuery;

  return (
    <div className="customer-list-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-dark)' }}>
      <input
        type="file"
        id="naskah-excel-import-input"
        accept=".xlsx, .xls"
        style={{ display: 'none' }}
        onChange={handleImportExcel}
      />

      <FilterBar
        actions={
          <Button onClick={handleAddNew} variant="primary" size="sm" icon="➕" />
        }
      >
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{filteredOrders.length}</strong>
          {' '}dari{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{allBukuNaskah.length}</strong>
          {' '}buku/naskah
        </span>

        <FilterDivider />

        <FilterGroup label="🔍 FILTER:">
          <FilterChip 
            label="Status" 
            active={filterType === 'status'} 
            onClick={() => { setFilterType('status'); setGenreFilter(''); }} 
          />
          {genres.length > 0 && (
            <FilterChip 
              label="Genre" 
              active={filterType === 'genre'} 
              onClick={() => { setFilterType('genre'); setActiveStatuses([]); }} 
            />
          )}
        </FilterGroup>

        {filterType === 'status' && (
          <>
            <FilterDivider />
            <FilterGroup label="🚦 STATUS:">
              <FilterChip label="Semua" active={activeStatuses.length === 0} onClick={() => setActiveStatuses([])} />
              {STATUS_LIST.map((status) => {
                const variant = statusVariantMap[status] || 'neutral';
                const colorMap: Record<string, string> = { success: '#22c55e', warning: '#e6a817', danger: '#ef4444', info: '#3b82f6' };
                return (
                  <FilterChip
                    key={status}
                    label={`${status} (${statusCounts[status]})`}
                    active={activeStatuses.includes(status)}
                    inactiveColor={colorMap[variant] ?? undefined}
                    onClick={() => toggleStatus(status)}
                  />
                );
              })}
            </FilterGroup>
          </>
        )}

        {filterType === 'genre' && genres.length > 0 && (
          <>
            <FilterDivider />
            <FilterGroup label="📂 GENRE:">
              <FilterChip label="Semua" active={genreFilter === ''} onClick={() => setGenreFilter('')} />
              {genres.map((g) => (
                <FilterChip key={g} label={g} active={genreFilter === g} onClick={() => setGenreFilter(g)} />
              ))}
            </FilterGroup>
          </>
        )}
      </FilterBar>

      {/* Tabel */}
      <div style={{ flex: 1, overflowX: 'auto', background: 'var(--bg-card)' }}>
        <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '8px 12px', fontWeight: '600', userSelect: 'none', whiteSpace: 'nowrap' }}>Judul &amp; Identitas</th>
              <th style={{ padding: '8px 12px', fontWeight: '600', userSelect: 'none', whiteSpace: 'nowrap' }}>Penulis</th>
              <th style={{ padding: '8px 12px', fontWeight: '600', userSelect: 'none', whiteSpace: 'nowrap' }}>Penerbit</th>
              <th style={{ padding: '8px 12px', fontWeight: '600', userSelect: 'none', whiteSpace: 'nowrap' }}>Tipe</th>
              <th style={{ padding: '8px 12px', fontWeight: '600', userSelect: 'none', whiteSpace: 'nowrap' }}>Eks</th>
              <th style={{ padding: '8px 12px', fontWeight: '600', userSelect: 'none', whiteSpace: 'nowrap' }}>Ukuran</th>
              <th style={{ padding: '8px 12px', fontWeight: '600', userSelect: 'none', whiteSpace: 'nowrap' }}>Genre</th>
              <th style={{ padding: '8px 12px', fontWeight: '600', userSelect: 'none', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ padding: '8px 12px', fontWeight: '600', textAlign: 'left', userSelect: 'none', whiteSpace: 'nowrap', position: 'sticky', right: 0, background: 'var(--bg-panel)', zIndex: 3, boxShadow: '-2px 0 4px rgba(0,0,0,0.06)' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <TableEmptyState
                colSpan={9}
                icon="📚"
                message="Tidak ada data buku / naskah"
                description={hasActiveFilter ? 'Tidak ada hasil untuk filter yang dipilih.' : 'Belum ada buku / naskah terdaftar. Klik Tambah Naskah untuk menambahkan.'}
              />
            ) : (
              filteredOrders.map((o) => (
                <tr
                  key={o.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: selectedId === o.id ? 'rgba(192, 28, 28, 0.08)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                    color: 'var(--text-primary)'
                  }}
                  onClick={() => handleRowClick(o.id)}
                  onDoubleClick={() => handleRowDoubleClick(o.id)}
                  onMouseEnter={(e) => {
                    if (selectedId !== o.id) e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                  }}
                  onMouseLeave={(e) => {
                    if (selectedId !== o.id) e.currentTarget.style.background = 'transparent';
                  }}
                >
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: '600' }}>{o.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {o.naskah_id_code && <span>ID: {o.naskah_id_code}</span>}
                      {o.total_pages && <span style={{ marginLeft: '8px' }}>· {o.total_pages} hlm</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    👤 {getPenulisName(o.penulis_id)}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    🏢 {getPenerbitName(o.penerbit_id)}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {o.order_type ? (
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: 'rgba(192, 28, 28, 0.08)',
                        color: 'var(--accent)'
                      }}>
                        {o.order_type}
                      </span>
                    ) : <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>-</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    {o.copies ?? '-'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {o.book_size || '-'}
                  </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {o.genre ? (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: 'rgba(192, 28, 28, 0.08)',
                        color: 'var(--accent)'
                      }}>
                        {o.genre}
                      </span>
                    ) : <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>-</span>}
                  </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <Badge
                      label={o.status}
                      variant={statusVariantMap[o.status] || 'neutral'}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', right: 0, background: 'var(--bg-card)', zIndex: 2, boxShadow: '-2px 0 4px rgba(0,0,0,0.06)' }}>
                      <button onClick={(e) => handleEdit(o, e)} style={{background:'none',border:'none',cursor:'pointer',padding:'2px',fontSize:'16px',lineHeight:1}} title="Edit">✏️</button>
                      <button onClick={(e) => o.id && handleDelete(o.id, o.title, e)} style={{background:'none',border:'none',cursor:'pointer',padding:'2px',fontSize:'16px',lineHeight:1}} title="Hapus">🗑️</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NaskahOrdersManager;
