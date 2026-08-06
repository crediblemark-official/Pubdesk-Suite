/**
 * Service untuk integrasi Google Apps Script (Google Sheets & Google Drive)
 */
import { invoke } from '@tauri-apps/api/core';

export interface GASInvoiceItem {
  item_title: string;
  quantity: number;
  price: number;
}

export interface GASInvoicePayload {
  invoice_no?: string;
  tanggal: string;
  pelanggan: string;
  whatsapp: string;
  alamat?: string;
  items: GASInvoiceItem[];
  shipping_cost: number;
  admin_fee: number;
  total: number;
}

const STORAGE_KEYS = {
  URL: 'pubdesk_gas_url',
  TOKEN: 'pubdesk_gas_token'
};

const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbznI3Q4IqjG1T3BvduLlymBJUaMaNdDNjj4OF9krkfjUsXIvAamD8emMcZedwd5El0e2g/exec';
const DEFAULT_TOKEN = 'PubDesk_Secret_Token_2026';

let cachedUrl = DEFAULT_URL;
let cachedToken = DEFAULT_TOKEN;
let isInitialized = false;

/**
 * Konversi byte array ke Base64 string secara efisien
 */
function bytesToBase64(bytes: number[] | Uint8Array): string {
  let binary = '';
  const len = bytes.length;
  const CHUNK_SIZE = 0x8000; // 32768 bytes per chunk
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = uint8.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return window.btoa(binary);
}

/**
 * Parse response dari GAS dengan validasi — mencegah error "<" token
 * jika GAS mengembalikan HTML (redirect/error page) alih-alih JSON
 */
function parseGasResponse(responseText: string): any {
  const trimmed = responseText.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    console.error('[GAS] Response bukan JSON:', trimmed.substring(0, 500));

    // Ekstrak pesan kesalahan dari HTML GAS
    let cleanMessage = '';
    if (trimmed.includes('<body') || trimmed.includes('<html')) {
      let bodyText = trimmed
        .replace(/<head>[\s\S]*?<\/head>/gi, '')
        .replace(/<style>[\s\S]*?<\/style>/gi, '')
        .replace(/<script>[\s\S]*?<\/script>/gi, '');
      
      bodyText = bodyText.replace(/<[^>]*>/g, ' ');
      bodyText = bodyText.replace(/\s+/g, ' ').trim();

      if (bodyText.includes('Pengecualian')) {
        const idx = bodyText.indexOf('Pengecualian');
        cleanMessage = bodyText.substring(idx, idx + 250);
      } else if (bodyText.includes('Exception')) {
        const idx = bodyText.indexOf('Exception');
        cleanMessage = bodyText.substring(idx, idx + 250);
      } else if (bodyText.includes('Error')) {
        const idx = bodyText.indexOf('Error');
        cleanMessage = bodyText.substring(idx, idx + 250);
      } else {
        cleanMessage = bodyText.substring(0, 200);
      }
    }

    const errorDetails = cleanMessage 
      ? `Detail: "${cleanMessage}"`
      : `Respons: "${trimmed.substring(0, 150)}..."`;

    throw new Error(
      `Gagal terhubung ke Google Apps Script (Bukan JSON). ${errorDetails}`
    );
  }
  return JSON.parse(trimmed);
}

