/**
 * PubDesk - Google Apps Script Backend v2 (Multi-Sheet & Drive Subfolder)
 * 
 * Cara Penggunaan:
 * 1. Buka Google Sheets Anda.
 * 2. Klik Ekstensi -> Apps Script.
 * 3. Hapus kode bawaan, lalu salin dan tempel seluruh kode di bawah ini.
 * 4. Atur Token Keamanan Anda di Menu Setelan Proyek -> Properti Proyek (Project Properties):
 *    - Tambahkan Properti Baru:
 *      Nama Properti: AUTH_TOKEN
 *      Nilai: TokenRahasiaAnda (Ganti dengan token acak pilihan Anda)
 * 5. Klik Deploy -> Deployment Baru (New Deployment).
 * 6. Pilih Jenis: Aplikasi Web (Web App).
 * 7. Setel Pengaturan:
 *    - Jalankan Sebagai: Saya (Email Anda)
 *    - Siapa yang memiliki akses: Siapa saja (Anyone)
 * 8. Klik Deploy, berikan izin akses Google Drive & Sheets jika diminta, lalu salin URL Web App yang dihasilkan.
 */

const PARENT_FOLDER_NAME = "PubDesk Cloud Storage";
const DEFAULT_TOKEN = "PubDesk_Secret_Token_2026";

// Definisi Struktur Kolom untuk Semua Sheet (21 Tabel Lengkap)
const SHEETS_CONFIG = {
  "Contacts": [
    "id", "name", "wa_number", "email", "address", "province", "city", "job", "institution", "data_source", "email_valid", "wa_valid", "followup_status", "notes", "type", "created_at", "updated_at"
  ],
  "Books": [
    "id", "title", "isbn", "regular_price", "po_price", "weight_grams", "author_id", "cover_path", "created_at", "updated_at"
  ],
  "Projects": [
    "id", "title", "book_id", "status", "deadline", "created_at", "updated_at"
  ],
  "Files": [
    "id", "path", "filename", "type", "project_id", "status", "version_label", "last_modified", "modified_by", "is_readonly", "description", "responsible_parties", "created_at", "updated_at"
  ],
  "Tags": [
    "id", "name", "created_at", "updated_at"
  ],
  "FileTags": [
    "file_id", "tag_id"
  ],
  "Invoices": [
    "id", "created_at", "customer_id", "items_json", "shipping_cost", "admin_fee", "total", "export_format", "file_path", "naskah_id", "payment_status", "paid_amount", "remaining_amount", "payment_notes", "cloud_file_url", "updated_at"
  ],
  "Services": [
    "id", "name", "price", "description", "category", "created_at", "updated_at"
  ],
  "FileEntities": [
    "id", "file_id", "entity_type", "entity_value"
  ],
  "FileRelations": [
    "id", "source_file_id", "target_file_id", "relation_type", "confidence"
  ],
  "FileStats": [
    "file_id", "access_count", "last_accessed", "active_project_boost"
  ],
  "Penerbit": [
    "id", "name", "city", "instagram", "facebook", "email", "wa_number", "linkedin", "twitter", "tiktok", "wa_valid", "email_valid", "cooperation_status", "address", "notes", "province", "created_at", "updated_at"
  ],
  "Naskah": [
    "id", "naskah_id_code", "title", "penulis_id", "penerbit_id", "package_type", "order_type", "copies", "book_size", "initial_request", "revised_request", "legal_type", "shipping_address", "store_links", "status", "genre", "total_pages", "synopsis", "assigned_team_ids", "created_at", "updated_at"
  ],
  "Tim": [
    "id", "name", "role", "is_active", "weekly_target", "notes", "department", "pin", "created_at", "updated_at"
  ],
  "Tasks": [
    "id", "naskah_id", "step_name", "step_order", "assigned_team_id", "status", "priority", "start_date", "due_date", "completed_date", "notes", "proof_path_or_link", "created_at", "updated_at"
  ],
  "TaskHistory": [
    "id", "task_id", "old_status", "new_status", "changed_by", "changed_at", "notes"
  ],
  "TaskBlockers": [
    "id", "task_id", "naskah_id", "blocker_type", "description", "status", "created_at", "resolved_at"
  ],
  "TaskApprovals": [
    "id", "task_id", "approval_type", "status", "requested_at", "decided_at", "decided_by", "notes"
  ],
  "NaskahFiles": [
    "id", "naskah_id", "file_id", "file_role", "notes", "created_at"
  ],
  "CetakDistribusi": [
    "id", "naskah_id", "acc_cetak_date", "naik_cetak_date", "jumlah_cetak", "status_cetak", "link_playbook", "link_shopee", "link_omp", "ekspedisi", "resi", "tanggal_kirim", "status_kirim", "notes", "created_at", "updated_at"
  ],
  "Legalitas": [
    "id", "naskah_id", "judul_buku", "nama_penulis", "tipe", "tanggal_pengajuan", "keterangan", "status", "nomor_dokumen", "tanggal_keluar", "tanggal_revisi", "pic_id", "rejection_reason", "proof_path_or_link", "created_at", "updated_at"
  ],
  "AppConfig": [
    "key", "value", "updated_at"
  ]
};

