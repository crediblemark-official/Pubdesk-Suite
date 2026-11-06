use serde::{Deserialize, Serialize};
use rusqlite::params;
use crate::db::Connection;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncChange {
    pub table_name: String,
    pub row_id: i64,
    pub action: String,
    pub data_json: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct SyncRuntimeConfig {
    pub enabled: bool,
    pub workspace_id: Option<String>,
    pub device_id: Option<String>,
    pub gas_url: Option<String>,
    pub gas_token: Option<String>,
    pub last_push_ts: u64,
    pub last_pull_ts: u64,
}

impl SyncRuntimeConfig {
    pub fn load(conn: &Connection) -> Self {
        let get = |key: &str| -> Option<String> {
            conn.query_row("SELECT value FROM p2p_config WHERE key = ?1", params![key], |row| row.get(0)).ok()
        };
        let device_id = conn.query_row("SELECT value FROM sync_meta WHERE key = 'device_id'", params![], |row| row.get(0)).ok();
        Self {
            enabled: get("sync_enabled").map(|v| v == "true").unwrap_or(false),
            workspace_id: get("sync_workspace_id"),
            device_id,
            gas_url: get("sync_gas_url"),
            gas_token: get("sync_gas_token"),
            last_push_ts: get("sync_last_push_ts").and_then(|v| v.parse().ok()).unwrap_or(0),
            last_pull_ts: get("sync_last_pull_ts").and_then(|v| v.parse().ok()).unwrap_or(0),
        }
    }

    pub fn is_ready(&self) -> bool {
        self.enabled && self.gas_url.as_ref().map(|u| !u.trim().is_empty()).unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub pushed: usize,
    pub pulled: usize,
    pub error: Option<String>,
}

/// Step 1: Baca outbox + config (hold lock brief)
pub fn sync_read_outbox(conn: &Connection) -> Result<(Vec<SyncChange>, Vec<i64>), String> {
    let mut stmt = conn.prepare(
        "SELECT id, table_name, row_id, action, data_json, created_at FROM sync_outbox WHERE sent_at IS NULL ORDER BY id ASC LIMIT 200"
    ).map_err(|e| e.to_string())?;

    let col_map = build_col_map(&stmt);

    let rows = stmt.query_map([], |row| {
        let change = SyncChange {
            table_name: col_text(row, &col_map, "table_name"),
            row_id: col_int(row, &col_map, "row_id"),
            action: col_text(row, &col_map, "action"),
            data_json: col_text_opt(row, &col_map, "data_json"),
            created_at: col_text(row, &col_map, "created_at"),
        };
        let outbox_id = col_int(row, &col_map, "id");
        Ok((change, outbox_id))
    }).map_err(|e| e.to_string())?;

    let mut changes = Vec::new();
    let mut ids = Vec::new();
    for row in rows {
        let (mut change, outbox_id) = row.map_err(|e| e.to_string())?;
        if change.data_json.is_none() {
            change = fill_data_json(conn, &change);
        }
        ids.push(outbox_id);
        changes.push(change);
    }
    Ok((changes, ids))
}

/// Step 2: Push ke GAS via HTTP (no DB lock)
pub async fn sync_push_to_gas(changes: Vec<SyncChange>, config: &SyncRuntimeConfig) -> Result<usize, String> {
    if changes.is_empty() { return Ok(0); }
    let count = changes.len();
    let gas_url = config.gas_url.as_deref().unwrap_or("");
    let token_raw = config.gas_token.as_deref().unwrap_or("");
    let token = if token_raw.trim().is_empty() { "PubDesk_Secret_Token_2026" } else { token_raw.trim() };

    let body = serde_json::json!({
        "action": "push_changes", "auth_token": token,
        "workspace_id": config.workspace_id, "device_id": config.device_id,
        "changes": changes,
    });

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()
        .map_err(|e| format!("client: {}", e))?;
    let resp = client.post(gas_url).header("Content-Type", "application/json").json(&body).send().await
        .map_err(|e| format!("GAS push: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("GAS push HTTP {}", resp.status()));
    }
    Ok(count)
}

/// Step 3: Tandai outbox sebagai sent (re-acquire lock)
pub fn sync_mark_sent(conn: &Connection, ids: &[i64]) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    for id in ids {
        let _ = conn.execute("UPDATE sync_outbox SET sent_at = ?1 WHERE id = ?2", params![now, *id]);
    }
    let ts = chrono::Utc::now().timestamp().to_string();
    let _ = conn.execute("INSERT OR REPLACE INTO p2p_config (key, value) VALUES ('sync_last_push_ts', ?1)", params![ts]);
    Ok(())
}

/// Step 6: Pull dari GAS (HTTP only, no DB lock)
pub async fn sync_pull_from_gas(config: &SyncRuntimeConfig) -> Result<Vec<SyncChange>, String> {
    let gas_url = config.gas_url.as_deref().unwrap_or("");
    let token_raw = config.gas_token.as_deref().unwrap_or("");
    let token = if token_raw.trim().is_empty() { "PubDesk_Secret_Token_2026" } else { token_raw.trim() };

    let body = serde_json::json!({
        "action": "pull_changes", "auth_token": token,
        "workspace_id": config.workspace_id, "device_id": config.device_id,
        "since": config.last_pull_ts.to_string(),
    });

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build()
        .map_err(|e| format!("client: {}", e))?;
    let resp = client.post(gas_url).header("Content-Type", "application/json").json(&body).send().await
        .map_err(|e| format!("GAS pull: {}", e))?;
    let text = resp.text().await.map_err(|e| format!("GAS read: {}", e))?;
    let data: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("GAS parse: {} body={}", e, &text[..text.len().min(200)]))?;

    let arr = match data.get("changes").and_then(|c| c.as_array()) {
        Some(a) => a, None => return Ok(Vec::new()),
    };

    let mut changes = Vec::new();
    for val in arr {
        let data_json = match val.get("data_json") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(v) => Some(v.to_string()),
            None => None,
        };
        changes.push(SyncChange {
            table_name: val["table_name"].as_str().unwrap_or("").to_string(),
            row_id: val["row_id"].as_i64().unwrap_or(0),
            action: val["action"].as_str().unwrap_or("").to_string(),
            data_json,
            created_at: val["created_at"].as_str().unwrap_or("").to_string(),
        });
    }
    Ok(changes)
}