export const googleAppsScriptService = {
  /**
   * Menginisialisasi setelan dari database lokal SQLite
   */
  async initSettings() {
    if (isInitialized) return { url: cachedUrl, token: cachedToken };

    try {
      const raw = await invoke<string>('get_sync_config_full');
      const config = JSON.parse(raw);
      
      const savedUrl = (config.gas_url || '').trim();
      const savedToken = (config.gas_token || '').trim();

      if (savedUrl) {
        cachedUrl = savedUrl;
        cachedToken = savedToken || DEFAULT_TOKEN;
      } else {
        // Jika kosong di database, gunakan default dan simpan ke database
        cachedUrl = DEFAULT_URL;
        cachedToken = DEFAULT_TOKEN;
        
        await invoke('set_sync_config', {
          syncMethod: 'gas',
          workerUrl: '',
          gasUrl: DEFAULT_URL,
          gasToken: DEFAULT_TOKEN
        });
      }
    } catch (err) {
      console.warn('[GAS] Gagal membaca konfigurasi dari database lokal, menggunakan localStorage/default:', err);
      // Fallback ke localStorage
      const localUrl = localStorage.getItem(STORAGE_KEYS.URL);
      const localToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
      
      cachedUrl = localUrl ? localUrl.trim() : DEFAULT_URL;
      cachedToken = localToken ? localToken.trim() : DEFAULT_TOKEN;
    }

    isInitialized = true;
    return { url: cachedUrl, token: cachedToken };
  },

  /**
   * Mendapatkan konfigurasi URL dan Token dari cache memori
   */
  getSettings() {
    return { url: cachedUrl, token: cachedToken };
  },

  /**
   * Menyimpan konfigurasi URL dan Token ke cache, SQLite local db, dan localStorage
   */
  async saveSettings(url: string, token: string, uploadToCloud = true) {
    const trimmedUrl = url.trim();
    const trimmedToken = token.trim();
    
    cachedUrl = trimmedUrl;
    cachedToken = trimmedToken;
    isInitialized = true;

    localStorage.setItem(STORAGE_KEYS.URL, trimmedUrl);
    localStorage.setItem(STORAGE_KEYS.TOKEN, trimmedToken);

    try {
      await invoke('set_sync_config', {
        syncMethod: 'gas',
        workerUrl: '',
        gasUrl: trimmedUrl,
        gasToken: trimmedToken
      });
    } catch (err) {
      console.error('[GAS] Gagal menyimpan ke database lokal SQLite:', err);
    }

    if (uploadToCloud && trimmedUrl) {
      try {
        await this.upsertRecordsToCloud('AppConfig', [
          { key: 'gas_url', value: trimmedUrl, updated_at: new Date().toISOString() },
          { key: 'gas_token', value: trimmedToken, updated_at: new Date().toISOString() }
        ]);
        console.log('[GAS] Konfigurasi berhasil di-backup ke spreadsheet.');
      } catch (err) {
        console.error('[GAS] Gagal membackup konfigurasi ke spreadsheet:', err);
      }
    }
  },

  /**
   * Menyelaraskan konfigurasi dari cloud (spreadsheet)
   */
  async syncConfigFromCloud() {
    let records: any[] = [];
    try {
      records = await this.getRecordsFromCloud('AppConfig');
    } catch (err) {
      console.warn('[GAS] Gagal mengambil konfigurasi cloud dengan URL aktif, mencoba default...', err);
      if (cachedUrl !== DEFAULT_URL) {
        const originalUrl = cachedUrl;
        const originalToken = cachedToken;

        cachedUrl = DEFAULT_URL;
        cachedToken = DEFAULT_TOKEN;

        try {
          records = await this.getRecordsFromCloud('AppConfig');
        } catch (errDefault) {
          cachedUrl = originalUrl;
          cachedToken = originalToken;
          console.error('[GAS] Gagal mengambil konfigurasi cloud dari URL default:', errDefault);
          return;
        }
      } else {
        console.error('[GAS] Gagal mengambil konfigurasi cloud:', err);
        return;
      }
    }

    if (records && records.length > 0) {
      const urlRecord = records.find(r => r.key === 'gas_url');
      const tokenRecord = records.find(r => r.key === 'gas_token');
      
      if (urlRecord || tokenRecord) {
        const newUrl = urlRecord ? urlRecord.value.trim() : cachedUrl;
        const newToken = tokenRecord ? tokenRecord.value.trim() : cachedToken;
        
        if (newUrl !== cachedUrl || newToken !== cachedToken) {
          console.log('[GAS] Menemukan kredensial baru dari cloud spreadsheet. Mengupdate lokal...');
          await this.saveSettings(newUrl, newToken, false);
        }
      }
    }
  },

  /**
   * Mengecek apakah konfigurasi URL sudah terisi
   */
  isConfigured(): boolean {
    const { url } = this.getSettings();
    return url.length > 0;
  },

  /**
   * Mengirim data Invoice beserta berkas PDF fisiknya ke Google Apps Script
   */
  async sendInvoiceToCloud(
    invoiceData: GASInvoicePayload,
    pdfBytes: number[] | Uint8Array,
    fileName?: string
  ) {
    const { url, token } = this.getSettings();
    if (!url) {
      throw new Error('URL Web App Google Apps Script belum dikonfigurasi di Setelan.');
    }

    // Konversi file biner ke format base64
    let fileBase64 = '';
    if (pdfBytes && pdfBytes.length > 0) {
      fileBase64 = bytesToBase64(pdfBytes);
    }

    const payload = {
      auth_token: token,
      action: 'create_invoice',
      ...invoiceData,
      file_base_64: fileBase64,
      file_name: fileName || `Invoice-${invoiceData.invoice_no?.replace(/\//g, '_') || 'DRAF'}.pdf`,
      file_mime_type: 'application/pdf'
    };

    // Melakukan request native menggunakan Rust backend (Bebas dari CORS block!)
    const responseText = await invoke<string>('call_gas_api', {
      url,
      method: 'POST',
      payloadJson: JSON.stringify(payload)
    });

    const result = parseGasResponse(responseText);
    if (result.status === 'error') {
      throw new Error(result.message || 'Terjadi kesalahan dari Google Apps Script');
    }

    return {
      success: true,
      invoiceNo: result.invoice_no,
      fileUrl: result.file_url
    };
  },

  /**
   * Mengambil data list invoice yang tercatat di Google Sheets
   */
  async getInvoicesFromCloud() {
    return this.getRecordsFromCloud('Invoices');
  },

  /**
   * Mengirim batch records ke Google Sheets secara bulk
   */
  async upsertRecordsToCloud(sheetName: string, records: any[]) {
    const { url, token } = this.getSettings();
    if (!url) {
      throw new Error('URL Web App Google Apps Script belum dikonfigurasi.');
    }

    const payload = {
      auth_token: token,
      action: 'upsert_records',
      sheet_name: sheetName,
      records: records
    };

    const responseText = await invoke<string>('call_gas_api', {
      url,
      method: 'POST',
      payloadJson: JSON.stringify(payload)
    });

    const result = parseGasResponse(responseText);
    if (result.status === 'error') {
      throw new Error(result.message || 'Terjadi kesalahan dari Google Apps Script');
    }

    return {
      success: true,
      message: result.message
    };
  },

  /**
   * Mengambil data seluruh baris dari sheet tertentu di Google Sheets
   */
  async getRecordsFromCloud(sheetName: string) {
    const { url, token } = this.getSettings();
    if (!url) {
      throw new Error('URL Web App Google Apps Script belum dikonfigurasi.');
    }

    const requestUrl = `${url}?auth_token=${encodeURIComponent(token)}&action=get_records&sheet_name=${encodeURIComponent(sheetName)}`;

    const responseText = await invoke<string>('call_gas_api', {
      url: requestUrl,
      method: 'GET',
      payloadJson: null
    });

    const data = parseGasResponse(responseText);
    if (data && data.status === 'error') {
      throw new Error(data.message || 'Terjadi kesalahan dari Google Apps Script');
    }

    return data as Array<Record<string, any>>;
  },

  /**
   * Menghapus record tertentu berdasarkan ID di Google Sheets
   */
  async deleteRecordFromCloud(sheetName: string, id: number) {
    const { url, token } = this.getSettings();
    if (!url) {
      throw new Error('URL Web App Google Apps Script belum dikonfigurasi.');
    }

    const payload = {
      auth_token: token,
      action: 'delete_record',
      sheet_name: sheetName,
      id: id
    };

    const responseText = await invoke<string>('call_gas_api', {
      url,
      method: 'POST',
      payloadJson: JSON.stringify(payload)
    });

    const result = parseGasResponse(responseText);
    if (result.status === 'error') {
      throw new Error(result.message || 'Terjadi kesalahan dari Google Apps Script');
    }

    return {
      success: true,
      message: result.message
    };
  },

  /**
   * Mereset/mengosongkan seluruh tabel data di Google Sheets (menyisakan baris header)
   */
  async clearDatabaseOnCloud() {
    const { url, token } = this.getSettings();
    if (!url) {
      throw new Error('URL Web App Google Apps Script belum dikonfigurasi.');
    }

    const payload = {
      auth_token: token,
      action: 'clear_database'
    };

    const responseText = await invoke<string>('call_gas_api', {
      url,
      method: 'POST',
      payloadJson: JSON.stringify(payload)
    });

    const result = parseGasResponse(responseText);
    if (result.status === 'error') {
      throw new Error(result.message || 'Terjadi kesalahan dari Google Apps Script');
    }

    return {
      success: true,
      message: result.message
    };
  },

  /**
   * Mengunggah file biner (Base64) ke Google Drive
   */
  async uploadFileToCloud(fileName: string, fileBase64: string, subfolder: string, mimeType: string) {
    const { url, token } = this.getSettings();
    if (!url) {
      throw new Error('URL Web App Google Apps Script belum dikonfigurasi.');
    }

    const payload = {
      auth_token: token,
      action: 'upload_file',
      file_name: fileName,
      file_base_64: fileBase64,
      subfolder: subfolder,
      file_mime_type: mimeType
    };

    const responseText = await invoke<string>('call_gas_api', {
      url,
      method: 'POST',
      payloadJson: JSON.stringify(payload)
    });

    const result = parseGasResponse(responseText);
    if (result.status === 'error') {
      throw new Error(result.message || 'Terjadi kesalahan dari Google Apps Script');
    }

    return {
      success: true,
      file_url: result.file_url,
      file_id: result.file_id
    };
  }
};
