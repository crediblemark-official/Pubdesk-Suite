import { useState, useEffect } from 'react';
import { useInvoiceContext } from '../../../contexts/InvoiceContext';
import { useAppContext } from '../../../contexts/AppContext';
import { InvoiceProfile, InvoiceTableColumn, CustomInvoiceLayout } from '../../../types/invoice.types';
import { invoiceTemplates } from '../../../data/invoiceTemplates';

export function useInvoiceSettingsForm() {
  const {
    profiles,
    activeProfileId,
    setActiveProfileId,
    addOrUpdateProfile,
    deleteProfile,
    setProfiles,
    setTempPreviewProfile
  } = useInvoiceContext();
  const { showToast, showConfirm, addFile, files } = useAppContext();

  const [selectedProfileId, setSelectedProfileId] = useState<string>(activeProfileId);
  const [isEditingNew, setIsEditingNew] = useState<boolean>(false);

  // State untuk form input
  const [profileName, setProfileName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyTagline, setCompanyTagline] = useState('');
  const [invoiceTitleText, setInvoiceTitleText] = useState('INVOICE');
  const [accentColor, setAccentColor] = useState('#1e70cd');
  const [accentColorDark, setAccentColorDark] = useState('#1e3a8a');
  const [headerBgColor, setHeaderBgColor] = useState('#222933');
  const [headerPrimaryColor, setHeaderPrimaryColor] = useState('#d93838');
  const [headerSecondaryColor, setHeaderSecondaryColor] = useState('#d93838');
  const [defaultHal, setDefaultHal] = useState('');
  const [defaultLampiran, setDefaultLampiran] = useState('-');
  const [salamPembuka, setSalamPembuka] = useState('');
  const [salamPenutup, setSalamPenutup] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [tableType, setTableType] = useState<string>('');
  const [notes, setNotes] = useState<string[]>([]);
  const [showSpesifikasi, setShowSpesifikasi] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [defaultSpesifikasi, setDefaultSpesifikasi] = useState('');
  const [signatureOffice, setSignatureOffice] = useState('');
  const [signatureLocation, setSignatureLocation] = useState('');
  const [signatureRole, setSignatureRole] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountOwner, setBankAccountOwner] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [signatureImg, setSignatureImg] = useState('');
  const [signatureSpacing, setSignatureSpacing] = useState<number>(40);
  const [showDefaultSignature, setShowDefaultSignature] = useState(true);
  const [tableHeaderBg, setTableHeaderBg] = useState('#1e70cd');
  const [tableHeaderNoBg, setTableHeaderNoBg] = useState('#1e3a8a');
  const [tableHeaderTextColor, setTableHeaderTextColor] = useState('#ffffff');
  const [tableBodyTextColor, setTableBodyTextColor] = useState('#000000');
  const [tableRowEvenBg, setTableRowEvenBg] = useState('#fdf2f2');
  const [tableRowOddBg, setTableRowOddBg] = useState('#ffffff');
  const [tableBorderColor, setTableBorderColor] = useState('#e5e7eb');
  const [headerType, setHeaderType] = useState<'logo_only' | 'logo_text' | 'text_only'>('logo_text');
  const [tableColumns, setTableColumns] = useState<InvoiceTableColumn[]>([]);
  const [shippingType, setShippingType] = useState<'none' | 'global' | 'item'>('global');
  const [watermarkColor, setWatermarkColor] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(8);
  const [invoiceNoFormat, setInvoiceNoFormat] = useState('KBM/{year}/{month}/{day}/{seq}');
  const [pdfFilenameFormat, setPdfFilenameFormat] = useState('Invoice {profile_name} - {invoice_no} - {payment_status}');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyYoutube, setCompanyYoutube] = useState('');
  const [companyInstagram, setCompanyInstagram] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [showCompanyContact, setShowCompanyContact] = useState(false);
  const [showFooterBranding, setShowFooterBranding] = useState(true);
  const [footerNoteText, setFooterNoteText] = useState('');
  const [footerBgColor, setFooterBgColor] = useState('');
  const [footerPrimaryColor, setFooterPrimaryColor] = useState('');
  const [footerSecondaryColor, setFooterSecondaryColor] = useState('');
  const [customLayouts, setCustomLayouts] = useState<CustomInvoiceLayout[]>([]);
  const [defaultLayoutName, setDefaultLayoutName] = useState('Default / Bawaan');
  
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState<number | null>(1);

  // Helper to build full columns (injecting item_shipping_cost if needed)
  const getFullTableColumns = (cols: InvoiceTableColumn[], type: 'none' | 'global' | 'item') => {
    let finalCols = cols.filter(c => c.key !== 'item_shipping_cost');
    if (type === 'item') {
      const totalIdx = finalCols.findIndex(c => c.key === 'total');
      const shippingCol = { key: 'item_shipping_cost', label: 'Ongkos Kirim', type: 'currency' as const, align: 'right' as const, width: '100px' };
      if (totalIdx > -1) {
        finalCols.splice(totalIdx, 0, shippingCol);
      } else {
        finalCols.push(shippingCol);
      }
    }
    return finalCols;
  };

  // Memuat data profil terpilih ke dalam state form
  useEffect(() => {
    if (isEditingNew) {
      setProfileName('Profil Baru');
      setCompanyName('NAMA PERUSAHAAN');
      setCompanyTagline('TAGLINE PERUSAHAAN');
      setInvoiceTitleText('INVOICE');
      setAccentColor('#1e70cd');
      setAccentColorDark('#1e3a8a');
      setHeaderBgColor('#222933');
      setHeaderPrimaryColor('#d93838');
      setHeaderSecondaryColor('#d93838');
      setDefaultHal('Perihal Invoice');
      setDefaultLampiran('-');
      setSalamPembuka('Bersama surat ini kami memberikan gambaran rincian biaya dengan ketentuan sebagai berikut:');
      setSalamPenutup('Demikian rincian biaya transaksi anda. Dan lembar ini kami buat untuk dipergunakan sebagaimana semestinya. Atas kepercayaan anda, kami ucapkan terimakasih.');
      setActionLabel('transaksi');
      setTableType('');
      setNotes([]);
      setShowSpesifikasi(false);
      setShowNotes(true);
      setDefaultSpesifikasi('');
      setSignatureOffice('Kantor Utama');
      setSignatureLocation('Kota Asal');
      setSignatureRole('Direktur');
      setSignatureName('Nama Penandatangan');
      setShowBankInfo(false);
      setBankName('');
      setBankAccountNo('');
      setBankAccountOwner('');
      setCompanyLogo('');
      setSignatureImg('');
      setSignatureSpacing(40);
      setShowDefaultSignature(true);
      setTableHeaderBg('#1e70cd');
      setTableHeaderNoBg('#1e3a8a');
      setTableHeaderTextColor('#ffffff');
      setTableBodyTextColor('#000000');
      setTableRowEvenBg('#fdf2f2');
      setTableRowOddBg('#ffffff');
      setTableBorderColor('#e5e7eb');
      setHeaderType('logo_text');
      setCustomLayouts([]);
      setDefaultLayoutName('Default / Bawaan');
      setTableColumns([
        { key: 'item_title', label: 'Judul', type: 'text', align: 'left' },
        { key: 'pages', label: 'Hal', type: 'text', align: 'center', width: '90px' },
        { key: 'paper_type', label: 'Jenis Naskah', type: 'text', align: 'center', width: '90px' },
        { key: 'quantity', label: 'Jml. Cetak', type: 'number', align: 'center', width: '80px' },
        { key: 'price', label: 'Cetak/pcs', type: 'currency', align: 'right', width: '100px' },
        { key: 'total', label: 'Total Biaya', type: 'formula', align: 'right', width: '110px', formula: '{price} * {quantity}' }
      ]);
      setShippingType('global');
      setWatermarkColor('');
      setWatermarkOpacity(8);
      setInvoiceNoFormat('KBM/{year}/{month}/{day}/{seq}');
      setPdfFilenameFormat('Invoice {profile_name} - {invoice_no} - {payment_status}');
      setCompanyWebsite('');
      setCompanyEmail('');
      setCompanyYoutube('');
      setCompanyInstagram('');
      setCompanyPhone('');
      setShowCompanyContact(false);
      setShowFooterBranding(true);
      setFooterNoteText('');
      setFooterBgColor('#222933');
      setFooterPrimaryColor('#d93838');
      setFooterSecondaryColor('#d93838');
    } else {
      const profile = profiles.find((p) => p.id === selectedProfileId);
      if (profile) {
        setProfileName(profile.name || '');
        setCompanyName(profile.companyName || '');
        setCompanyTagline(profile.companyTagline || '');
        setInvoiceTitleText(profile.invoiceTitleText || 'INVOICE');
        setAccentColor(profile.accentColor || '#1e70cd');
        setAccentColorDark(profile.accentColorDark || '#1e3a8a');
        setHeaderBgColor(profile.headerBgColor || '#222933');
        setHeaderPrimaryColor(profile.headerPrimaryColor || (profile as any).headerColor || profile.accentColor || '#d93838');
        setHeaderSecondaryColor(profile.headerSecondaryColor || (profile as any).headerColor || profile.accentColor || '#d93838');
        setFooterBgColor(profile.footerBgColor || profile.headerBgColor || '#222933');
        setFooterPrimaryColor(profile.footerPrimaryColor || profile.headerPrimaryColor || profile.accentColor || '#d93838');
        setFooterSecondaryColor(profile.footerSecondaryColor || profile.headerSecondaryColor || profile.accentColor || '#d93838');
        setDefaultHal(profile.defaultHal || '');
        setDefaultLampiran(profile.defaultLampiran || '-');
        setSalamPembuka(profile.salamPembuka || '');
        setSalamPenutup(profile.salamPenutup ?? `Demikian rincian biaya ${profile.actionLabel || 'transaksi'} anda. Dan lembar ini kami buat untuk dipergunakan sebagaimana semestinya. Atas kepercayaan anda, kami ucapkan terimakasih.`);
        setActionLabel(profile.actionLabel || '');
        setTableType(profile.tableType || '');
        setNotes(profile.notes || []);
        setShowSpesifikasi(profile.showSpesifikasi || false);
        setShowNotes(profile.showNotes !== undefined ? profile.showNotes : true);
        setDefaultSpesifikasi(profile.defaultSpesifikasi || '');
        setSignatureOffice(profile.signatureOffice || '');
        setSignatureLocation(profile.signatureLocation || '');
        setSignatureRole(profile.signatureRole || '');
        setSignatureName(profile.signatureName || '');
        setShowBankInfo(profile.showBankInfo || false);
        setBankName(profile.bankName || '');
        setBankAccountNo(profile.bankAccountNo || '');
        setBankAccountOwner(profile.bankAccountOwner || '');
        setCompanyLogo(profile.companyLogo || '');
        setSignatureImg(profile.signatureImg || '');
        setSignatureSpacing(profile.signatureSpacing !== undefined ? profile.signatureSpacing : 40);
        setShowDefaultSignature(profile.showDefaultSignature !== undefined ? profile.showDefaultSignature : true);
        setTableHeaderBg(profile.tableHeaderBg || profile.accentColor || '#1e70cd');
        setTableHeaderNoBg(profile.tableHeaderNoBg || profile.accentColorDark || '#1e3a8a');
        setTableHeaderTextColor(profile.tableHeaderTextColor || '#ffffff');
        setTableBodyTextColor(profile.tableBodyTextColor || '#000000');
        setTableRowEvenBg(profile.tableRowEvenBg || '#fdf2f2');
        setTableRowOddBg(profile.tableRowOddBg || '#ffffff');
        setTableBorderColor(profile.tableBorderColor || '#e5e7eb');
        setHeaderType(profile.headerType || 'logo_text');
 
        const colsWithoutShipping = (profile.tableColumns || []).filter(c => c.key !== 'item_shipping_cost');
        setTableColumns(colsWithoutShipping);
 
        const hasShippingCol = (profile.tableColumns || []).some(c => c.key === 'item_shipping_cost');
        const detectedType = profile.shippingType || (hasShippingCol ? 'item' : 'global');
        setShippingType(detectedType);
 
        setWatermarkColor(profile.watermarkColor || '');
        setWatermarkOpacity(profile.watermarkOpacity !== undefined ? profile.watermarkOpacity : 8);
        setInvoiceNoFormat(profile.invoiceNoFormat || 'KBM/{year}/{month}/{day}/{seq}');
        setPdfFilenameFormat(profile.pdfFilenameFormat || 'Invoice {profile_name} - {invoice_no} - {payment_status}');
        setCustomLayouts(profile.customLayouts || []);
        setDefaultLayoutName(profile.defaultLayoutName || 'Default / Bawaan');
        setCompanyWebsite(profile.companyWebsite || '');
        setCompanyEmail(profile.companyEmail || '');
        setCompanyYoutube(profile.companyYoutube || '');
        setCompanyInstagram(profile.companyInstagram || '');
        setCompanyPhone(profile.companyPhone || '');
        setShowCompanyContact(profile.showCompanyContact || false);
        setShowFooterBranding(profile.showFooterBranding !== undefined ? profile.showFooterBranding : true);
        setFooterNoteText(profile.footerNoteText || '');
      }
    }
  }, [selectedProfileId, isEditingNew]);

  // Sinkronisasi selectedProfileId ketika activeProfileId berubah secara global
  useEffect(() => {
    if (!isEditingNew) {
      setSelectedProfileId(activeProfileId);
    }
  }, [activeProfileId, isEditingNew]);

  const currentEditingProfile: InvoiceProfile = {
    id: isEditingNew ? `profile_preview_${Date.now()}` : selectedProfileId,
    name: profileName,
    defaultLayoutName,
    companyName,
    companyTagline,
    invoiceTitleText,
    accentColor,
    accentColorDark,
    headerBgColor,
    headerPrimaryColor,
    headerSecondaryColor,
    footerBgColor,
    footerPrimaryColor,
    footerSecondaryColor,
    defaultHal,
    defaultLampiran,
    salamPembuka,
    salamPenutup,
    actionLabel,
    tableType,
    notes,
    showSpesifikasi,
    showNotes,
    defaultSpesifikasi,
    signatureOffice,
    signatureLocation,
    signatureRole,
    signatureName,
    showBankInfo,
    bankName,
    bankAccountNo,
    bankAccountOwner,
    companyLogo,
    signatureImg,
    signatureSpacing,
    showDefaultSignature,
    tableHeaderBg,
    tableHeaderNoBg,
    tableHeaderTextColor,
    tableBodyTextColor,
    tableRowEvenBg,
    tableRowOddBg,
    tableBorderColor,
    headerType,
    tableColumns: getFullTableColumns(tableColumns, shippingType),
    shippingType,
    watermarkColor,
    watermarkOpacity,
    invoiceNoFormat,
    pdfFilenameFormat,
    companyWebsite,
    companyEmail,
    companyYoutube,
    companyInstagram,
    companyPhone,
    showCompanyContact,
    showFooterBranding,
    footerNoteText
  };

  // Sinkronisasikan profil yang sedang diedit ke preview global di PanelKanan
  useEffect(() => {
    setTempPreviewProfile(currentEditingProfile);
    return () => {
      setTempPreviewProfile(null);
    };
  }, [
    isEditingNew,
    selectedProfileId,
    profileName,
    companyName,
    companyTagline,
    invoiceTitleText,
    accentColor,
    accentColorDark,
    headerBgColor,
    headerPrimaryColor,
    headerSecondaryColor,
    footerBgColor,
    footerPrimaryColor,
    footerSecondaryColor,
    defaultHal,
    defaultLampiran,
    salamPembuka,
    salamPenutup,
    actionLabel,
    tableType,
    notes,
    showSpesifikasi,
    showNotes,
    defaultSpesifikasi,
    signatureOffice,
    signatureLocation,
    signatureRole,
    signatureName,
    showBankInfo,
    bankName,
    bankAccountNo,
    bankAccountOwner,
    companyLogo,
    signatureImg,
    signatureSpacing,
    showDefaultSignature,
    tableHeaderBg,
    tableHeaderNoBg,
    tableHeaderTextColor,
    tableBodyTextColor,
    tableRowEvenBg,
    tableRowOddBg,
    tableBorderColor,
    headerType,
    tableColumns,
    shippingType,
    watermarkColor,
    watermarkOpacity,
    invoiceNoFormat,
    companyWebsite,
    companyEmail,
    companyYoutube,
    companyInstagram,
    companyPhone,
    showCompanyContact,
    showFooterBranding,
    footerNoteText,
    defaultLayoutName,
    setTempPreviewProfile
  ]);

  // Auto-save pdfFilenameFormat ke profile aktif di localStorage tanpa harus klik Simpan
  useEffect(() => {
    if (!selectedProfileId || isEditingNew) return;
    const saved = localStorage.getItem('invoice_profiles');
    if (!saved) return;
    try {
      const parsed: InvoiceProfile[] = JSON.parse(saved);
      const idx = parsed.findIndex(p => p.id === selectedProfileId);
      if (idx > -1 && parsed[idx].pdfFilenameFormat !== pdfFilenameFormat) {
        parsed[idx] = { ...parsed[idx], pdfFilenameFormat };
        localStorage.setItem('invoice_profiles', JSON.stringify(parsed));
        addOrUpdateProfile(parsed[idx]);
      }
    } catch (_) { /* abaikan */ }
  }, [pdfFilenameFormat, selectedProfileId, isEditingNew]);

  const handleSave = () => {
    if (!profileName.trim()) {
      showToast('Nama Profil tidak boleh kosong!', 'error');
      return;
    }

    const savedProfile: InvoiceProfile = {
      ...currentEditingProfile,
      id: isEditingNew ? `profile_${Date.now()}` : selectedProfileId,
      tableColumns: getFullTableColumns(tableColumns, shippingType),
      shippingType,
      customLayouts
    };

    addOrUpdateProfile(savedProfile);
    setIsEditingNew(false);
    setSelectedProfileId(savedProfile.id);
    setActiveProfileId(savedProfile.id);
    showToast('Profil invoice berhasil disimpan!', 'success');
  };

  const handleCreateNew = () => {
    setIsEditingNew(true);
  };

  const handleLoadTemplate = (templateId: string) => {
    const tmpl = invoiceTemplates.find(t => t.templateId === templateId);
    if (!tmpl) return;
    const p = tmpl.profile;
    setProfileName(`${tmpl.label} (Salinan)`);
    setCompanyName(p.companyName || '');
    setCompanyTagline(p.companyTagline || '');
    setInvoiceTitleText(p.invoiceTitleText || 'INVOICE');
    setAccentColor(p.accentColor || '#1e70cd');
    setAccentColorDark(p.accentColorDark || '#1e3a8a');
    setHeaderBgColor(p.headerBgColor || '#222933');
    setHeaderPrimaryColor(p.headerPrimaryColor || '#d93838');
    setHeaderSecondaryColor(p.headerSecondaryColor || '#d93838');
    setDefaultHal(p.defaultHal || '');
    setDefaultLampiran(p.defaultLampiran || '-');
    setSalamPembuka(p.salamPembuka || '');
    setSalamPenutup(p.salamPenutup ?? `Demikian rincian biaya ${p.actionLabel || 'transaksi'} anda. Dan lembar ini kami buat untuk dipergunakan sebagaimana semestinya. Atas kepercayaan anda, kami ucapkan terimakasih.`);
    setActionLabel(p.actionLabel || '');
    setTableType(p.tableType || '');
    setNotes(p.notes || []);
    setShowSpesifikasi(p.showSpesifikasi || false);
    setShowNotes(p.showNotes !== undefined ? p.showNotes : true);
    setDefaultSpesifikasi(p.defaultSpesifikasi || '');
    setSignatureOffice(p.signatureOffice || '');
    setSignatureLocation(p.signatureLocation || '');
    setSignatureRole(p.signatureRole || '');
    setSignatureName(p.signatureName || '');
    setShowBankInfo(p.showBankInfo || false);
    setBankName(p.bankName || '');
    setBankAccountNo(p.bankAccountNo || '');
    setBankAccountOwner(p.bankAccountOwner || '');
    setCompanyLogo(p.companyLogo || '');
    setSignatureImg(p.signatureImg || '');
    setSignatureSpacing((p as any).signatureSpacing !== undefined ? (p as any).signatureSpacing : 40);
    setShowDefaultSignature((p as any).showDefaultSignature !== undefined ? (p as any).showDefaultSignature : true);
    setTableHeaderBg(p.tableHeaderBg || p.accentColor || '#1e70cd');
    setTableHeaderNoBg(p.tableHeaderNoBg || p.accentColorDark || '#1e3a8a');
    setTableHeaderTextColor(p.tableHeaderTextColor || '#ffffff');
    setTableBodyTextColor(p.tableBodyTextColor || '#000000');
    setTableRowEvenBg(p.tableRowEvenBg || '#fdf2f2');
    setTableRowOddBg(p.tableRowOddBg || '#ffffff');
    setTableBorderColor(p.tableBorderColor || '#e5e7eb');
    setHeaderType(p.headerType || 'logo_text');
    
    const colsWithoutShipping = (p.tableColumns || []).filter(c => c.key !== 'item_shipping_cost');
    setTableColumns(colsWithoutShipping);

    const hasShippingCol = (p.tableColumns || []).some(c => c.key === 'item_shipping_cost');
    const detectedType = p.shippingType || (hasShippingCol ? 'item' : 'global');
    setShippingType(detectedType);

    setWatermarkColor(p.watermarkColor || '');
    setWatermarkOpacity(p.watermarkOpacity !== undefined ? p.watermarkOpacity : 8);
    setInvoiceNoFormat((p as any).invoiceNoFormat || 'KBM/{year}/{month}/{day}/{seq}');
    setDefaultLayoutName(p.defaultLayoutName || 'Default / Bawaan');
    setCompanyWebsite((p as any).companyWebsite || '');
    setCompanyEmail((p as any).companyEmail || '');
    setCompanyYoutube((p as any).companyYoutube || '');
    setCompanyInstagram((p as any).companyInstagram || '');
    setCompanyPhone((p as any).companyPhone || '');
    setShowCompanyContact((p as any).showCompanyContact || false);

    setShowTemplateModal(false);
  };

  const handleCancelNew = () => {
    setIsEditingNew(false);
    setSelectedProfileId(activeProfileId);
  };

  const handleDelete = () => {
    if (profiles.length <= 1) {
      showToast('Tidak dapat menghapus satu-satunya profil yang tersisa!', 'error');
      return;
    }
    showConfirm({
      title: 'Hapus Profil',
      message: `Apakah Anda yakin ingin menghapus profil "${profileName}"?`,
      confirmText: 'Hapus',
      type: 'danger',
      onConfirm: () => {
        deleteProfile(selectedProfileId);
        showToast('Profil berhasil dihapus.', 'success');
        const remaining = profiles.filter((p) => p.id !== selectedProfileId);
        if (remaining.length > 0) {
          setSelectedProfileId(remaining[0].id);
        }
      }
    });
  };

  const handleExportBackup = async () => {
    try {
      const dataStr = JSON.stringify(profiles, null, 2);
      const bytes = new TextEncoder().encode(dataStr);

      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
        defaultPath: 'pubdesk_invoice_profiles_backup.json'
      });

      if (!filePath) {
        // User membatalkan dialog
        return;
      }

      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
      
      // Menulis file backup ke path yang dipilih user
      await tauriInvoke('write_binary_file', {
        path: filePath,
        bytes: Array.from(bytes)
      });

      // Ekstrak nama file dari path untuk log database/files lokal
      const filename = filePath.split(/[/\\]/).pop() || 'pubdesk_invoice_profiles_backup.json';

      const alreadyExists = files.some((f) => f.path === filePath && f.type === 'other');
      if (!alreadyExists) {
        const fileData = {
          filename,
          path: filePath,
          type: 'other',
          project_id: undefined,
          version_label: 'Backup',
          status: 'Aktif',
          last_modified: new Date().toISOString(),
          is_readonly: false
        };
        await addFile(fileData);
      }

      showToast(`Backup berhasil diekspor ke: ${filePath}`, 'success');
      await tauriInvoke('open_file_location_physically', { path: filePath });
    } catch (error) {
      console.error(error);
      showToast('Gagal mengekspor backup.', 'error');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files.length > 0) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Validasi: p.id dan p.name wajib ada. companyName opsional dan bisa kosong (falsy).
            const isValid = parsed.every((p) => p && p.id && p.name);
            if (isValid) {
              setProfiles(parsed);
              setSelectedProfileId(parsed[0].id);
              setActiveProfileId(parsed[0].id);
              showToast('Backup profil berhasil di-import!', 'success');
            } else {
              showToast('Format berkas backup JSON tidak valid!', 'error');
            }
          } else {
            showToast('Berkas backup JSON kosong atau tidak valid!', 'error');
          }
        } catch (error) {
          console.error(error);
          showToast('Gagal mengurai berkas JSON backup.', 'error');
        } finally {
          e.target.value = '';
        }
      };
    }
  };

  return {
    profiles,
    selectedProfileId,
    setSelectedProfileId,
    isEditingNew,
    setIsEditingNew,
    profileName,
    setProfileName,
    companyName,
    setCompanyName,
    companyTagline,
    setCompanyTagline,
    invoiceTitleText,
    setInvoiceTitleText,
    accentColor,
    setAccentColor,
    accentColorDark,
    setAccentColorDark,
    headerBgColor,
    setHeaderBgColor,
    headerPrimaryColor,
    setHeaderPrimaryColor,
    headerSecondaryColor,
    setHeaderSecondaryColor,
    defaultHal,
    setDefaultHal,
    defaultLampiran,
    setDefaultLampiran,
    salamPembuka,
    setSalamPembuka,
    salamPenutup,
    setSalamPenutup,
    actionLabel,
    setActionLabel,
    tableType,
    setTableType,
    notes,
    setNotes,
    showSpesifikasi,
    setShowSpesifikasi,
    showNotes,
    setShowNotes,
    defaultSpesifikasi,
    setDefaultSpesifikasi,
    signatureOffice,
    setSignatureOffice,
    signatureLocation,
    setSignatureLocation,
    signatureRole,
    setSignatureRole,
    signatureName,
    setSignatureName,
    showBankInfo,
    setShowBankInfo,
    bankName,
    setBankName,
    bankAccountNo,
    setBankAccountNo,
    bankAccountOwner,
    setBankAccountOwner,
    companyLogo,
    setCompanyLogo,
    signatureImg,
    setSignatureImg,
    signatureSpacing,
    setSignatureSpacing,
    showDefaultSignature,
    setShowDefaultSignature,
    tableHeaderBg,
    setTableHeaderBg,
    tableHeaderNoBg,
    setTableHeaderNoBg,
    tableHeaderTextColor,
    setTableHeaderTextColor,
    tableBodyTextColor,
    setTableBodyTextColor,
    tableRowEvenBg,
    setTableRowEvenBg,
    tableRowOddBg,
    setTableRowOddBg,
    tableBorderColor,
    setTableBorderColor,
    headerType,
    setHeaderType,
    tableColumns,
    setTableColumns,
    shippingType,
    setShippingType,
    watermarkColor,
    setWatermarkColor,
    watermarkOpacity,
    setWatermarkOpacity,
    invoiceNoFormat,
    setInvoiceNoFormat,
    pdfFilenameFormat,
    setPdfFilenameFormat,
    companyWebsite,
    setCompanyWebsite,
    companyEmail,
    setCompanyEmail,
    companyYoutube,
    setCompanyYoutube,
    companyInstagram,
    setCompanyInstagram,
    companyPhone,
    setCompanyPhone,
    showCompanyContact,
    setShowCompanyContact,
    showFooterBranding,
    setShowFooterBranding,
    footerNoteText,
    setFooterNoteText,
    footerBgColor,
    setFooterBgColor,
    footerPrimaryColor,
    setFooterPrimaryColor,
    footerSecondaryColor,
    setFooterSecondaryColor,
    showTemplateModal,
    setShowTemplateModal,
    expandedSection,
    setExpandedSection,
    customLayouts,
    setCustomLayouts,
    defaultLayoutName,
    setDefaultLayoutName,
    handleSave,
    handleCreateNew,
    handleLoadTemplate,
    handleCancelNew,
    handleDelete,
    handleExportBackup,
    handleImportBackup
  };
}