/// Step 7: Apply remote changes ke local DB (re-acquire lock)
pub fn sync_apply_remote(conn: &Connection, changes: &[SyncChange]) -> Result<usize, String> {
    conn.execute("INSERT OR IGNORE INTO _sync_skip (val) VALUES (1)", []).ok();
    // Nonaktifkan foreign keys sementara agar urutan kedatangan data antar tabel tidak memblokir import
    let _ = conn.execute("PRAGMA foreign_keys = OFF;", []);

    let mut total = 0;
    for change in changes {
        if change.table_name.is_empty() { continue; }
        apply_remote_change(conn, change);
        total += 1;
    }

    conn.execute("DELETE FROM _sync_skip", []).ok();
    let _ = conn.execute("PRAGMA foreign_keys = ON;", []);

    let ts = chrono::Utc::now().timestamp().to_string();
    let _ = conn.execute("INSERT OR REPLACE INTO p2p_config (key, value) VALUES ('sync_last_pull_ts', ?1)", params![ts]);
    Ok(total)
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

fn fill_data_json(conn: &Connection, change: &SyncChange) -> SyncChange {
    let json = match change.action.as_str() {
        "DELETE" => None,
        _ => read_row_json(conn, &change.table_name, change.row_id),
    };
    SyncChange { data_json: json, ..change.clone() }
}

fn read_row_json(conn: &Connection, table: &str, row_id: i64) -> Option<String> {
    let sql = format!("SELECT * FROM {} WHERE id = ?1 LIMIT 1", table);
    let mut stmt = conn.prepare(&sql).ok()?;
    let cnt = stmt.column_count();
    let mut cols = Vec::new();
    for i in 0..cnt {
        if let Ok(n) = stmt.column_name(i) { cols.push(n.to_string()); }
    }
    stmt.query_row(params![row_id], |row| {
        let mut map = serde_json::Map::new();
        for (i, col) in cols.iter().enumerate() {
            let val = match row.get_ref(i) {
                Ok(rusqlite::types::ValueRef::Null) => None,
                Ok(rusqlite::types::ValueRef::Integer(n)) => Some(serde_json::Value::Number(n.into())),
                Ok(rusqlite::types::ValueRef::Real(f)) => {
                    serde_json::Number::from_f64(f).map(serde_json::Value::Number)
                }
                Ok(rusqlite::types::ValueRef::Text(t)) => {
                    Some(serde_json::Value::String(String::from_utf8_lossy(t).to_string()))
                }
                Ok(rusqlite::types::ValueRef::Blob(_)) => None,
                Err(_) => None,
            };
            if let Some(v) = val { map.insert(col.clone(), v); }
        }
        Ok(serde_json::Value::Object(map))
    }).ok().map(|v| v.to_string())
}

fn apply_remote_change(conn: &Connection, change: &SyncChange) {
    match change.action.to_uppercase().as_str() {
        "DELETE" => {
            let sql = format!("DELETE FROM {} WHERE id = ?1", change.table_name);
            let _ = conn.execute(&sql, params![change.row_id]);
        }
        "INSERT" | "UPDATE" | "UPSERT" => {
            if let Some(ref json) = change.data_json {
                apply_upsert(conn, &change.table_name, change.row_id, json);
            }
        }
        _ => {
            if let Some(ref json) = change.data_json {
                apply_upsert(conn, &change.table_name, change.row_id, json);
            }
        }
    }
}

fn apply_upsert(conn: &Connection, table: &str, _row_id: i64, data_json: &str) {
    let mut data: serde_json::Value = match serde_json::from_str(data_json) { Ok(v) => v, Err(_) => return };
    if let serde_json::Value::String(ref s) = data {
        if let Ok(nested) = serde_json::from_str::<serde_json::Value>(s) {
            data = nested;
        }
    }
    let mut obj = match data.as_object() { Some(o) => o.clone(), None => return };

    if table == "app_config" || table == "p2p_config" {
        let key = obj.get("key").and_then(|k| k.as_str()).unwrap_or("");
        let val = obj.get("value").and_then(|v| v.as_str()).unwrap_or("");
        if !key.is_empty() {
            let config_key = match key {
                "gas_url" => "sync_gas_url",
                "gas_token" => "sync_gas_token",
                "hide_sync_menu_in_other_apps" => "hide_sync_menu_in_other_apps",
                "sync_gas_url" => "sync_gas_url",
                "sync_gas_token" => "sync_gas_token",
                other => other,
            };
            let _ = conn.execute(
                "INSERT OR REPLACE INTO p2p_config (key, value) VALUES (?1, ?2)",
                rusqlite::params![config_key, val]
            );
        }
        return;
    }

    // Normalisasi khusus tabel invoices
    if table == "invoices" {
        // A. Handle invoiceNo dan id
        let raw_id = obj.get("id");
        let invoice_no_str = if let Some(serde_json::Value::String(s)) = raw_id {
            if s.parse::<i64>().is_err() {
                Some(s.clone())
            } else {
                None
            }
        } else {
            None
        };

        if let Some(ref inv_no) = invoice_no_str {
            // Cek apakah invoice dengan nomor ini sudah tersimpan di SQLite
            let search_pattern = format!("%{}%", inv_no);
            let existing_id: Option<i64> = conn.query_row(
                "SELECT id FROM invoices WHERE file_path LIKE ?1 OR customer_snapshot LIKE ?1 LIMIT 1",
                params![search_pattern],
                |r| r.get(0),
            ).ok();

            if let Some(eid) = existing_id {
                obj.insert("id".to_string(), serde_json::json!(eid));
            } else {
                obj.remove("id");
            }
        }

        // B. Handle customer_id (bisa berupa ID numerik atau Nama Pelanggan string dari GAS)
        let mut customer_name = String::new();
        if let Some(cust_val) = obj.get("customer_id") {
            match cust_val {
                serde_json::Value::String(name) => {
                    let clean_name = name.trim();
                    if !clean_name.is_empty() {
                        customer_name = clean_name.to_string();
                        // Cari atau buat kontak di tabel contacts
                        let contact_id: Option<i64> = conn.query_row(
                            "SELECT id FROM contacts WHERE name = ?1 LIMIT 1",
                            params![clean_name],
                            |r| r.get(0),
                        ).ok();

                        let cid = if let Some(cid) = contact_id {
                            cid
                        } else {
                            let now = chrono::Utc::now().to_rfc3339();
                            let _ = conn.execute(
                                "INSERT INTO contacts (name, type, created_at, updated_at) VALUES (?1, 'customer', ?2, ?2)",
                                params![clean_name, now],
                            );
                            conn.last_insert_rowid()
                        };
                        obj.insert("customer_id".to_string(), serde_json::json!(cid));
                    } else {
                        obj.insert("customer_id".to_string(), serde_json::Value::Null);
                    }
                }
                serde_json::Value::Number(num) => {
                    if let Some(id_num) = num.as_i64() {
                        if let Ok(name) = conn.query_row(
                            "SELECT name FROM contacts WHERE id = ?1 LIMIT 1",
                            params![id_num],
                            |r| r.get::<_, String>(0),
                        ) {
                            customer_name = name;
                        }
                    }
                }
                _ => {}
            }
        }

        // C. Normalisasi file_path (jika bukan JSON, buat metadata JSON yang valid)
        let raw_file_path = obj.get("file_path").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let is_json_metadata = raw_file_path.trim().starts_with('{') && raw_file_path.trim().ends_with('}');
        if !is_json_metadata {
            let inv_no = invoice_no_str.unwrap_or(if raw_file_path.is_empty() { "DRAF".to_string() } else { raw_file_path.clone() });
            let inv_date = obj.get("created_at").and_then(|v| v.as_str()).unwrap_or("")
                .chars().take(10).collect::<String>();
            let pay_status = obj.get("payment_status").and_then(|v| v.as_str()).unwrap_or("LUNAS").to_string();
            let cust_display = if !customer_name.is_empty() { customer_name.clone() } else { "Umum".to_string() };

            let metadata_json = serde_json::json!({
                "invoiceNo": inv_no,
                "invoiceDate": inv_date,
                "invoiceHal": "Layanan Jasa",
                "invoiceLampiran": "-",
                "paymentStatus": pay_status,
                "customerName": cust_display,
                "customerWa": "",
                "customerEmail": "",
                "customerAddress": "",
                "isPenulis": false,
                "pdfFileName": raw_file_path
            });
            obj.insert("file_path".to_string(), serde_json::Value::String(metadata_json.to_string()));

            let has_snapshot = obj.get("customer_snapshot").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false);
            if !has_snapshot {
                let snapshot_json = serde_json::json!({
                    "name": cust_display,
                    "wa_number": "",
                    "email": "",
                    "address": "",
                    "isPenulis": false
                });
                obj.insert("customer_snapshot".to_string(), serde_json::Value::String(snapshot_json.to_string()));
            }

            if !obj.contains_key("payment_status") || obj.get("payment_status").is_none() {
                obj.insert("payment_status".to_string(), serde_json::Value::String(pay_status));
            }
        }
    }

    let mut valid_cols = std::collections::HashSet::new();
    let pragma_sql = format!("PRAGMA table_info({})", table);
    if let Ok(mut stmt) = conn.prepare(&pragma_sql) {
        if let Ok(rows) = stmt.query_map([], |r| {
            let col_name: String = r.get(1)?;
            let col_type: String = r.get(2)?;
            Ok((col_name, col_type.to_uppercase()))
        }) {
            for item in rows.flatten() {
                valid_cols.insert(item);
            }
        }
    }

    let col_types: std::collections::HashMap<String, String> = valid_cols.into_iter().collect();

    let mut names = Vec::new();
    let mut vals = Vec::new();
    for (k, v) in obj {
        if !col_types.is_empty() && !col_types.contains_key(&k) {
            continue;
        }
        if k == "id" {
            if let serde_json::Value::String(ref s) = v {
                if s.parse::<i64>().is_err() {
                    // Abaikan ID string non-numerik untuk kolom id INTEGER PRIMARY KEY
                    continue;
                }
            }
        }

        let is_text_col = col_types.get(&k).map(|t| t.contains("TEXT") || t.contains("CHAR")).unwrap_or(false);

        names.push(k.clone());
        vals.push(match v {
            serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
            serde_json::Value::Null => "NULL".to_string(),
            serde_json::Value::Number(n) => {
                if is_text_col {
                    format!("'{}'", n)
                } else {
                    n.to_string()
                }
            }
            serde_json::Value::Bool(b) => (if b { "1" } else { "0" }).to_string(),
            other => format!("'{}'", other.to_string().trim_matches('"').replace('\'', "''")),
        });
    }
    if names.is_empty() { return; }
    let sql = format!("INSERT OR REPLACE INTO {} ({}) VALUES ({})", table, names.join(", "), vals.join(", "));
    if let Err(e) = conn.execute(&sql, []) {
        eprintln!("[SYNC] Gagal upsert ke tabel {}: error={} sql={}", table, e, &sql[..sql.len().min(150)]);
    }
}

