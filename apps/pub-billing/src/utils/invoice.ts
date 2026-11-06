import { InvoiceItem } from '../types/invoice.types';

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const getIndonesianDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDateId = (dateStr: string): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [, m, d] = parts;
  const monthIdx = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)} ${MONTHS_ID[monthIdx] || m} ${parts[0]}`;
};

export const evaluateItemFormula = (formulaStr: string, item: InvoiceItem): any => {
  try {
    let processed = formulaStr;
    const tokenRegex = /\{([^}]+)\}/g;
    let match;
    let containsString = false;
    const keys: string[] = [];
    while ((match = tokenRegex.exec(formulaStr)) !== null) {
      keys.push(match[1]);
    }
    keys.forEach(key => {
      let val = (item as any)[key];
      if (val === undefined || val === null) val = 0;
      if (typeof val === 'string' && isNaN(Number(val))) containsString = true;
      processed = processed.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    });
    const mathOperators = /[\+\-\*\/\(\)]/;
    if (containsString || !mathOperators.test(processed)) return processed;
    const safeMathExpr = processed.replace(/[^0-9\+\-\*\/\.\(\)\s]/g, '');
    const result = new Function(`return (${safeMathExpr});`)();
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch (e) {
    console.error('Gagal mengevaluasi formula:', formulaStr, e);
    return 0;
  }
};

export const getInvoiceMetadata = (invoice: any) => {
  if (!invoice) {
    return {
      invoiceNo: '-', invoiceDate: '-', invoiceHal: '-',
      invoiceLampiran: '-', paymentStatus: 'BELUM LUNAS',
      customerName: 'Umum', customerWa: '-', customerAddress: '',
      spesifikasiFasilitas: ''
    };
  }

  try {
    if (typeof invoice.file_path === 'string') {
      const trimmed = invoice.file_path.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return {
            ...parsed,
            paymentStatus: invoice.payment_status || parsed.paymentStatus || 'BELUM LUNAS'
          };
        }
      }
    }
  } catch (e) {
    // Non-JSON or corrupted file_path
  }

  // Fallback ke customer_snapshot jika file_path bukan JSON
  let customerName = 'Umum';
  let customerWa = '-';
  let customerAddress = '';
  if (invoice.customer_snapshot) {
    try {
      const snap = typeof invoice.customer_snapshot === 'string'
        ? JSON.parse(invoice.customer_snapshot)
        : invoice.customer_snapshot;
      if (snap?.name) customerName = snap.name;
      if (snap?.wa_number) customerWa = snap.wa_number;
      if (snap?.address) customerAddress = snap.address;
    } catch (_) {}
  }

  // Coba ekstrak nomor invoice dari string file_path jika ada pola "Invoice-KBM_2026_07_23_0004.pdf"
  let invoiceNo = '-';
  if (typeof invoice.file_path === 'string' && invoice.file_path) {
    const match = invoice.file_path.match(/Invoice-([a-zA-Z0-9_-]+)\.pdf/i);
    if (match && match[1]) {
      invoiceNo = match[1].replace(/_/g, '/');
    }
  }

  const defaultStatus = invoice.payment_status || 'BELUM LUNAS';
  return {
    invoiceNo,
    invoiceDate: invoice.created_at ? invoice.created_at.substring(0, 10) : '-',
    invoiceHal: 'Layanan Jasa',
    invoiceLampiran: '-',
    paymentStatus: defaultStatus,
    customerName,
    customerWa,
    customerAddress,
    spesifikasiFasilitas: ''
  };
};

export interface PdfFilenameData {
  profileName?: string;
  invoiceNo?: string;
  invoiceHal?: string;
  invoiceLampiran?: string;
  invoiceDate?: string;
  customerName?: string;
  customerWa?: string;
  customerEmail?: string;
  customerAddress?: string;
  paymentStatus?: string;
  companyName?: string;
  actionLabel?: string;
  items?: InvoiceItem[];
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
}

export const formatPdfFilename = (
  template: string | undefined,
  data: PdfFilenameData
): string => {
  const defaultPattern = 'Invoice {profile_name} - {invoice_no} - {payment_status}';
  let pattern = (template && template.trim()) ? template.trim() : defaultPattern;

  const profileName = data.profileName || 'Invoice';
  const invoiceNo = data.invoiceNo ? data.invoiceNo.trim() : 'DRAF';
  const perihal = data.invoiceHal || '-';
  const lampiran = data.invoiceLampiran || '-';
  const customerName = data.customerName || 'Umum';
  const customerWa = data.customerWa || '-';
  const customerEmail = data.customerEmail || '-';
  const customerAddress = data.customerAddress || '-';
  const paymentStatus = data.paymentStatus || 'LUNAS';
  const companyName = data.companyName || 'Perusahaan';
  const actionLabel = data.actionLabel || 'transaksi';

  // Date variables
  const dateStr = data.invoiceDate || getIndonesianDate();
  const dateParts = dateStr.split('-');
  const year = dateParts[0] || String(new Date().getFullYear());
  const month = dateParts[1] || String(new Date().getMonth() + 1).padStart(2, '0');
  const day = dateParts[2] ? dateParts[2].padStart(2, '0') : String(new Date().getDate()).padStart(2, '0');

  // Item variables
  const items = data.items || [];
  const firstItemTitle = items[0]?.item_title || '-';
  const firstPackageName = items[0]?.package_name || items[0]?.item_title || '-';
  const allTitles = items.map(i => i.item_title).filter(Boolean).join(' & ') || '-';
  const totalQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

  // Amounts
  const formatRp = (num?: number) => num !== undefined ? `Rp ${num.toLocaleString('id-ID')}` : '-';
  const totalAmountStr = formatRp(data.totalAmount);
  const paidAmountStr = formatRp(data.paidAmount);
  const remainingAmountStr = formatRp(data.remainingAmount);

  // Map placeholders
  const replacements: Record<string, string> = {
    '{profile_name}': profileName,
    '{invoice_no}': invoiceNo,
    '{perihal}': perihal,
    '{lampiran}': lampiran,
    '{customer_name}': customerName,
    '{penulis}': customerName,
    '{customer_wa}': customerWa,
    '{customer_email}': customerEmail,
    '{customer_address}': customerAddress,
    '{book_title}': firstItemTitle,
    '{package_name}': firstPackageName,
    '{all_titles}': allTitles,
    '{total_qty}': String(totalQty),
    '{payment_status}': paymentStatus,
    '{total_amount}': totalAmountStr,
    '{paid_amount}': paidAmountStr,
    '{remaining_amount}': remainingAmountStr,
    '{company_name}': companyName,
    '{action_label}': actionLabel,
    '{date}': dateStr,
    '{year}': year,
    '{month}': month,
    '{day}': day,
  };

  let result = pattern;
  Object.entries(replacements).forEach(([key, val]) => {
    const escapedKey = key.replace(/[{}]/g, '\\$&');
    result = result.replace(new RegExp(escapedKey, 'g'), () => val);
  });

  // Clean illegal characters for OS filenames: / \ : * ? " < > |
  result = result
    .replace(/[\/\\]/g, '-')
    .replace(/:/g, ' - ')
    .replace(/[*?"<>|]/g, '')
    .replace(/-+/g, '-');

  if (!result.toLowerCase().endsWith('.pdf')) {
    result += '.pdf';
  }

  return result;
};

export const buildOverrideInvoice = (inv: any, contacts?: any[]) => {
  let metadata: any = {};
  try {
    if (inv.file_path && typeof inv.file_path === 'string' && inv.file_path.trim().startsWith('{')) {
      metadata = JSON.parse(inv.file_path);
    }
  } catch {}

  let items: any[] = [];
  try {
    if (inv.items_json) {
      items = JSON.parse(inv.items_json);
    }
  } catch {}

  let customerName = metadata.customerName || '';
  let customerWa = metadata.customerWa || '';
  let customerEmail = metadata.customerEmail || '';
  let customerAddress = metadata.customerAddress || '';

  if (!customerName && inv.customer_snapshot) {
    try {
      const snap = typeof inv.customer_snapshot === 'string' ? JSON.parse(inv.customer_snapshot) : inv.customer_snapshot;
      customerName = snap?.name || '';
      customerWa = snap?.wa_number || '';
      customerEmail = snap?.email || '';
      customerAddress = snap?.address || '';
    } catch {}
  }

  if (!customerName && inv.customer_id && contacts) {
    const matched = contacts.find((c: any) => c.id === inv.customer_id);
    if (matched) {
      customerName = matched.name || '';
      customerWa = matched.wa_number || '';
      customerEmail = matched.email || '';
      customerAddress = matched.address || '';
    }
  }

  const currentStatus = inv.payment_status || metadata.paymentStatus || 'BELUM LUNAS';
  const total = inv.total || 0;
  const paidAmount = currentStatus === 'LUNAS' ? total : (inv.paid_amount ?? metadata.paidAmount ?? 0);
  const remainingAmount = currentStatus === 'LUNAS' ? 0 : (inv.remaining_amount ?? metadata.remainingAmount ?? Math.max(0, total - paidAmount));

  return {
    customerName: customerName || 'Umum',
    waNumber: customerWa || '',
    email: customerEmail || '',
    address: customerAddress || '',
    items,
    shippingCost: inv.shipping_cost || 0,
    adminFee: inv.admin_fee || 0,
    invoiceType: inv.export_format || '',
    profileId: metadata.profileId || '',
    pdfFilenameFormat: metadata.pdfFilenameFormat || '',
    invoiceNo: metadata.invoiceNo || (inv.file_path?.match(/Invoice-([a-zA-Z0-9_-]+)\.pdf/i)?.[1]?.replace(/_/g, '/') || '-'),
    invoiceHal: metadata.invoiceHal || 'Layanan Jasa',
    invoiceLampiran: metadata.invoiceLampiran || '-',
    invoiceDate: metadata.invoiceDate || (inv.created_at ? inv.created_at.substring(0, 10) : '-'),
    paymentStatus: currentStatus,
    spesifikasiFasilitas: metadata.spesifikasiFasilitas || '',
    paidAmount,
    remainingAmount,
    paymentNotes: inv.payment_notes || metadata.paymentNotes || ''
  };
};
