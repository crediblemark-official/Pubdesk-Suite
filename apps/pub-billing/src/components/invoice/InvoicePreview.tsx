import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useInvoiceContext } from '../../contexts/InvoiceContext';
import { InvoiceProfile, InvoiceItem } from '../../types/invoice.types';
import { formatPdfFilename } from '../../utils/invoice';

// Import sub-komponen modular
import { InvoiceHeader } from './sections/InvoiceHeader';
import { InvoiceInfo } from './sections/InvoiceInfo';
import { InvoiceTable } from './sections/InvoiceTable';
import { InvoiceFooter } from './sections/InvoiceFooter';
import { Watermark } from './sections/Watermark';

interface InvoicePreviewProps {
  id?: string;
  previewProfile?: InvoiceProfile;
  overrideInvoice?: {
    customerName: string;
    waNumber?: string;
    email?: string;
    address?: string;
    items: InvoiceItem[];
    shippingCost: number;
    adminFee: number;
    invoiceType: string;
    invoiceNo: string;
    invoiceHal: string;
    invoiceLampiran: string;
    invoiceDate: string;
    paymentStatus?: string;
    spesifikasiFasilitas?: string;
    paidAmount?: number;
    paymentNotes?: string;
  };
  hideToolbar?: boolean;
  externalZoom?: number;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ id, previewProfile, overrideInvoice, hideToolbar, externalZoom }) => {
  const contextData = useInvoiceContext();
  
  const customer = overrideInvoice 
    ? { name: overrideInvoice.customerName, wa_number: overrideInvoice.waNumber, email: overrideInvoice.email, address: overrideInvoice.address } 
    : contextData.customer;
  const items = overrideInvoice ? overrideInvoice.items : contextData.items;
  const shippingCost = overrideInvoice ? overrideInvoice.shippingCost : contextData.shippingCost;
  const adminFee = overrideInvoice ? overrideInvoice.adminFee : contextData.adminFee;
  const additionalFees = (overrideInvoice as any)?.additionalFees || contextData.additionalFees || [];
  const globalDiscount = (overrideInvoice as any)?.globalDiscount || contextData.globalDiscount;
  const globalCashback = (overrideInvoice as any)?.globalCashback || contextData.globalCashback;
  const discAmount = contextData.calculateGlobalDiscountAmount ? contextData.calculateGlobalDiscountAmount() : undefined;
  const cbAmount = contextData.calculateGlobalCashbackAmount ? contextData.calculateGlobalCashbackAmount() : undefined;
  const invoiceType = overrideInvoice ? overrideInvoice.invoiceType : contextData.invoiceType;
  const invoiceNo = overrideInvoice ? overrideInvoice.invoiceNo : contextData.invoiceNo;
  const invoiceHal = overrideInvoice ? overrideInvoice.invoiceHal : contextData.invoiceHal;
  const invoiceLampiran = overrideInvoice ? overrideInvoice.invoiceLampiran : contextData.invoiceLampiran;
  const invoiceDate = overrideInvoice ? overrideInvoice.invoiceDate : contextData.invoiceDate;
  const paymentStatus = overrideInvoice ? overrideInvoice.paymentStatus : contextData.paymentStatus;
  const spesifikasiFasilitas = overrideInvoice ? overrideInvoice.spesifikasiFasilitas : contextData.spesifikasiFasilitas;
  const paidAmount = overrideInvoice ? overrideInvoice.paidAmount : contextData.paidAmount;
  const paymentNotes = overrideInvoice ? overrideInvoice.paymentNotes : contextData.paymentNotes;
  
  const calculateItemTotal = contextData.calculateItemTotal;
  const profiles = contextData.profiles;

  const profile = previewProfile 
    || (overrideInvoice ? (
          profiles.find(p => p.id === (overrideInvoice as any).profileId) ||
          profiles.find(p => p.id === invoiceType) ||
          profiles.find(p => p.tableType === invoiceType)
       ) : contextData.activeProfile) 
    || contextData.activeProfile 
    || (profiles.length > 0 ? profiles[0] : null);

  const panelRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const effectiveZoom = externalZoom ?? zoom;

  const [isDragScrolling, setIsDragScrolling] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!panelRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('textarea')) {
      return;
    }

    setIsDragScrolling(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: panelRef.current.scrollLeft,
      scrollTop: panelRef.current.scrollTop
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragScrolling || !panelRef.current) return;
    e.preventDefault();

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    panelRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    panelRef.current.scrollTop = dragStart.current.scrollTop - dy;
  };

  const handleMouseUpOrLeave = () => setIsDragScrolling(false);

  const handleZoomIn = () => { if (externalZoom === undefined) setZoom(prev => Math.min(prev + 0.25, 3.0)); };
  const handleZoomOut = () => { if (externalZoom === undefined) setZoom(prev => Math.max(prev - 0.25, 0.25)); };
  const handleZoomReset = () => { if (externalZoom === undefined) setZoom(1.0); };

  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const handleDownloadPDF = useCallback(async () => {
    setDownloading(true);
    setPdfError(null);
    try {
      const { generateInvoicePDFBytes, downloadPDFBytes } = await import('../../utils/pdfGenerator');
      const bytes = await generateInvoicePDFBytes('invoice-preview-export');
      const totalAmt = contextData.calculateTotal ? contextData.calculateTotal() : undefined;
      const pdfFormatPattern = (overrideInvoice as any)?.pdfFilenameFormat || profile?.pdfFilenameFormat;
      const defaultFileName = formatPdfFilename(pdfFormatPattern, {
        profileName: profile?.name,
        invoiceNo,
        invoiceHal,
        invoiceLampiran,
        invoiceDate,
        customerName: customer.name,
        customerWa: customer.wa_number,
        customerEmail: customer.email,
        customerAddress: customer.address,
        paymentStatus,
        companyName: profile?.companyName,
        actionLabel: profile?.actionLabel,
        items,
        totalAmount: totalAmt,
        paidAmount,
        remainingAmount: totalAmt !== undefined ? Math.max(0, totalAmt - (paidAmount || 0)) : undefined
      });
      await downloadPDFBytes(bytes, defaultFileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Gagal generate PDF:', msg);
      setPdfError(msg);
    } finally {
      setDownloading(false);
    }
  }, [invoiceNo, profile, invoiceHal, invoiceLampiran, invoiceDate, customer, paymentStatus, items, paidAmount, contextData]);

  // Auto-clear error after 5s
  useEffect(() => {
    if (!pdfError) return;
    const t = setTimeout(() => setPdfError(null), 5000);
    return () => clearTimeout(t);
  }, [pdfError]);

  const a4Width = 595;
  const a4Height = 842;

  useEffect(() => {
    const updateScale = () => {
      if (panelRef.current) {
        const panelWidth = panelRef.current.clientWidth;
        const panelHeight = panelRef.current.clientHeight;
        const pad = 40;
        const scaleX = (panelWidth - pad) / a4Width;
        const scaleY = (panelHeight - pad) / a4Height;
        setScale(Math.min(scaleX, scaleY));
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (panelRef.current) {
      ro.observe(panelRef.current);
    }
    return () => ro.disconnect();
  }, []);

  const accentColor = profile?.accentColor || '#c01c1c';
  const accentColorDark = profile?.accentColorDark || '#991b1b';
  const headerBgColor = profile?.headerBgColor || '#222933';
  const headerPrimaryColor = profile?.headerPrimaryColor || (profile as any)?.headerColor || profile?.accentColor || '#c01c1c';
  const headerSecondaryColor = profile?.headerSecondaryColor || (profile as any)?.headerColor || profile?.accentColor || '#c01c1c';
  const footerBgColor = profile?.footerBgColor || profile?.headerBgColor || '#222933';
  const footerPrimaryColor = profile?.footerPrimaryColor || profile?.headerPrimaryColor || profile?.accentColor || '#c01c1c';
  const footerSecondaryColor = profile?.footerSecondaryColor || profile?.headerSecondaryColor || profile?.accentColor || '#c01c1c';

  const itemPages = useMemo(() => {
    if (!items || items.length === 0) return [[]];
    const pages: InvoiceItem[][] = [[]];
    items.forEach((item) => {
      pages[pages.length - 1].push(item);
      if (item.pageBreakAfter) {
        pages.push([]);
      }
    });
    return pages.filter((p, i) => p.length > 0 || i === 0);
  }, [items]);

  const isMultiPage = itemPages.length > 1;

  return (
    <div 
      ref={panelRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%', 
        background: 'var(--bg-panel)', 
        overflow: 'auto',
        display: 'flex',
        alignItems: isMultiPage ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: '20px',
        cursor: isDragScrolling ? 'grabbing' : 'grab',
        userSelect: isDragScrolling ? 'none' : 'auto'
      }}
    >

      {/* Floating Zoom Controls + Download */}
      {!hideToolbar && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          gap: '4px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          padding: '4px',
          borderRadius: '8px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
          zIndex: 100
        }}>
          <button 
            onClick={handleZoomOut}
            type="button"
            style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Zoom Out"
          >
            ➖
          </button>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', minWidth: '40px', justifyContent: 'center' }}>
            {Math.round(effectiveZoom * 100)}%
          </span>
          <button 
            onClick={handleZoomIn}
            type="button"
            style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Zoom In"
          >
            ➕
          </button>
          <button 
            onClick={handleZoomReset}
            type="button"
            style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '600', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Reset"
          >
            🔄
          </button>
          <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 2px' }} />
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            type="button"
            style={{
              width: '32px', height: '24px', borderRadius: '4px', border: 'none',
              background: downloading ? 'var(--bg-panel)' : 'var(--accent)',
              color: downloading ? 'var(--text-secondary)' : '#fff',
              cursor: downloading ? 'not-allowed' : 'pointer',
              fontWeight: '600', fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title={downloading ? 'Memproses...' : 'Download PDF'}
          >
            {downloading ? '⏳' : '⬇'}
          </button>
        </div>
      )}

      {pdfError && (
        <div style={{
          position: 'absolute', top: '52px', left: '50%', transform: 'translateX(-50%)',
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
          fontSize: '11px', fontWeight: '600', padding: '6px 14px', zIndex: 100,
          borderRadius: '6px', whiteSpace: 'nowrap', maxWidth: '90%', overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          ⚙️ Gagal download PDF: {pdfError}
        </div>
      )}

      <div
        style={{
          margin: 'auto',
          width: `${a4Width * scale * effectiveZoom}px`,
          height: isMultiPage ? 'auto' : `${a4Height * scale * effectiveZoom}px`,
          position: 'relative',
          flexShrink: 0
        }}
      >
        <div 
          id={id || "invoice-preview-content"}
          style={{
            transform: `scale(${scale * effectiveZoom})`,
            transformOrigin: 'top left',
            position: isMultiPage ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            width: `${a4Width}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>

          {itemPages.map((pageItems, pageIdx) => {
            const isLastPage = pageIdx === itemPages.length - 1;
            let startIndex = 0;
            for (let k = 0; k < pageIdx; k++) {
              startIndex += itemPages[k].length;
            }

            return (
              <div
                key={pageIdx}
                className="a4-page"
                style={{
                  width: `${a4Width}px`,
                  height: `${a4Height}px`,
                  background: '#ffffff',
                  borderRadius: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                  fontFamily: 'Arial, "Segoe UI", sans-serif',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}
              >
                <InvoiceHeader 
                  profile={profile}
                  headerBgColor={headerBgColor}
                  headerPrimaryColor={headerPrimaryColor}
                  headerSecondaryColor={headerSecondaryColor}
                  invoiceNo={invoiceNo}
                />

                {pageIdx === 0 ? (
                  <InvoiceInfo
                    customer={customer}
                    profile={profile}
                    invoiceHal={invoiceHal}
                    invoiceLampiran={invoiceLampiran}
                    invoiceDate={invoiceDate}
                  />
                ) : (
                  <div style={{ height: '18px', flexShrink: 0 }} />
                )}

                <InvoiceTable
                  items={pageItems}
                  profile={profile}
                  shippingCost={shippingCost}
                  accentColor={accentColor}
                  accentColorDark={accentColorDark}
                  adminFee={adminFee}
                  additionalFees={additionalFees}
                  globalDiscount={globalDiscount}
                  globalCashback={globalCashback}
                  discAmount={discAmount}
                  cbAmount={cbAmount}
                  spesifikasiFasilitas={spesifikasiFasilitas}
                  calculateItemTotal={calculateItemTotal}
                  paymentStatus={paymentStatus}
                  paidAmount={paidAmount}
                  paymentNotes={paymentNotes}
                  showTotals={isLastPage}
                  itemStartIndex={startIndex}
                  allItemsForTotal={items}
                />

                <InvoiceFooter
                  profile={profile}
                  invoiceDate={invoiceDate}
                  accentColor={accentColor}
                  footerBgColor={footerBgColor}
                  footerPrimaryColor={footerPrimaryColor}
                  footerSecondaryColor={footerSecondaryColor}
                  showSignatureAndBank={isLastPage}
                />

                <Watermark paymentStatus={paymentStatus} activeProfile={profile} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
