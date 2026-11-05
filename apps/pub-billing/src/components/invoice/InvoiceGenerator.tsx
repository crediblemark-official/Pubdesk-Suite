import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useInvoiceContext } from '../../contexts/InvoiceContext';
import { useDataMasterContext } from '../../contexts/DataMasterContext';
import { Accordion, AccordionSection } from '../../ui/molecules/Accordion';
import { formatPdfFilename } from '../../utils/invoice';
import { MetadataSection } from './generator-sections/MetadataSection';
import { CustomerSection } from './generator-sections/CustomerSection';
import { ItemsSection } from './generator-sections/ItemsSection';
import { GlobalCostsSection } from './generator-sections/GlobalCostsSection';
import InvoicePreview from './InvoicePreview';

const InvoiceGenerator: React.FC = () => {
  const { addInvoice, updateInvoice, addFile, showToast, rightPanelVisible, invoices, files, contacts, addContact, updateContact, setActiveModule } = useAppContext();
  const { loadPenulis, addPenulis } = useDataMasterContext();
  const {
    customer,
    items,
    shippingCost,
    adminFee,
    additionalFees,
    globalDiscount,
    globalCashback,
    invoiceType,
    invoiceNo,
    setInvoiceNo,
    invoiceHal,
    invoiceLampiran,
    invoiceDate,
    paymentStatus,
    spesifikasiFasilitas,
    calculateItemTotal,
    calculateTotal,
    resetInvoice,
    activeProfile,
    editingInvoiceId,
    selectedLayoutId,
    setSelectedLayoutId,
    paidAmount,
    paymentNotes,
  } = useInvoiceContext();

  const [expandedSection, setExpandedSection] = useState<number | null>(1);
  const [lastGeneratedProfileId, setLastGeneratedProfileId] = useState<string | null>(null);
  const [loadingSimpanCatat, setLoadingSimpanCatat] = useState(false);
  const [loadingCatatOnly, setLoadingCatatOnly] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  // Auto-generate nomor invoice secara dinamis berdasarkan format profil aktif
  useEffect(() => {
    if (!editingInvoiceId) {
      const profileId = activeProfile?.id || null;
      const isProfileChanged = profileId !== lastGeneratedProfileId;
      const isInvoiceNoEmpty = !invoiceNo;

      if (isProfileChanged || isInvoiceNoEmpty) {
        const format = activeProfile?.invoiceNoFormat || 'KBM/{year}/{month}/{day}/{seq}';
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const seq = String(invoices.length + 1).padStart(4, '0');

        const generatedNo = format
          .replace(/{year}/g, year)
          .replace(/{month}/g, month)
          .replace(/{day}/g, day)
          .replace(/{seq}/g, seq);

        setInvoiceNo(generatedNo);
        setLastGeneratedProfileId(profileId);
      }
    }
  }, [invoices.length, activeProfile, setInvoiceNo, editingInvoiceId, invoiceNo, lastGeneratedProfileId]);

  // Validasi data sebelum menyimpan
  const validateInvoice = (): boolean => {
    if (!customer.name) {
      showToast('Nama pelanggan harus diisi!', 'error');
      return false;
    }
    if (!invoiceHal.trim()) {
      showToast('Hal (Perihal) harus diisi!', 'error');
      return false;
    }
    if (!invoiceLampiran.trim()) {
      showToast('Lampiran harus diisi! Jika tidak ada, isi dengan "-"', 'error');
      return false;
    }
    if (items.length === 0) {
      showToast('Item pesanan tidak boleh kosong!', 'error');
      return false;
    }
    return true;
  };

  // Siapkan data invoice untuk disimpan
  const prepareInvoiceData = async () => {
    const isPenulis = customer.isPenulis;
    let contactId: number | undefined = undefined;
    const customerNameTrimmed = (customer.name || '').trim();

    const existingContact = contacts.find(c => c.name.toLowerCase() === customerNameTrimmed.toLowerCase());

    if (existingContact) {
      contactId = existingContact.id;
      let newType = existingContact.type;
      if (isPenulis) {
        if (existingContact.type === 'customer') newType = 'both';
      } else {
        if (existingContact.type === 'penulis') newType = 'both';
      }

      const hasWaChanged = (customer.wa_number?.trim() || '') !== (existingContact.wa_number || '');
      const hasEmailChanged = (customer.email?.trim() || '') !== (existingContact.email || '');
      const hasAddressChanged = (customer.address?.trim() || '') !== (existingContact.address || '');
      const hasTypeChanged = newType !== existingContact.type;

      if (hasWaChanged || hasEmailChanged || hasAddressChanged || hasTypeChanged) {
        try {
          await updateContact({
            ...existingContact,
            wa_number: customer.wa_number?.trim() || existingContact.wa_number,
            email: customer.email?.trim() || existingContact.email,
            address: customer.address?.trim() || existingContact.address,
            type: newType
          });
          if (newType === 'both' || newType === 'penulis') await loadPenulis();
        } catch (err) {
          console.error('Gagal memperbarui data kontak:', err);
        }
      }
    } else {
      try {
        if (isPenulis) {
          contactId = await addPenulis({
            name: customerNameTrimmed,
            wa_number: customer.wa_number?.trim() || '',
            email: customer.email?.trim() || '',
            address: customer.address?.trim() || '',
            data_source: 'Invoice', email_valid: 0, wa_valid: 0
          });
        } else {
          contactId = await addContact({
            name: customerNameTrimmed,
            wa_number: customer.wa_number?.trim() || undefined,
            email: customer.email?.trim() || undefined,
            address: customer.address?.trim() || undefined,
            type: 'customer', needs_review: 1,
            created_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Gagal menyimpan pelanggan:', err);
      }
    }

    const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const hasItemShipping = activeProfile?.tableColumns?.some(col => col.key === 'item_shipping_cost');
    const globalShip = hasItemShipping ? 0 : shippingCost;
    const additionalFeesTotal = (additionalFees || []).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    const total = itemsTotal + globalShip + adminFee + additionalFeesTotal;
    const finalPaidAmount = paymentStatus === 'LUNAS' ? total : paidAmount;
    const remainingAmount = Math.max(0, total - finalPaidAmount);

    const metadata = {
      invoiceNo, invoiceDate, invoiceHal, invoiceLampiran, paymentStatus,
      spesifikasiFasilitas, invoiceType,
      profileId: activeProfile?.id,
      pdfFilenameFormat: activeProfile?.pdfFilenameFormat,
      customerName: customerNameTrimmed, customerWa: customer.wa_number || '',
      customerEmail: customer.email || '', customerAddress: customer.address || '', isPenulis,
      selectedLayoutId,
      paidAmount: finalPaidAmount,
      paymentNotes,
      additionalFees,
      globalDiscount,
      globalCashback
    };

    return {
      id: editingInvoiceId || undefined,
      created_at: new Date().toISOString(),
      customer_id: contactId || null,
      items_json: JSON.stringify(items),
      shipping_cost: shippingCost,
      admin_fee: adminFee,
      additional_fees: additionalFees,
      total,
      export_format: invoiceType,
      file_path: JSON.stringify(metadata),
      customer_snapshot: JSON.stringify({
        name: customerNameTrimmed, wa_number: customer.wa_number || '',
        email: customer.email || '', address: customer.address || '', isPenulis
      }),
      payment_status: paymentStatus,
      paid_amount: finalPaidAmount,
      remaining_amount: remainingAmount,
      payment_notes: paymentNotes
    };
  };

  // Simpan saja (Catat) — tanpa PDF, tanpa GAS
  const handleCatatOnly = async () => {
    if (!validateInvoice()) return;
    setLoadingCatatOnly(true);
    try {
      const invoiceData = await prepareInvoiceData();
      if (editingInvoiceId) {
        await updateInvoice(invoiceData as any);
        showToast('Invoice berhasil diperbarui!', 'success');
      } else {
        await addInvoice(invoiceData as any);
        showToast('Invoice berhasil dicatat!', 'success');
      }
      resetInvoice();
    } catch (error) {
      console.error(error);
      showToast(`Gagal menyimpan: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoadingCatatOnly(false);
    }
  };

  // Simpan & Catat + Download PDF
  const handleSimpanCatat = async () => {
    if (!validateInvoice()) return;
    setLoadingSimpanCatat(true);
    try {
      const invoiceData = await prepareInvoiceData();
      let invoiceId = editingInvoiceId;
      if (editingInvoiceId) {
        await updateInvoice(invoiceData as any);
      } else {
        invoiceId = await addInvoice(invoiceData as any);
      }

      // Generate & simpan PDF secara aman (Base64 + scale 2x)
      const { generateInvoicePDFBytes, createPhysicalFileSafely } = await import('../../utils/pdfGenerator');
      const bytes = await generateInvoicePDFBytes('invoice-preview-export');
      const totalAmount = calculateTotal();
      const filename = formatPdfFilename(activeProfile?.pdfFilenameFormat, {
        profileName: activeProfile?.name,
        invoiceNo,
        invoiceHal,
        invoiceLampiran,
        invoiceDate,
        customerName: customer.name,
        customerWa: customer.wa_number,
        customerEmail: customer.email,
        customerAddress: customer.address,
        paymentStatus,
        companyName: activeProfile?.companyName,
        actionLabel: activeProfile?.actionLabel,
        items,
        totalAmount,
        paidAmount: paidAmount,
        remainingAmount: Math.max(0, totalAmount - paidAmount)
      });

      // Simpan ke disk & register file entry via Base64 IPC yang aman (menghindari OOM JSON IPC)
      const physicalPath = await createPhysicalFileSafely(filename, bytes, 'invoices');
      const existingFile = files.find(f => f.type === 'invoice' && f.version_label === String(invoiceId) && f.filename === filename);
      if (!existingFile) {
        await addFile({
          filename,
          path: physicalPath,
          type: 'invoice',
          project_id: undefined,
          version_label: String(invoiceId),
          status: 'final',
          last_modified: new Date().toISOString(),
          is_readonly: false
        });
      }

      // Download browser fallback hanya jika dijalankan di mode web browser (bukan Tauri desktop)
      const isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__);
      if (!isTauri) {
        const blob = new Blob([bytes as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1500);
      }

      showToast('Invoice berhasil disimpan & PDF dibuat!', 'success');
      resetInvoice();
    } catch (error) {
      console.error(error);
      showToast(`Gagal: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoadingSimpanCatat(false);
    }
  };

  const handleReset = async () => {
    setLoadingReset(true);
    try {
      resetInvoice();
      await new Promise(resolve => setTimeout(resolve, 400));
    } finally {
      setLoadingReset(false);
    }
  };


  return (
    <div className="invoice-generator" style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveModule('home')}
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px 10px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: '600',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-card)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-panel)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          🏠 Beranda
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
          {editingInvoiceId ? '📝 Edit Invoice' : 'Pembuat Invoice'}
        </h1>
      </div>

      <Accordion>
        <AccordionSection index={1} title="📄 Jenis & Metadata Invoice" expandedSection={expandedSection} onToggle={setExpandedSection}>
          <MetadataSection rightPanelVisible={rightPanelVisible} />
        </AccordionSection>

        <AccordionSection index={2} title="💬 Data Pelanggan" expandedSection={expandedSection} onToggle={setExpandedSection}>
          <CustomerSection />
        </AccordionSection>

        <AccordionSection
          index={3}
          title="📦 Rincian Item"
          expandedSection={expandedSection}
          onToggle={setExpandedSection}
          headerAction={
            activeProfile?.customLayouts && activeProfile.customLayouts.length > 0 ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedLayoutId('')}
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: '1px solid ' + (selectedLayoutId === '' ? 'var(--accent)' : 'var(--border)'),
                    background: selectedLayoutId === '' ? 'var(--accent)' : 'transparent',
                    color: selectedLayoutId === '' ? '#fff' : 'var(--text-primary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {activeProfile?.defaultLayoutName || 'Default / Bawaan'}
                </button>
                {activeProfile.customLayouts.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => setSelectedLayoutId(layout.id)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid ' + (selectedLayoutId === layout.id ? 'var(--accent)' : 'var(--border)'),
                      background: selectedLayoutId === layout.id ? 'var(--accent)' : 'transparent',
                      color: selectedLayoutId === layout.id ? '#fff' : 'var(--text-primary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {layout.name}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          <ItemsSection />
        </AccordionSection>

        <AccordionSection index={4} title="💰 Biaya Tambahan (Global)" expandedSection={expandedSection} onToggle={setExpandedSection}>
          <GlobalCostsSection />
        </AccordionSection>
      </Accordion>

      {/* Aksi Utama */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <button
          className="btn-primary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={handleSimpanCatat}
          disabled={loadingSimpanCatat || loadingCatatOnly || loadingReset}
        >
          {loadingSimpanCatat ? (
            <>
              <span className="button-spinner"></span>
              Menyimpan...
            </>
          ) : (
            <>💾 Simpan &amp; Catat</>
          )}
        </button>
        <button
          className="btn-secondary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={handleCatatOnly}
          disabled={loadingSimpanCatat || loadingCatatOnly || loadingReset}
        >
          {loadingCatatOnly ? (
            <>
              <span className="button-spinner"></span>
              Mencatat...
            </>
          ) : (
            <>📝 Catat Saja</>
          )}
        </button>
        <button
          className="btn-secondary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={handleReset}
          disabled={loadingSimpanCatat || loadingCatatOnly || loadingReset}
        >
          {loadingReset ? (
            <>
              <span className="button-spinner"></span>
              Mereset...
            </>
          ) : (
            <>🔄 Reset</>
          )}
        </button>
      </div>

      {/* Container pratinjau tersembunyi untuk kepentingan ekspor PDF (terhindar dari issue panel kanan tertutup) */}
      {/*
        Ukuran container 635x882 mengakomodasi padding 20px dari panelRef InvoicePreview
        sehingga A4 div (595x842) pas muat tanpa overflow/negative offset,
        mencegah clipping 20px kiri/atas oleh html2canvas.
      */}
      <div style={{ position: 'fixed', top: '-9999px', left: 0, width: '635px', height: '882px', overflow: 'hidden', pointerEvents: 'none', zIndex: -9999 }}>
        <InvoicePreview id="invoice-preview-export" />
      </div>
    </div>
  );
};

export default InvoiceGenerator;
