import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { InvoiceItem, InvoiceProfile, AdditionalFee, GlobalDiscount, GlobalCashback } from '../types/invoice.types';
import { Contact } from '../types/contact.types';
import { invoiceTemplates } from '../data/invoiceTemplates';
import { evaluateItemFormula, getIndonesianDate } from '../utils/invoice';
import { invoke } from '@tauri-apps/api/core';

export interface InvoiceCustomerData extends Partial<Contact> {
  isPenulis?: boolean;
}

const defaultProfiles: InvoiceProfile[] = invoiceTemplates.map(t => {
  const isKBMTmpl = t.profile.companyName?.toUpperCase().includes('KBM') || 
                    t.profile.companyName?.toUpperCase().includes('SASTRABOOK') ||
                    t.templateId.toUpperCase().includes('KBM') ||
                    t.templateId.toUpperCase().includes('SASTRABOOK');
  return {
    ...t.profile,
    id: t.templateId,
    name: t.profile.name || t.label,
    invoiceNoFormat: (t.profile as any).invoiceNoFormat || 'KBM/{year}/{month}/{day}/{seq}',
    companyWebsite: (t.profile as any).companyWebsite || (isKBMTmpl ? 'penerbitkbm.com | penerbitbukumurah.com' : ''),
    companyEmail: (t.profile as any).companyEmail || (isKBMTmpl ? 'naskah@penerbitkbm.com' : ''),
    companyYoutube: (t.profile as any).companyYoutube || (isKBMTmpl ? 'Penerbit KBM Sastrabook' : ''),
    companyInstagram: (t.profile as any).companyInstagram || (isKBMTmpl ? '@penerbit.sastrabook / @penerbit.kbmindonesia' : ''),
    companyPhone: (t.profile as any).companyPhone || (isKBMTmpl ? '0813 5751 7526' : ''),
    showCompanyContact: (t.profile as any).showCompanyContact !== undefined ? (t.profile as any).showCompanyContact : isKBMTmpl,
    footerBgColor: (t.profile as any).footerBgColor || t.profile.headerBgColor || '#222933',
    footerPrimaryColor: (t.profile as any).footerPrimaryColor || t.profile.headerPrimaryColor || t.profile.accentColor || '#c01c1c',
    footerSecondaryColor: (t.profile as any).footerSecondaryColor || t.profile.headerSecondaryColor || t.profile.accentColor || '#c01c1c',
    salamPenutup: (t.profile as any).salamPenutup ?? `Demikian rincian biaya ${t.profile.actionLabel || 'transaksi'} anda. Dan lembar ini kami buat untuk dipergunakan sebagaimana semestinya. Atas kepercayaan anda, kami ucapkan terimakasih.`,
    showNotes: (t.profile as any).showNotes !== undefined ? (t.profile as any).showNotes : true,
    pdfFilenameFormat: (t.profile as any).pdfFilenameFormat || 'Invoice {profile_name} - {invoice_no} - {payment_status}'
  };
}) as InvoiceProfile[];