function isValidToken(token) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const configuredToken = scriptProperties.getProperty("AUTH_TOKEN") || DEFAULT_TOKEN;
  return token === configuredToken;
}

/**
 * Mendapatkan folder berdasarkan hierarki induk dan subfolder
 */
function getOrCreateFolder(subfolderName) {
  const parentFolders = DriveApp.getFoldersByName(PARENT_FOLDER_NAME);
  let parentFolder = parentFolders.hasNext() ? parentFolders.next() : DriveApp.createFolder(PARENT_FOLDER_NAME);
  
  if (!subfolderName) return parentFolder;
  
  const subFolders = parentFolder.getFoldersByName(subfolderName);
  return subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(subfolderName);
}

/**
 * Menginisialisasi Lembar Kerja secara Dinamis berdasarkan konfigurasi
 */
function initSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    if (!SHEETS_CONFIG[sheetName]) {
      throw new Error("Konfigurasi tabel '" + sheetName + "' tidak ditemukan.");
    }
    sheet = ss.insertSheet(sheetName);
    const headers = SHEETS_CONFIG[sheetName];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else {
    // Migrasi skema otomatis jika ada kolom baru di SHEETS_CONFIG
    const configHeaders = SHEETS_CONFIG[sheetName];
    if (configHeaders) {
      const lastCol = sheet.getLastColumn();
      const actualHeaders = lastCol > 0 
        ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
        : [];
      const missingHeaders = configHeaders.filter(h => actualHeaders.indexOf(h) === -1);
      if (missingHeaders.length > 0) {
        const startCol = actualHeaders.length + 1;
        sheet.getRange(1, startCol, 1, missingHeaders.length)
          .setValues([missingHeaders])
          .setFontWeight("bold");
      }
    }
  }
  return sheet;
}

/**
 * Endpoint GET: Membaca data
 */
function doGet(e) {
  try {
    const token = e.parameter.auth_token;
    const action = e.parameter.action;
    const sheetName = e.parameter.sheet_name;

    if (!isValidToken(token)) {
      return createJsonResponse({ status: "error", message: "Token tidak valid" }, 401);
    }

    if (action === "get_records" || action === "get_invoices") {
      const targetSheet = sheetName || "Invoices";
      const sheet = initSheet(targetSheet);
      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return createJsonResponse([]);

      const headers = values[0];
      const records = values.slice(1).map(row => {
        let obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] === "" ? null : row[i];
        });
        return obj;
      });

      return createJsonResponse(records);
    }

    return createJsonResponse({ status: "error", message: "Aksi GET tidak dikenali" }, 400);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

