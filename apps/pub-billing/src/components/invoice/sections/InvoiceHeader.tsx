import React from 'react';
import { InvoiceProfile } from '../../../types/invoice.types';

interface InvoiceHeaderProps {
  profile: InvoiceProfile | null;
  headerBgColor: string;
  headerPrimaryColor: string;
  headerSecondaryColor: string;
  invoiceNo: string;
}

const FONT_FAMILY = '"Montserrat", Arial, sans-serif';

export const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({
  profile,
  headerBgColor,
  headerPrimaryColor,
  headerSecondaryColor,
  invoiceNo
}) => {
  const headerType = profile?.headerType || 'logo_text';

  const getDisplayInvoiceNo = () => {
    if (profile?.invoiceNoFormat) {
      const format = profile.invoiceNoFormat;
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const seq = '0001';

      return format
        .replace(/{year}/g, year)
        .replace(/{month}/g, month)
        .replace(/{day}/g, day)
        .replace(/{seq}/g, seq);
    }
    if (invoiceNo) return invoiceNo;
    return 'KBM/2026/08/06/0001';
  };

  return (
    <div className="invoice-header" style={{ flexShrink: 0 }}>
      <svg
        viewBox="0 35 657 104"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Invoice header"
        shapeRendering="geometricPrecision"
        style={{ display: 'block', width: '100%' }}
      >
        <rect x="0" y="0" width="657" height="139" fill="#ffffff" />
        <rect x="0" y="35" width="657" height="2" fill="#dddddd" />
        <defs>
          <filter id="drop-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
          </filter>
          <filter id="drop-shadow-middle" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
          </filter>
          <clipPath id="header-clip">
            <rect x="0" y="35" width="657" height="115" />
          </clipPath>
        </defs>

        <g filter="url(#drop-shadow)">
          <rect x="256" y="54" width="401" height="78" fill={headerBgColor} />
          <polygon points="0,54 240,54 286,132 0,132" fill={headerPrimaryColor} />
        </g>

        <g filter="url(#drop-shadow-middle)" clipPath="url(#header-clip)">
          <polygon points="238,50 254,50 306,139 290,139" fill="#ffffff" />
          <polygon points="254,50 293,50 346,139 306,139" fill={headerSecondaryColor} />
        </g>

        {(() => {
          if (headerType === 'text_only' || (!profile?.companyLogo && headerType === 'logo_only')) {
            return (
              <>
                <text x="120" y="92" textAnchor="middle" fill="#ffffff" fontFamily={FONT_FAMILY} fontSize="16" fontWeight="900" letterSpacing="0.5">
                  {profile?.companyName || 'CV KBM'}
                </text>
                <text x="120" y="104" textAnchor="middle" fill="#ffffff" fontFamily={FONT_FAMILY} fontSize="7.5" fontWeight="600" letterSpacing="1">
                  {profile?.companyTagline || 'KARYA BAKTI MAKMUR'}
                </text>
              </>
            );
          }

          if (headerType === 'logo_only' && profile?.companyLogo) {
            return (
              <image
                href={profile.companyLogo}
                x="55"
                y="60"
                width="130"
                height="66"
                preserveAspectRatio="xMidYMid meet"
              />
            );
          }

          return (
            <>
              {profile?.companyLogo ? (
                <>
                  <image
                    href={profile.companyLogo}
                    x="25"
                    y="67"
                    width="52"
                    height="52"
                    preserveAspectRatio="xMinYMid meet"
                  />
                  <text x="82" y="91" fill="#ffffff" fontFamily={FONT_FAMILY} fontSize="15" fontWeight="900" letterSpacing="0.5">
                    {profile?.companyName || 'CV KBM'}
                  </text>
                  <text x="82" y="101" fill="#ffffff" fontFamily={FONT_FAMILY} fontSize="7" fontWeight="600" letterSpacing="1">
                    {profile?.companyTagline || 'KARYA BAKTI MAKMUR'}
                  </text>
                </>
              ) : (
                <>
                  <g transform="translate(40 71)">
                    <path d="M20 0 L38 10 L38 33 L20 44 L2 33 L2 10 Z" fill="#ffffff" />
                    <path d="M20 11 L29 16 L29 28 L20 33 L11 28 L11 16 Z" fill={headerPrimaryColor} />
                  </g>
                  <text x="88" y="91" fill="#ffffff" fontFamily={FONT_FAMILY} fontSize="15" fontWeight="900" letterSpacing="0.5">
                    {profile?.companyName || 'CV KBM'}
                  </text>
                  <text x="89" y="101" fill="#ffffff" fontFamily={FONT_FAMILY} fontSize="7" fontWeight="600" letterSpacing="1">
                    {profile?.companyTagline || 'KARYA BAKTI MAKMUR'}
                  </text>
                </>
              )}
            </>
          );
        })()}

        <text x="622" y="101" textAnchor="end" fill="#ffffff" fontFamily={FONT_FAMILY} fontSize="44" fontWeight="700" letterSpacing="1">
          {profile?.invoiceTitleText || 'INVOICE'}
        </text>
        <text x="622" y="116" textAnchor="end" fill="#dddddd" fontFamily={FONT_FAMILY} fontSize="10" fontWeight="700" letterSpacing="1">
          NO. {getDisplayInvoiceNo()}
        </text>
      </svg>
    </div>
  );
};