interface InvoiceContextType {
  customer: InvoiceCustomerData;
  items: InvoiceItem[];
  setItems: (items: InvoiceItem[] | ((prev: InvoiceItem[]) => InvoiceItem[])) => void;
  reorderItems: (startIndex: number, endIndex: number) => void;
  shippingCost: number;
  adminFee: number;
  additionalFees: AdditionalFee[];
  globalDiscount: GlobalDiscount;
  setGlobalDiscount: (disc: GlobalDiscount | ((prev: GlobalDiscount) => GlobalDiscount)) => void;
  globalCashback: GlobalCashback;
  setGlobalCashback: (cb: GlobalCashback | ((prev: GlobalCashback) => GlobalCashback)) => void;
  calculateGlobalDiscountAmount: () => number;
  calculateGlobalCashbackAmount: () => number;
  invoiceType: string;
  invoiceNo: string;
  invoiceHal: string;
  invoiceLampiran: string;
  invoiceDate: string;
  paymentStatus: string;
  spesifikasiFasilitas: string;
  bankAccountInfo: string;
  profiles: InvoiceProfile[];
  activeProfileId: string;
  activeProfile: InvoiceProfile | undefined;
  selectedLayoutId: string;
  setSelectedLayoutId: (id: string) => void;
  setCustomer: (customer: InvoiceCustomerData | ((prev: InvoiceCustomerData) => InvoiceCustomerData)) => void;
  addItem: (item: InvoiceItem) => void;
  updateItem: (index: number, item: Partial<InvoiceItem>) => void;
  removeItem: (index: number) => void;
  setShippingCost: (cost: number) => void;
  setAdminFee: (fee: number) => void;
  setAdditionalFees: (fees: AdditionalFee[] | ((prev: AdditionalFee[]) => AdditionalFee[])) => void;
  addAdditionalFee: (name: string, amount?: number) => void;
  updateAdditionalFee: (id: string, updates: Partial<AdditionalFee>) => void;
  removeAdditionalFee: (id: string) => void;
  setInvoiceType: (type: string) => void;
  setInvoiceNo: (no: string) => void;
  setInvoiceHal: (hal: string) => void;
  setInvoiceLampiran: (lampiran: string) => void;
  setInvoiceDate: (date: string) => void;
  setPaymentStatus: (status: string) => void;
  setSpesifikasiFasilitas: (val: string) => void;
  setBankAccountInfo: (val: string) => void;
  setProfiles: (profiles: InvoiceProfile[]) => void;
  setActiveProfileId: (id: string) => void;
  calculateTotal: () => number;
  calculateItemTotal: (item: InvoiceItem) => number;
  resetInvoice: () => void;
  addOrUpdateProfile: (profile: InvoiceProfile) => void;
  deleteProfile: (id: string) => void;
  resetProfilesToDefault: () => void;
  editingInvoiceId: number | null;
  setEditingInvoiceId: (id: number | null) => void;
  loadInvoiceToForm: (invoice: any) => Promise<void>;
  tempPreviewProfile: InvoiceProfile | null;
  setTempPreviewProfile: (profile: InvoiceProfile | null) => void;
  paidAmount: number;
  setPaidAmount: (amount: number) => void;
  paymentNotes: string;
  setPaymentNotes: (notes: string) => void;
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

export const InvoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [customer, setCustomerState] = useState<InvoiceCustomerData>({
    name: '',
    wa_number: '',
    email: '',
    address: '',
    isPenulis: false
  });
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [shippingCost, setShippingCost] = useState(0);
  const [adminFee, setAdminFee] = useState(0);
  const [additionalFees, setAdditionalFees] = useState<AdditionalFee[]>([]);

