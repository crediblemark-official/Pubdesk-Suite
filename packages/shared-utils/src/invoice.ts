import { InvoiceItem } from '@pubhub/shared-types';

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
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      processed = processed.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), String(val));
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
          return parsed;
        }
      }
    }
  } catch (e) {
    // Non-JSON or corrupted file_path
  }

  const defaultStatus = invoice.payment_status || 'BELUM LUNAS';
  return {
    invoiceNo: '-', invoiceDate: '-', invoiceHal: '-',
    invoiceLampiran: '-', paymentStatus: defaultStatus,
    customerName: 'Umum', customerWa: '-', customerAddress: '',
    spesifikasiFasilitas: ''
  };
};