// ═══════════════════════════════════════════
// Helpers — column access by NAME (robust terhadap urutan kolom beda versi)
// ═══════════════════════════════════════════

use std::collections::HashMap;
use crate::db::wrapper::{PubhubStatement, PubhubRow};

fn build_col_map(stmt: &PubhubStatement) -> HashMap<String, usize> {
    let mut map = HashMap::new();
    for i in 0..stmt.column_count() {
        if let Ok(name) = stmt.column_name(i) {
            map.insert(name.to_lowercase(), i);
        }
    }
    map
}

fn col_text(row: &PubhubRow, map: &HashMap<String, usize>, name: &str) -> String {
    let idx = map.get(&name.to_lowercase()).copied().unwrap_or(0);
    match row.get_ref(idx) {
        Ok(rusqlite::types::ValueRef::Null) => String::new(),
        Ok(rusqlite::types::ValueRef::Integer(n)) => n.to_string(),
        Ok(rusqlite::types::ValueRef::Real(f)) => f.to_string(),
        Ok(rusqlite::types::ValueRef::Text(t)) => String::from_utf8_lossy(t).to_string(),
        _ => String::new(),
    }
}

fn col_int(row: &PubhubRow, map: &HashMap<String, usize>, name: &str) -> i64 {
    let idx = map.get(&name.to_lowercase()).copied().unwrap_or(0);
    match row.get_ref(idx) {
        Ok(rusqlite::types::ValueRef::Integer(n)) => n,
        Ok(rusqlite::types::ValueRef::Real(f)) => f as i64,
        Ok(rusqlite::types::ValueRef::Text(t)) => String::from_utf8_lossy(t).parse().unwrap_or(0),
        _ => 0,
    }
}

fn col_text_opt(row: &PubhubRow, map: &HashMap<String, usize>, name: &str) -> Option<String> {
    let idx = map.get(&name.to_lowercase()).copied().unwrap_or(0);
    match row.get_ref(idx) {
        Ok(rusqlite::types::ValueRef::Null) => None,
        Ok(rusqlite::types::ValueRef::Text(t)) => Some(String::from_utf8_lossy(t).to_string()),
        Ok(rusqlite::types::ValueRef::Integer(n)) => Some(n.to_string()),
        Ok(rusqlite::types::ValueRef::Real(f)) => Some(f.to_string()),
        _ => None,
    }
}
