/**
 * Tipe data domain: Invoice
 */

export interface InvoiceTableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'formula';
  width?: string;
  align?: 'left' | 'center' | 'right';
  formula?: string;
}

export interface InvoiceItem {
  book_id: number;
  service_id?: number;
  item_title: string;
  quantity: number;
  price: number;
  discount: number;
  discountType?: 'fixed' | 'percent';
  pages?: string;
  paper_type?: string;
  copyright_holder?: string;
  item_shipping_cost?: number;
  package_name?: string;
  [key: string]: any; // Mendukung properti dinamis tambahan
}

export interface AdditionalFee {
  id: string;
  name: string;
  amount: number;
}

export interface GlobalDiscount {
  type: 'fixed' | 'percent';
  value: number;
  label?: string;
}

export interface GlobalCashback {
  type: 'fixed' | 'percent';
  value: number;
  label?: string;
}

export interface Invoice {
  id?: number;
  created_at: string;
  customer_id?: number;
  items_json: string;
  shipping_cost: number;
  admin_fee: number;
  additional_fees?: AdditionalFee[];
  total: number;
  export_format?: string;
  file_path?: string;
  sync_status?: string;
  cloud_file_url?: string;
  customer_snapshot?: string;
  payment_status?: string;
  naskah_id?: number;
  paid_amount?: number;
  remaining_amount?: number;
  payment_notes?: string;
}

export interface CustomInvoiceLayout {
  id: string;
  name: string;
  tableColumns: InvoiceTableColumn[];
  shippingType?: 'none' | 'global' | 'item';
  defaultHal?: string;
}

export interface InvoiceProfile {
  id: string;
  name: string;
  companyName: string;
  companyTagline: string;
  invoiceTitleText: string;
  accentColor: string;
  accentColorDark: string;
  headerBgColor: string;
  headerPrimaryColor: string;
  headerSecondaryColor: string;
  footerBgColor?: string;
  footerPrimaryColor?: string;
  footerSecondaryColor?: string;
  defaultHal: string;
  defaultLampiran: string;
  salamPembuka: string;
  salamPenutup?: string;
  actionLabel: string;
  tableType: string;
  notes: string[];
  showNotes?: boolean;
  showSpesifikasi: boolean;
  defaultSpesifikasi: string;
  signatureOffice: string;
  signatureLocation: string;
  signatureRole: string;
  signatureName: string;
  showBankInfo: boolean;
  bankName: string;
  bankAccountNo: string;
  bankAccountOwner: string;
  companyLogo?: string;
  signatureImg?: string;
  signatureSpacing?: number;
  showDefaultSignature?: boolean;
  tableHeaderBg?: string;
  tableHeaderNoBg?: string;
  tableHeaderTextColor?: string;
  tableBodyTextColor?: string;
  tableRowEvenBg?: string;
  tableRowOddBg?: string;
  tableBorderColor?: string;
  headerType?: 'logo_only' | 'logo_text' | 'text_only';
  tableColumns?: InvoiceTableColumn[];
  shippingType?: 'none' | 'global' | 'item';
  watermarkColor?: string;
  watermarkOpacity?: number;
  invoiceNoFormat?: string;
  pdfFilenameFormat?: string;
  companyWebsite?: string;
  companyEmail?: string;
  companyYoutube?: string;
  companyInstagram?: string;
  companyPhone?: string;
  showCompanyContact?: boolean;
  showFooterBranding?: boolean;
  footerNoteText?: string;
  defaultLayoutName?: string;
  customLayouts?: CustomInvoiceLayout[];
}
