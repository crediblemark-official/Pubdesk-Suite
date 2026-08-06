import React from 'react';
import { InvoiceItem, InvoiceProfile, AdditionalFee, GlobalDiscount, GlobalCashback } from '../../../types/invoice.types';
import { formatPrice } from '../../../utils/format';
import { evaluateItemFormula } from '../../../utils/invoice';

interface InvoiceTableProps {
  items: InvoiceItem[];
  profile: InvoiceProfile | null;
  shippingCost: number;
  adminFee: number;
  additionalFees?: AdditionalFee[];
  globalDiscount?: GlobalDiscount;
  globalCashback?: GlobalCashback;
  discAmount?: number;
  cbAmount?: number;
  spesifikasiFasilitas?: string;
  calculateItemTotal: (item: InvoiceItem) => number;
  accentColor: string;
  accentColorDark: string;
  paymentStatus?: string;
  paidAmount?: number;
  paymentNotes?: string;
  showTotals?: boolean;
  itemStartIndex?: number;
  allItemsForTotal?: InvoiceItem[];
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  items,
  profile,
  shippingCost,
  adminFee,
  additionalFees = [],
  globalDiscount,
  globalCashback,
  discAmount,
  cbAmount,
  spesifikasiFasilitas,
  calculateItemTotal,
  accentColor,
  accentColorDark,
  paymentStatus,
  paidAmount = 0,
  paymentNotes,
  showTotals = true,
  itemStartIndex = 0,
  allItemsForTotal
}) => {
  const targetTotalItems = allItemsForTotal || items;
  const itemsTotal = targetTotalItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const subtotal = itemsTotal;
  const globalShip = shippingCost || 0;
  const additionalFeesTotal = additionalFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  const calculatedDiscAmount = discAmount !== undefined ? discAmount : (
    globalDiscount?.type === 'percent'
      ? (subtotal * (Number(globalDiscount.value) || 0)) / 100
      : (Number(globalDiscount?.value) || 0)
  );

  const subtotalAfterDisc = Math.max(0, subtotal - calculatedDiscAmount);
  const subtotalBeforeCashback = subtotalAfterDisc + globalShip + adminFee + additionalFeesTotal;

  const calculatedCbAmount = cbAmount !== undefined ? cbAmount : (
    globalCashback?.type === 'percent'
      ? (subtotalBeforeCashback * (Number(globalCashback.value) || 0)) / 100
      : (Number(globalCashback?.value) || 0)
  );

  const total = Math.max(0, subtotalBeforeCashback - calculatedCbAmount);

  const headerBg = profile?.tableHeaderBg || accentColor;
  const headerNoBg = profile?.tableHeaderNoBg || accentColorDark;
  const headerTextColor = profile?.tableHeaderTextColor || '#ffffff';
  const bodyTextColor = profile?.tableBodyTextColor || '#000000';
  const rowEvenBg = profile?.tableRowEvenBg || '#fdf2f2';
  const rowOddBg = profile?.tableRowOddBg || '#ffffff';
  const borderColor = profile?.tableBorderColor || '#e5e7eb';

  return (
    <div style={{ padding: '0 35px', flex: 1, overflow: 'hidden', position: 'relative' }}>
      {itemStartIndex === 0 && profile?.salamPembuka && (
        <div style={{ 
          fontSize: '9px', 
          color: bodyTextColor, 
          marginBottom: '8px', 
          lineHeight: '1.4',
          fontStyle: 'italic',
          borderLeft: `2.5px solid ${accentColor}`,
          paddingLeft: '8px'
        }}>
          {profile.salamPembuka}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, "Segoe UI", sans-serif' }}>
        <thead>
          <tr style={{ color: headerTextColor }}>
            <th style={{ background: headerNoBg, width: '28px', textAlign: 'center', padding: '8px 4px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', border: 'none' }}>No</th>
            <th style={{ background: headerBg, textAlign: 'left', padding: '8px 8px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', border: 'none' }}>Judul / Detail</th>
            <th style={{ background: headerBg, textAlign: 'right', padding: '8px 8px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', border: 'none', width: '100px', whiteSpace: 'nowrap' }}>Harga</th>
            <th style={{ background: headerBg, textAlign: 'center', padding: '8px 8px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', border: 'none', width: '45px', whiteSpace: 'nowrap' }}>Jml.</th>
            <th style={{ background: headerBg, textAlign: 'right', padding: '8px 8px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', border: 'none', width: '105px', whiteSpace: 'nowrap' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: '#6b7280', fontStyle: 'italic', borderBottom: `1px solid ${borderColor}` }}>
                Belum ada rincian item. Silakan tambahkan di menu generator.
              </td>
            </tr>
          ) : (
            items.map((item, index) => {
              const rowBg = index % 2 === 0 ? rowEvenBg : rowOddBg;
              const columns = profile?.tableColumns || [];
              const keysToSkip = new Set(['item_title', 'price', 'quantity', 'total']);
              const detailParts: string[] = [];

              columns.forEach(col => {
                if (keysToSkip.has(col.key) || col.key === 'discount') return;
                if (col.type === 'formula' && (col.key === 'total' || col.key.toLowerCase().includes('total'))) return;

                let val: any;
                if (col.type === 'formula' && col.formula) {
                  val = evaluateItemFormula(col.formula, item);
                } else {
                  val = item[col.key];
                }
                if (val === undefined || val === null || val === '' || val === 0) return;

                const displayVal = col.type === 'currency'
                  ? formatPrice(Number(val))
                  : String(val);
                detailParts.push(`${col.label}: ${displayVal}`);
              });

              const priceVal = item.price || 0;
              const priceDisplay = formatPrice(priceVal);
              const qtyVal = item.quantity ?? 1;
              const totalVal = calculateItemTotal(item);
              const totalDisplay = formatPrice(totalVal);

              const hasItemDiscount = Boolean(Number(item.discount) > 0);
              const discVal = Number(item.discount) || 0;
              const discPerUnit = item.discountType === 'percent'
                ? (priceVal * discVal / 100)
                : (discVal / Math.max(1, qtyVal));
              const netPriceVal = Math.max(0, priceVal - discPerUnit);
              const netPriceDisplay = formatPrice(netPriceVal);

              const itemDiscountDisplay = hasItemDiscount
                ? (item.discountType === 'percent' ? `Diskon: ${item.discount}%` : `Diskon: ${formatPrice(Number(item.discount))}`)
                : '';

              return (
                <tr key={index} style={{ background: rowBg }}>
                  <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: '9.5px', color: bodyTextColor, fontWeight: '500', borderBottom: `1px solid ${borderColor}`, verticalAlign: 'middle' }}>
                    {itemStartIndex + index + 1}.
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'left', fontSize: '9.5px', color: bodyTextColor, fontWeight: '700', borderBottom: `1px solid ${borderColor}`, wordBreak: 'break-word', verticalAlign: 'middle' }}>
                    <div style={{ fontWeight: '700' }}>"{item.item_title || '-'}"</div>
                    {detailParts.length > 0 && (
                      <div style={{ fontWeight: '400', color: bodyTextColor, fontSize: '8.5px', marginTop: '2px', lineHeight: '1.4' }}>
                        {detailParts.join(' | ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9.5px', color: bodyTextColor, fontWeight: '500', borderBottom: `1px solid ${borderColor}`, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                    {hasItemDiscount ? (
                      <>
                        <div style={{ fontSize: '8.5px', color: bodyTextColor, textDecoration: 'line-through', fontWeight: '400', marginBottom: '1px', whiteSpace: 'nowrap' }}>
                          {priceDisplay}
                        </div>
                        <div style={{ whiteSpace: 'nowrap' }}>{netPriceDisplay}</div>
                      </>
                    ) : (
                      <div style={{ whiteSpace: 'nowrap' }}>{priceDisplay}</div>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '9.5px', color: bodyTextColor, fontWeight: '500', borderBottom: `1px solid ${borderColor}`, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    {qtyVal}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9.5px', color: bodyTextColor, fontWeight: '700', borderBottom: `1px solid ${borderColor}`, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                    <div style={{ whiteSpace: 'nowrap' }}>{totalDisplay}</div>
                    {hasItemDiscount && (
                      <div style={{ fontSize: '8px', fontWeight: '500', color: bodyTextColor, marginTop: '1px', whiteSpace: 'nowrap' }}>
                        {itemDiscountDisplay}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
          
          {items.length > 0 && showTotals && (
            <>
              {(shippingCost > 0 || adminFee > 0 || additionalFeesTotal > 0 || calculatedDiscAmount > 0 || calculatedCbAmount > 0) && (
                <tr style={{ borderTop: `1.5px solid ${borderColor}` }}>
                  <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: bodyTextColor, borderBottom: `1px solid ${borderColor}` }}>
                    Subtotal
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: bodyTextColor, whiteSpace: 'nowrap', borderBottom: `1px solid ${borderColor}` }}>
                    {formatPrice(subtotal)}
                  </td>
                </tr>
              )}

              {calculatedDiscAmount > 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: '#15803d', borderBottom: `1px solid ${borderColor}` }}>
                    🏷️ {globalDiscount?.label ? `Diskon (${globalDiscount.label})` : 'Diskon Global'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: '#15803d', whiteSpace: 'nowrap', borderBottom: `1px solid ${borderColor}` }}>
                    -{formatPrice(calculatedDiscAmount)}
                  </td>
                </tr>
              )}

              {shippingCost > 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: bodyTextColor, borderBottom: `1px solid ${borderColor}` }}>
                    Ongkos Kirim
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: bodyTextColor, whiteSpace: 'nowrap', borderBottom: `1px solid ${borderColor}` }}>
                    {formatPrice(shippingCost)}
                  </td>
                </tr>
              )}

              {adminFee > 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: bodyTextColor, borderBottom: `1px solid ${borderColor}` }}>
                    Biaya Admin
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: bodyTextColor, whiteSpace: 'nowrap', borderBottom: `1px solid ${borderColor}` }}>
                    {formatPrice(adminFee)}
                  </td>
                </tr>
              )}

              {additionalFees.map((fee) => {
                if (!fee.name && !fee.amount) return null;
                return (
                  <tr key={fee.id}>
                    <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: bodyTextColor, borderBottom: `1px solid ${borderColor}` }}>
                      {fee.name || 'Biaya Tambahan'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: bodyTextColor, whiteSpace: 'nowrap', borderBottom: `1px solid ${borderColor}` }}>
                      {formatPrice(fee.amount || 0)}
                    </td>
                  </tr>
                );
              })}

              {calculatedCbAmount > 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: '#15803d', borderBottom: `1px solid ${borderColor}` }}>
                    🎁 {globalCashback?.label ? `Cashback (${globalCashback.label})` : 'Cashback'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: '#15803d', whiteSpace: 'nowrap', borderBottom: `1px solid ${borderColor}` }}>
                    -{formatPrice(calculatedCbAmount)}
                  </td>
                </tr>
              )}

              <tr style={{ borderTop: `1.5px solid ${borderColor}` }}>
                <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9.5px', fontWeight: '700', color: bodyTextColor }}>
                  Total
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: '800', color: headerNoBg || accentColorDark, whiteSpace: 'nowrap' }}>
                  {formatPrice(total)}
                </td>
              </tr>

              {paymentStatus === 'DP' && (
                <>
                  <tr>
                    <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '600', color: bodyTextColor, borderBottom: `1px solid ${borderColor}` }}>
                      Telah Dibayar (DP)
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9.5px', fontWeight: '700', color: '#2563eb', whiteSpace: 'nowrap', borderBottom: `1px solid ${borderColor}` }}>
                      {formatPrice(paidAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', fontSize: '9.5px', fontWeight: '700', color: bodyTextColor }}>
                      Sisa Pembayaran
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: '800', color: '#dc2626', whiteSpace: 'nowrap' }}>
                      {formatPrice(Math.max(0, total - paidAmount))}
                    </td>
                  </tr>
                </>
              )}
            </>
          )}
        </tbody>
      </table>

      {showTotals && (
        <>
          {profile?.showSpesifikasi && (spesifikasiFasilitas !== undefined && spesifikasiFasilitas !== null ? spesifikasiFasilitas.trim() !== '' : !!profile.defaultSpesifikasi) && (
            <div style={{ 
              marginTop: '10px', 
              border: `1.5px solid ${accentColor}`, 
              borderRadius: '4px', 
              padding: '6px 10px', 
              fontSize: '8.5px', 
              color: bodyTextColor, 
              background: '#fef3c7', 
              textAlign: 'center', 
              fontWeight: '600',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}>
              {spesifikasiFasilitas !== undefined && spesifikasiFasilitas !== null ? spesifikasiFasilitas : profile.defaultSpesifikasi}
            </div>
          )}

          {profile?.showNotes !== false && profile?.notes && profile.notes.length > 0 && (
            <div style={{ marginTop: '10px', fontSize: '8.5px', color: bodyTextColor, lineHeight: '1.4' }}>
              <span style={{ fontWeight: '700', fontStyle: 'italic' }}>Note:</span><br />
              {profile.notes.map((note, idx) => (
                <React.Fragment key={idx}>
                  {idx + 1}. {note}<br />
                </React.Fragment>
              ))}
            </div>
          )}

          {paymentNotes && (
            <div style={{ marginTop: '8px', fontSize: '8.5px', color: bodyTextColor, lineHeight: '1.4' }}>
              <span style={{ fontWeight: '700', fontStyle: 'italic' }}>Catatan Pembayaran:</span> {paymentNotes}
            </div>
          )}

          <div style={{ marginTop: '10px', fontSize: '9px', color: bodyTextColor, lineHeight: '1.4', whiteSpace: 'pre-line' }}>
            {profile?.salamPenutup !== undefined && profile?.salamPenutup !== null
              ? profile.salamPenutup 
              : `Demikian rincian biaya ${profile?.actionLabel || 'cetak buku'} anda. Dan lembar ini kami buat untuk dipergunakan sebagaimana semestinya. Atas kepercayaan anda, kami ucapkan terimakasih.`}
          </div>
        </>
      )}
    </div>
  );
};