/**
 * Endpoint POST: Menyimpan, memperbarui, mengunggah berkas, atau menghapus data
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // 30 detik timeout

    const payload = JSON.parse(e.postData.contents);
    const token = payload.auth_token;
    const action = payload.action;

    if (!isValidToken(token)) {
      return createJsonResponse({ status: "error", message: "Token tidak valid" }, 401);
    }

    // 1. Unggah berkas ke Google Drive (jika ada file_base64)
    if (action === "upload_file") {
      const fileData = payload.file_base64 || payload.file_base_64;
      if (!fileData) throw new Error("Data 'file_base64' kosong");
      
      const subfolder = payload.subfolder || "General";
      const folder = getOrCreateFolder(subfolder);
      const decodedBytes = Utilities.base64Decode(fileData);
      const blob = Utilities.newBlob(decodedBytes, payload.file_mime_type || "application/octet-stream", payload.file_name || "file");
      
      const file = folder.createFile(blob);
      return createJsonResponse({
        status: "success",
        file_url: file.getUrl(),
        file_id: file.getId()
      });
    }

    // 2. Operasi Upsert (Bulk/Single)
    if (action === "upsert_records") {
      const sheetName = payload.sheet_name;
      const records = payload.records; // Array berisi objek record data
      
      if (!sheetName || !records || !Array.isArray(records)) {
        throw new Error("Parameter 'sheet_name' dan 'records' (array) wajib diisi");
      }

      const sheet = initSheet(sheetName);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // Ambil index kolom pencocok unik (biasanya 'id', jika 'FileTags' gunakan composite key atau 'file_id' + 'tag_id')
      let idColIndex = headers.indexOf("id");
      let fileIdColIndex = headers.indexOf("file_id");
      let tagIdColIndex = headers.indexOf("tag_id");
      
      const isFileTags = sheetName === "FileTags";

      // Petakan ID yang sudah ada ke nomor baris di spreadsheet
      const existingIdsMap = {};
      for (let i = 1; i < values.length; i++) {
        if (isFileTags) {
          const key = values[i][fileIdColIndex] + "_" + values[i][tagIdColIndex];
          existingIdsMap[key] = i + 1;
        } else if (idColIndex !== -1) {
          const idVal = values[i][idColIndex];
          if (idVal !== "") {
            existingIdsMap[idVal] = i + 1; // 1-indexed spreadsheet row
          }
        }
      }

      records.forEach(rec => {
        const rowData = headers.map(h => {
          let val = rec[h];
          if (val === undefined || val === null) return "";
          if (typeof val === "object") return JSON.stringify(val);
          return val;
        });

        if (isFileTags) {
          const key = rec["file_id"] + "_" + rec["tag_id"];
          if (existingIdsMap[key]) {
            const rowNum = existingIdsMap[key];
            sheet.getRange(rowNum, 1, 1, headers.length).setValues([rowData]);
          } else {
            sheet.appendRow(rowData);
            existingIdsMap[key] = sheet.getLastRow();
          }
        } else if (idColIndex !== -1) {
          const id = rec["id"];
          if (id && existingIdsMap[id]) {
            // UPDATE baris yang sudah ada
            const rowNum = existingIdsMap[id];
            sheet.getRange(rowNum, 1, 1, headers.length).setValues([rowData]);
          } else {
            // INSERT baris baru
            sheet.appendRow(rowData);
            // Update map agar mencegah duplikasi di dalam batch yang sama
            if (id) {
              existingIdsMap[id] = sheet.getLastRow();
            }
          }
        }
      });

      return createJsonResponse({ status: "success", message: records.length + " record berhasil disinkronkan." });
    }

    // 3. Operasi Delete Record
    if (action === "delete_record") {
      const sheetName = payload.sheet_name;
      const id = payload.id;
      if (!sheetName || id === undefined) throw new Error("Parameter 'sheet_name' dan 'id' wajib diisi");

      const sheet = initSheet(sheetName);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const values = sheet.getDataRange().getValues();
      const idColIndex = headers.indexOf("id");

      for (let i = 1; i < values.length; i++) {
        if (values[i][idColIndex] == id) {
          sheet.deleteRow(i + 1);
          return createJsonResponse({ status: "success", message: "Record dengan ID " + id + " berhasil dihapus." });
        }
      }
      return createJsonResponse({ status: "error", message: "Record tidak ditemukan." }, 404);
    }

    // 4. Reset Database Spreadsheet (Cloud)
    if (action === "clear_database") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetNames = Object.keys(SHEETS_CONFIG);
      let resetCount = 0;

      sheetNames.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          const lastRow = sheet.getLastRow();
          if (lastRow > 1) {
            sheet.deleteRows(2, lastRow - 1);
            resetCount++;
          }
        }
      });

      return createJsonResponse({
        status: "success",
        message: "Berhasil mereset database spreadsheet. Sebanyak " + resetCount + " tabel dibersihkan."
      });
    }

    // 5. Operasi Create Invoice (Kompatibilitas Versi Lama)
    if (action === "create_invoice") {
      let fileUrl = "";
      let fileId = "";
      
      // Unggah berkas ke Google Drive (jika ada file_base_64)
      if (payload.file_base_64) {
        const subfolder = "Invoices";
        const folder = getOrCreateFolder(subfolder);
        const decodedBytes = Utilities.base64Decode(payload.file_base_64);
        const blob = Utilities.newBlob(decodedBytes, payload.file_mime_type || "application/pdf", payload.file_name || "Invoice.pdf");
        const file = folder.createFile(blob);
        fileUrl = file.getUrl();
        fileId = file.getId();
      }

      // Simpan data ke sheet Invoices
      const sheet = initSheet("Invoices");
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      const idColIndex = headers.indexOf("id");

      // Cari apakah invoice dengan no_invoice / id yang sama sudah ada
      const targetId = payload.invoice_no || payload.id || "";
      let existingRow = -1;

      if (targetId && idColIndex !== -1) {
        for (let i = 1; i < values.length; i++) {
          if (values[i][idColIndex] == targetId) {
            existingRow = i + 1;
            break;
          }
        }
      }

      // Petakan payload ke kolom sheet Invoices
      const rec = {
        id: targetId,
        created_at: payload.tanggal || new Date().toISOString(),
        customer_id: payload.pelanggan || "",
        items_json: payload.items ? JSON.stringify(payload.items) : "[]",
        shipping_cost: payload.shipping_cost || 0,
        admin_fee: payload.admin_fee || 0,
        total: payload.total || 0,
        export_format: "PDF",
        file_path: payload.file_name || "",
        cloud_file_url: fileUrl,
        updated_at: new Date().toISOString()
      };

      const rowData = headers.map(h => {
        let val = rec[h];
        if (val === undefined || val === null) return "";
        return val;
      });

      if (existingRow !== -1) {
        sheet.getRange(existingRow, 1, 1, headers.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }

      return createJsonResponse({
        status: "success",
        message: "Invoice berhasil disimpan ke Cloud",
        invoice_no: targetId,
        file_url: fileUrl,
        file_id: fileId
      });
    }

    // 5. Operasi pull_changes: Mengunduh data dari Cloud ke PC Lokal
    if (action === "pull_changes") {
      const sheetNameMap = {
        "Contacts": "contacts",
        "Books": "books",
        "Projects": "projects",
        "Files": "files",
        "Invoices": "invoices",
        "Services": "services",
        "Penerbit": "penerbit",
        "Naskah": "naskah",
        "Tim": "tim",
        "Tasks": "tasks",
        "Legalitas": "legalitas",
        "CetakDistribusi": "cetak_distribusi",
        "AppConfig": "app_config"
      };

      const changes = [];
      const ss = SpreadsheetApp.getActiveSpreadsheet();

      Object.keys(SHEETS_CONFIG).forEach(function(sheetName) {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return;
        const values = sheet.getDataRange().getValues();
        if (values.length <= 1) return;

        const headers = values[0];
        const tableName = sheetNameMap[sheetName] || sheetName.toLowerCase();

        for (var r = 1; r < values.length; r++) {
          var row = values[r];
          var obj = {};
          headers.forEach(function(h, i) {
            if (row[i] !== "" && row[i] !== null && row[i] !== undefined) {
              obj[h] = row[i];
            }
          });
          if (!obj.id && !obj.key) continue;

          changes.push({
            table_name: tableName,
            row_id: Number(obj.id) || 0,
            action: "UPSERT",
            data_json: JSON.stringify(obj),
            created_at: obj.created_at || new Date().toISOString()
          });
        }
      });

      return createJsonResponse({
        status: "success",
        changes: changes
      });
    }

    return createJsonResponse({ status: "error", message: "Aksi POST tidak dikenali" }, 400);

  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, 500);
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