  const addAdditionalFee = (name: string, amount: number = 0) => {
    const newFee: AdditionalFee = {
      id: `fee_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name,
      amount
    };
    setAdditionalFees(prev => [...prev, newFee]);
  };

  const updateAdditionalFee = (id: string, updates: Partial<AdditionalFee>) => {
    setAdditionalFees(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeAdditionalFee = (id: string) => {
    setAdditionalFees(prev => prev.filter(f => f.id !== id));
  };
  
  // Custom Invoice Profiles
  const [profiles, setProfilesState] = useState<InvoiceProfile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string>(defaultProfiles[0]?.id ?? '');

  const [invoiceType, setInvoiceType] = useState<string>(defaultProfiles[0]?.id ?? '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceHal, setInvoiceHal] = useState('');
  const [invoiceLampiran, setInvoiceLampiran] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(getIndonesianDate());
  const [paymentStatus, setPaymentStatus] = useState('LUNAS');
  const [spesifikasiFasilitas, setSpesifikasiFasilitas] = useState('Sesuai poster paket yang diambil');
  const [bankAccountInfo, setBankAccountInfo] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [tempPreviewProfile, setTempPreviewProfile] = useState<InvoiceProfile | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState<GlobalDiscount>({ type: 'fixed', value: 0, label: '' });
  const [globalCashback, setGlobalCashback] = useState<GlobalCashback>({ type: 'fixed', value: 0, label: '' });

  // Load profiles from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('invoice_profiles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrasiParsed = parsed.map((p: any) => {
            const matchingDefault = defaultProfiles.find(dp => dp.id === p.id) 
              || defaultProfiles.find(dp => dp.tableType === p.tableType)
              || defaultProfiles[0];
            return {
              ...matchingDefault,
              ...p,
              tableColumns: p.tableColumns || matchingDefault.tableColumns,
              salamPenutup: p.salamPenutup ?? matchingDefault.salamPenutup ?? `Demikian rincian biaya ${p.actionLabel || 'transaksi'} anda. Dan lembar ini kami buat untuk dipergunakan sebagaimana semestinya. Atas kepercayaan anda, kami ucapkan terimakasih.`,
              showNotes: p.showNotes !== undefined ? p.showNotes : (matchingDefault.showNotes !== undefined ? matchingDefault.showNotes : true),
              pdfFilenameFormat: p.pdfFilenameFormat || matchingDefault.pdfFilenameFormat || 'Invoice {profile_name} - {invoice_no} - {payment_status}'
            };
          });
          setProfilesState(migrasiParsed);
          const activeId = localStorage.getItem('active_profile_id') || migrasiParsed[0].id;
          setActiveProfileIdState(activeId);
          return;
        }
      } catch (e) {
        console.error('Gagal memuat profil invoice:', e);
      }
    }
    
    // Fallback ke profil bawaan
    setProfilesState(defaultProfiles);
    localStorage.setItem('invoice_profiles', JSON.stringify(defaultProfiles));
    setActiveProfileIdState(defaultProfiles[0]?.id ?? '');
    localStorage.setItem('active_profile_id', defaultProfiles[0]?.id ?? '');
  }, []);

  // Save profiles to localStorage when updated
  const setProfiles = (newProfiles: InvoiceProfile[]) => {
    setProfilesState(newProfiles);
    localStorage.setItem('invoice_profiles', JSON.stringify(newProfiles));
  };

  const setActiveProfileId = (id: string) => {
    setActiveProfileIdState(id);
    localStorage.setItem('active_profile_id', id);
    // Reset layout override ke default layout profil yang baru dipilih
    setSelectedLayoutId('');
  };

  // Find active profile with dynamic column layout override
  const activeProfile = useMemo(() => {
    const profile = profiles.find(p => p.id === activeProfileId);
    if (!profile) return undefined;

    if (selectedLayoutId) {
      // 1. Coba cari di customLayouts milik profil aktif terlebih dahulu
      const customLayout = profile.customLayouts?.find(l => l.id === selectedLayoutId);
      if (customLayout) {
        return {
          ...profile,
          tableColumns: customLayout.tableColumns,
          tableType: customLayout.shippingType || 'none',
          defaultHal: customLayout.defaultHal || profile.defaultHal
        };
      }

      // 2. Coba cari di template global bawaan system
      const matchedTemplate = invoiceTemplates.find(t => t.templateId === selectedLayoutId);
      if (matchedTemplate) {
        return {
          ...profile,
          tableColumns: matchedTemplate.profile.tableColumns,
          tableType: matchedTemplate.profile.tableType
        };
      }
    }
    return profile;
  }, [profiles, activeProfileId, selectedLayoutId]);

  // Sync state values with active profile details
  useEffect(() => {
    if (activeProfile) {
      setInvoiceType(activeProfile.tableType);
      setInvoiceHal(activeProfile.defaultHal);
      setInvoiceLampiran(activeProfile.defaultLampiran);
      setSpesifikasiFasilitas(activeProfile.defaultSpesifikasi);
      
      let bankText = '';
      if (activeProfile.showBankInfo) {
        if (activeProfile.bankName && activeProfile.bankName.includes('|')) {
          const names = activeProfile.bankName.split('|');
          const nos = activeProfile.bankAccountNo ? activeProfile.bankAccountNo.split('|') : [];
          const owners = activeProfile.bankAccountOwner ? activeProfile.bankAccountOwner.split('|') : [];
          const lines: string[] = [];
          for (let i = 0; i < names.length; i++) {
            if (names[i] || nos[i] || owners[i]) {
              lines.push(`${names[i] || ''} - No: ${nos[i] || ''} a.n. ${owners[i] || ''}`);
            }
          }
          bankText = lines.join('\n');
        } else {
          bankText = `${activeProfile.bankName || ''} - No: ${activeProfile.bankAccountNo || ''} a.n. ${activeProfile.bankAccountOwner || ''}`;
        }
      }
      setBankAccountInfo(bankText);
    }
  }, [activeProfile]);

  const setCustomer = (customerOrUpdater: InvoiceCustomerData | ((prev: InvoiceCustomerData) => InvoiceCustomerData)) => {
    setCustomerState(customerOrUpdater);
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const rawTotal = price * qty;
    const discVal = Number(item.discount) || 0;
    const discAmount = item.discountType === 'percent' ? (rawTotal * discVal / 100) : discVal;
    const itemShip = Number(item.item_shipping_cost) || 0;

    // Jika ada kolom formula total pada profil aktif, gunakan formula tersebut
    if (activeProfile?.tableColumns) {
      const totalCol = activeProfile.tableColumns.find(
        col => col.type === 'formula' && (col.key === 'total' || col.key.toLowerCase().includes('total'))
      );
      if (totalCol && totalCol.formula) {
        const val = evaluateItemFormula(totalCol.formula, item);
        const evalNum = typeof val === 'number' ? val : parseFloat(val) || 0;
        // Jika formula tidak mengandung variabel diskon dan ada diskon item, kurangi diskon item
        if (discAmount > 0 && !totalCol.formula.toLowerCase().includes('discount')) {
          return Math.max(0, evalNum - discAmount + itemShip);
        }
        return evalNum;
      }
    }
    
    return Math.max(0, rawTotal - discAmount + itemShip);
  };

  const calculateGlobalDiscountAmount = () => {
    const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const discVal = Number(globalDiscount.value) || 0;
    if (globalDiscount.type === 'percent') {
      return (itemsTotal * discVal) / 100;
    }
    return discVal;
  };

  const calculateGlobalCashbackAmount = () => {
    const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const discAmount = calculateGlobalDiscountAmount();
    const afterDisc = Math.max(0, itemsTotal - discAmount);
    const globalShip = shippingCost || 0;
    const additionalFeesTotal = additionalFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    const subtotalBeforeCashback = afterDisc + globalShip + adminFee + additionalFeesTotal;

    const cbVal = Number(globalCashback.value) || 0;
    if (globalCashback.type === 'percent') {
      return (subtotalBeforeCashback * cbVal) / 100;
    }
    return cbVal;
  };

  const calculateTotalValue = useMemo(() => {
    const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const discAmount = globalDiscount.type === 'percent'
      ? (itemsTotal * (Number(globalDiscount.value) || 0)) / 100
      : (Number(globalDiscount.value) || 0);
    const afterDisc = Math.max(0, itemsTotal - discAmount);

    const globalShip = shippingCost || 0;
    const additionalFeesTotal = additionalFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const subtotalBeforeCashback = afterDisc + globalShip + adminFee + additionalFeesTotal;
    const cbAmount = globalCashback.type === 'percent'
      ? (subtotalBeforeCashback * (Number(globalCashback.value) || 0)) / 100
      : (Number(globalCashback.value) || 0);

    return Math.max(0, subtotalBeforeCashback - cbAmount);
  }, [items, shippingCost, adminFee, additionalFees, globalDiscount, globalCashback, activeProfile]);

  const calculateTotal = () => calculateTotalValue;

  const addItem = (item: InvoiceItem) => {
    setItems(prev => [...prev, item]);
  };

  const updateItem = (index: number, updates: Partial<InvoiceItem>) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const reorderItems = (startIndex: number, endIndex: number) => {
    if (startIndex === endIndex) return;
    setItems(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  const resetInvoice = () => {
    setCustomer({ name: '', wa_number: '', email: '', address: '', isPenulis: false });
    setItems([]);
    setShippingCost(0);
    setAdminFee(0);
    setAdditionalFees([]);
    setGlobalDiscount({ type: 'fixed', value: 0, label: '' });
    setGlobalCashback({ type: 'fixed', value: 0, label: '' });
    setInvoiceNo('');
    setInvoiceDate(getIndonesianDate());
    setPaymentStatus('LUNAS');
    setEditingInvoiceId(null);
    setSelectedLayoutId('');
    setPaidAmount(0);
    setPaymentNotes('');
    
    if (activeProfile) {
      setInvoiceHal('');
      setInvoiceLampiran('');
      setSpesifikasiFasilitas(activeProfile.defaultSpesifikasi);
    }
  };

  const addOrUpdateProfile = (profile: InvoiceProfile) => {
    setProfilesState(prev => {
      const idx = prev.findIndex(p => p.id === profile.id);
      let updated: InvoiceProfile[];
      if (idx > -1) {
        updated = prev.map((p, i) => i === idx ? profile : p);
      } else {
        updated = [...prev, profile];
      }
      localStorage.setItem('invoice_profiles', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteProfile = (id: string) => {
    setProfilesState(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem('invoice_profiles', JSON.stringify(updated));
      
      // Jika profile aktif dihapus, pilih profile pertama yang tersisa
      if (activeProfileId === id && updated.length > 0) {
        setActiveProfileIdState(updated[0].id);
        localStorage.setItem('active_profile_id', updated[0].id);
      }
      return updated;
    });
  };

  const loadInvoiceToForm = async (invoice: any) => {
    try {
      let metadata: any = {
        invoiceNo: '',
        invoiceDate: '',
        invoiceHal: '',
        invoiceLampiran: '',
        paymentStatus: 'LUNAS',
        spesifikasiFasilitas: '',
        customerName: '',
        customerWa: '',
        customerAddress: '',
        selectedLayoutId: '',
        paidAmount: 0,
        paymentNotes: '',
        additionalFees: []
      };
      
      if (invoice.file_path) {
        try {
          metadata = JSON.parse(invoice.file_path);
        } catch (jsonErr) {
          console.error("Gagal parse metadata JSON:", jsonErr);
        }
      }
      
      let snapshot: any = null;
      if (invoice.customer_snapshot) {
        try {
          snapshot = JSON.parse(invoice.customer_snapshot);
        } catch {}
      }

      // Fallback logic
      let customerData = {
        name: snapshot?.name ?? metadata.customerName ?? '',
        wa_number: snapshot?.wa_number ?? metadata.customerWa ?? '',
        email: snapshot?.email ?? (metadata as any).customerEmail ?? '',
        address: snapshot?.address ?? metadata.customerAddress ?? '',
        isPenulis: snapshot?.isPenulis ?? (metadata as any).isPenulis ?? false
      };

      if (!invoice.customer_snapshot && invoice.customer_id) {
        try {
          const contacts = await invoke<Contact[]>('get_contacts');
          const matchedContact = contacts.find(c => c.id === invoice.customer_id);
          if (matchedContact) {
            customerData = {
              name: matchedContact.name,
              wa_number: matchedContact.wa_number ?? '',
              email: matchedContact.email ?? '',
              address: matchedContact.address ?? '',
              isPenulis: matchedContact.type === 'penulis' || matchedContact.type === 'both'
            };
          }
        } catch (err) {
          console.error("Gagal memuat kontak fallback:", err);
        }
      }

      setCustomer(customerData);
      
      let parsedItems = [];
      if (invoice.items_json) {
        try {
          parsedItems = JSON.parse(invoice.items_json);
        } catch (jsonErr) {
          console.error("Gagal parse items JSON:", jsonErr);
        }
      }
      setItems(parsedItems);
      
      setShippingCost(invoice.shipping_cost || 0);
      setAdminFee(invoice.admin_fee || 0);
      setAdditionalFees(invoice.additional_fees || metadata.additionalFees || []);
      setGlobalDiscount(metadata.globalDiscount || { type: 'fixed', value: 0, label: '' });
      setGlobalCashback(metadata.globalCashback || { type: 'fixed', value: 0, label: '' });
      setInvoiceNo(metadata.invoiceNo || '');
      setInvoiceHal(metadata.invoiceHal || '');
      setInvoiceLampiran(metadata.invoiceLampiran || '');
      setInvoiceDate(metadata.invoiceDate || '');
      const currentPayStatus = invoice.payment_status || metadata.paymentStatus || 'LUNAS';
      setPaymentStatus(currentPayStatus);
      setSpesifikasiFasilitas(metadata.spesifikasiFasilitas || '');
      setSelectedLayoutId(metadata.selectedLayoutId || '');
      const isLunas = currentPayStatus === 'LUNAS';
      setPaidAmount(isLunas ? (invoice.total || metadata.paidAmount || 0) : (invoice.paid_amount ?? metadata.paidAmount ?? 0));
      setPaymentNotes(invoice.payment_notes || metadata.paymentNotes || '');
      
      // Cocokkan profile dengan export_format
      const matchingProfile = profiles.find(p => p.id === invoice.export_format || p.tableType === invoice.export_format);
      if (matchingProfile) {
        setActiveProfileIdState(matchingProfile.id);
      }
      
      if (invoice.id) {
        setEditingInvoiceId(invoice.id);
      }
    } catch (e) {
      console.error("Gagal memuat invoice ke form:", e);
    }
  };

  const resetProfilesToDefault = () => {
    setProfilesState(defaultProfiles);
    localStorage.setItem('invoice_profiles', JSON.stringify(defaultProfiles));
    setActiveProfileIdState(defaultProfiles[0]?.id ?? '');
    localStorage.setItem('active_profile_id', defaultProfiles[0]?.id ?? '');
  };

  return (
    <InvoiceContext.Provider value={{
      customer,
      items,
      setItems,
      reorderItems,
      shippingCost,
      adminFee,
      additionalFees,
      globalDiscount,
      setGlobalDiscount,
      globalCashback,
      setGlobalCashback,
      calculateGlobalDiscountAmount,
      calculateGlobalCashbackAmount,
      invoiceType,
      invoiceNo,
      invoiceHal,
      invoiceLampiran,
      invoiceDate,
      paymentStatus,
      spesifikasiFasilitas,
      bankAccountInfo,
      profiles,
      activeProfileId,
      activeProfile,
      selectedLayoutId,
      setSelectedLayoutId,
      setCustomer,
      addItem,
      updateItem,
      removeItem,
      setShippingCost,
      setAdminFee,
      setAdditionalFees,
      addAdditionalFee,
      updateAdditionalFee,
      removeAdditionalFee,
      setInvoiceType,
      setInvoiceNo,
      setInvoiceHal,
      setInvoiceLampiran,
      setInvoiceDate,
      setPaymentStatus,
      setSpesifikasiFasilitas,
      setBankAccountInfo,
      setProfiles,
      setActiveProfileId,
      calculateTotal,
      calculateItemTotal,
      resetInvoice,
      addOrUpdateProfile,
      deleteProfile,
      resetProfilesToDefault,
      editingInvoiceId,
      setEditingInvoiceId,
      loadInvoiceToForm,
      tempPreviewProfile,
      setTempPreviewProfile,
      paidAmount,
      setPaidAmount,
      paymentNotes,
      setPaymentNotes,
    }}>
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoiceContext = () => {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoiceContext must be used within InvoiceProvider');
  }
  return context;
};
