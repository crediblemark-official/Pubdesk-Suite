import React from 'react';
import { InvoiceProfile } from '../../../types/invoice.types';
import { formatDateId } from '../../../utils/invoice';

interface InvoiceFooterProps {
  profile: InvoiceProfile | null;
  invoiceDate: string;
  accentColor: string;
  footerBgColor: string;
  footerPrimaryColor: string;
  footerSecondaryColor: string;
  showSignatureAndBank?: boolean;
}

export const InvoiceFooter: React.FC<InvoiceFooterProps> = ({
  profile,
  invoiceDate,
  accentColor,
  footerBgColor,
  footerPrimaryColor,
  footerSecondaryColor,
  showSignatureAndBank = true
}) => {
  const bankNames = profile?.bankName ? profile.bankName.split('|') : [];
  const bankAccountNos = profile?.bankAccountNo ? profile.bankAccountNo.split('|') : [];
  const bankAccountOwners = profile?.bankAccountOwner ? profile.bankAccountOwner.split('|') : [];

  const getSignatureOfficeLabel = () => {
    return profile?.signatureOffice || 'KBM Kreator Yogyakarta';
  };

  const getSignatureLocationDateLabel = () => {
    if (profile?.signatureLocation) {
      return `${profile.signatureLocation}, ${formatDateId(invoiceDate)}`;
    }
    return invoiceDate;
  };

  const getSignatureRoleLabel = () => {
    return profile?.signatureRole || '';
  };

  const getSignatureNameLabel = () => {
    return profile?.signatureName || 'MOHAMMAD IMAM JUNAIDI, M.H.';
  };

  return (
    <>
      {showSignatureAndBank && (
        <div style={{ padding: '10px 35px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontFamily: 'Arial, "Segoe UI", sans-serif', flexShrink: 0 }}>
          {/* Tanda Tangan (Kiri) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '220px', fontSize: '9.5px', color: '#000000', position: 'relative' }}>
            <div style={{ fontWeight: '600', color: '#000000', marginBottom: '2px' }}>{getSignatureOfficeLabel()}</div>
            <div style={{ fontWeight: '600', color: '#000000', marginBottom: '6px' }}>{getSignatureLocationDateLabel()}</div>

            <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: `${profile?.signatureSpacing ?? 40}px` }}>
              {profile?.signatureImg ? (
                <div style={{
                  position: 'absolute',
                  top: '-15px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: '55px',
                  width: '130px',
                  pointerEvents: 'none',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img
                    src={profile.signatureImg}
                    alt="Tanda Tangan"
                    style={{ height: '55px', width: 'auto', maxWidth: '130px', objectFit: 'contain' }}
                  />
                </div>
              ) : (profile?.showDefaultSignature !== false) ? (
                <div style={{
                  fontFamily: '"Playball", cursive',
                  fontSize: '16px',
                  color: accentColor,
                  lineHeight: '1',
                  marginBottom: '-4px',
                  textAlign: 'center',
                  zIndex: 1,
                  whiteSpace: 'nowrap'
                }}>
                  {getSignatureNameLabel().split(',')[0]}
                </div>
              ) : null}
              <div style={{ height: profile?.signatureImg ? '48px' : (profile?.showDefaultSignature !== false ? '0px' : '0px') }} />
            </div>

            {/* Nama Terang */}
            <div style={{ fontSize: '8.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', zIndex: 1, lineHeight: '1.2', whiteSpace: 'nowrap' }}>
              {getSignatureNameLabel()}
            </div>

            {/* Garis / Underline */}
            <div style={{ width: '100%', height: '1px', background: '#000000', margin: '2px 0 3px 0', zIndex: 1 }} />

            {/* Jabatan */}
            <div style={{ fontWeight: '600', fontSize: '8.5px', textTransform: 'uppercase', color: '#000000', zIndex: 1, lineHeight: '1.2' }}>
              {getSignatureRoleLabel()}
            </div>
          </div>

          {/* Sisi Kanan: Rekening Bank */}
          {profile?.showBankInfo ? (
            <div style={{
              width: '500px',
              fontSize: '9.5px',
              color: '#000000',
              textAlign: 'right',
              lineHeight: '1.6',
              fontFamily: 'Arial, "Segoe UI", sans-serif',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              alignItems: 'flex-end',
              marginBottom: '4px'
            }}>
              <div style={{
                fontSize: '9.5px',
                fontWeight: '800',
                color: accentColor,
                letterSpacing: '0.5px',
                marginBottom: '4px',
                textTransform: 'uppercase'
              }}>
                Silahkan Transfer Ke:
              </div>
              {bankNames.map((name, i) => {
                const no = bankAccountNos[i] || '';
                const owner = bankAccountOwners[i] || '';
                if (!name && !no && !owner) return null;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                    <span style={{ fontWeight: '700', color: '#000000' }}>{name}</span>
                    <span style={{ color: '#9ca3af' }}>|</span>
                    <span style={{ fontWeight: '600', color: '#000000' }}>{no}</span>
                    <span style={{ color: '#9ca3af' }}>|</span>
                    <span style={{ color: '#000000', fontSize: '9px' }}>a/n. {owner}</span>
                  </div>
                );
              })}
            </div>
          ) : <div style={{ width: '280px' }} />}
        </div>
      )}

      {/* Footer SVG */}
      <div className="invoice-footer" style={{ flexShrink: 0, marginTop: 'auto' }}>
        <svg
          viewBox="0 0 1045 80"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          shapeRendering="geometricPrecision"
          aria-label="Footer invoice"
          style={{ display: 'block', width: '100%' }}
        >
          <rect width="1045" height="80" fill="#ffffff" />
          <defs>
            <filter id="drop-shadow-footer" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.3" />
            </filter>
            <filter id="drop-shadow-middle-footer" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
            </filter>
          </defs>

          <g filter="url(#drop-shadow-footer)">
            <path d="M 0 20 H 272 L 309.5 70 H 0 Z" fill={footerBgColor} />
            <path d="M 348.25 20 H 1045 V 70 H 385.75 Z" fill={footerPrimaryColor} />
          </g>

          {profile?.showFooterBranding !== false && profile?.footerNoteText && (
            <text
              x="61"
              y="49"
              fill="#ffffff"
              fontFamily='Arial, "Segoe UI", sans-serif'
              fontSize="11.5"
              fontWeight="700"
            >
              {profile.footerNoteText}
            </text>
          )}

          {profile?.showCompanyContact && (
            <text
              x="984"
              y="48"
              textAnchor="end"
              fill="#ffffff"
              fontFamily='Arial, "Segoe UI", sans-serif'
              fontSize="9.2"
              fontWeight="600"
            >
              {(() => {
                const elements: React.ReactNode[] = [];
                if (profile.companyWebsite) {
                  elements.push(
                    <tspan key="web" fill="#ffffff">
                      🌐 {profile.companyWebsite}
                    </tspan>
                  );
                }
                if (profile.companyEmail) {
                  elements.push(
                    <tspan key="email" fill="#ffffff" dx="11">
                      ✉ {profile.companyEmail}
                    </tspan>
                  );
                }
                if (profile.companyYoutube) {
                  elements.push(
                    <tspan key="yt" fill="#ffffff" dx="11">
                      ▶ {profile.companyYoutube}
                    </tspan>
                  );
                }
                if (profile.companyInstagram) {
                  elements.push(
                    <tspan key="ig" fill="#ffffff" dx="11">
                      📸 {profile.companyInstagram}
                    </tspan>
                  );
                }
                if (profile.companyPhone) {
                  elements.push(
                    <tspan key="phone" fill="#ffffff" dx="11">
                      📞 {profile.companyPhone}
                    </tspan>
                  );
                }
                return elements;
              })()}
            </text>
          )}

          <g filter="url(#drop-shadow-middle-footer)">
            <path d="M 280 5 H 319 L 367.75 70 H 328.75 Z" fill={footerSecondaryColor} />
            <path d="M 319 5 H 337 L 385.75 70 H 367.75 Z" fill="#ffffff" />
          </g>
        </svg>
      </div>
    </>
  );
};
