use tauri::{State, Manager};
use crate::AppState;
use crate::sync::client;

#[tauri::command]
pub async fn get_sync_config_full(state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    let cfg = client::SyncRuntimeConfig::load(&db.conn);
    let hide_other: String = db.conn.query_row(
        "SELECT value FROM p2p_config WHERE key = 'hide_sync_menu_in_other_apps'",
        [],
        |r| r.get(0)
    ).unwrap_or_else(|_| "false".to_string());

    serde_json::to_string(&serde_json::json!({
        "enabled": cfg.enabled,
        "workspace_id": cfg.workspace_id,
        "device_id": cfg.device_id,
        "gas_url": cfg.gas_url,
        "gas_token": cfg.gas_token,
        "last_push_ts": cfg.last_push_ts,
        "last_pull_ts": cfg.last_pull_ts,
        "hide_sync_menu_in_other_apps": hide_other == "true"
    })).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_sync_config(
    state: State<'_, AppState>,
    sync_method: String,
    worker_url: String,
    gas_url: String,
    gas_token: String,
    hide_sync_menu_in_other_apps: Option<bool>,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;

    let mut normalized_gas_url = gas_url.trim().to_string();
    if !normalized_gas_url.is_empty() && !normalized_gas_url.starts_with("http://") && !normalized_gas_url.starts_with("https://") {
        normalized_gas_url = format!("https://{}", normalized_gas_url);
    }
    let normalized_token = gas_token.trim().to_string();
    let normalized_worker = worker_url.trim().to_string();

    let is_enabled = if !normalized_gas_url.is_empty() { "true" } else { "false" };
    let _ = db.conn.execute("INSERT OR REPLACE INTO p2p_config (key, value) VALUES ('sync_enabled', ?1)", rusqlite::params![is_enabled]);

    db.conn.execute("INSERT OR REPLACE INTO p2p_config (key, value) VALUES ('sync_method', ?1)", rusqlite::params![sync_method]).map_err(|e| e.to_string())?;
    db.conn.execute("INSERT OR REPLACE INTO p2p_config (key, value) VALUES ('sync_worker_url', ?1)", rusqlite::params![normalized_worker]).map_err(|e| e.to_string())?;
    db.conn.execute("INSERT OR REPLACE INTO p2p_config (key, value) VALUES ('sync_gas_url', ?1)", rusqlite::params![normalized_gas_url]).map_err(|e| e.to_string())?;
    db.conn.execute("INSERT OR REPLACE INTO p2p_config (key, value) VALUES ('sync_gas_token', ?1)", rusqlite::params![normalized_token]).map_err(|e| e.to_string())?;
    let mut hide_val = None;
    if let Some(hide) = hide_sync_menu_in_other_apps {
        let val = if hide { "true" } else { "false" };
        db.conn.execute("INSERT OR REPLACE INTO p2p_config (key, value) VALUES ('hide_sync_menu_in_other_apps', ?1)", rusqlite::params![val]).map_err(|e| e.to_string())?;
        hide_val = Some(val);
    }

    let now = chrono::Utc::now().to_rfc3339();
    let _ = db.conn.execute(
        "INSERT INTO sync_outbox (table_name, row_id, action, data_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "app_config",
            1,
            "UPSERT",
            serde_json::json!({ "key": "gas_url", "value": normalized_gas_url, "updated_at": now }).to_string(),
            now
        ]
    );

    let _ = db.conn.execute(
        "INSERT INTO sync_outbox (table_name, row_id, action, data_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "app_config",
            2,
            "UPSERT",
            serde_json::json!({ "key": "gas_token", "value": normalized_token, "updated_at": now }).to_string(),
            now
        ]
    );

    if let Some(val) = hide_val {
        let _ = db.conn.execute(
            "INSERT INTO sync_outbox (table_name, row_id, action, data_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                "app_config",
                3,
                "UPSERT",
                serde_json::json!({ "key": "hide_sync_menu_in_other_apps", "value": val, "updated_at": now }).to_string(),
                now
            ]
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn test_sync_connection(state: State<'_, AppState>) -> Result<String, String> {
    let cfg;
    {
        let db = state.db.lock().unwrap();
        let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
        cfg = client::SyncRuntimeConfig::load(&db.conn);
    }

    let (gas_ok, gas_error) = if let Some(ref raw_url) = cfg.gas_url {
        let url = raw_url.trim();
        if url.is_empty() {
            (false, "URL sinkronisasi belum diisi atau belum disimpan".to_string())
        } else {
            let normalized_url = if !url.starts_with("http://") && !url.starts_with("https://") {
                format!("https://{}", url)
            } else {
                url.to_string()
            };
            let token_raw = cfg.gas_token.as_deref().unwrap_or("");
            let token = if token_raw.trim().is_empty() { "PubDesk_Secret_Token_2026" } else { token_raw.trim() };
            match reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build() {
                Ok(client) => {
                    let body = serde_json::json!({ "action": "test", "auth_token": token });
                    match client.post(&normalized_url).json(&body).send().await {
                        Ok(resp) => (resp.status().is_success(), if resp.status().is_success() { String::new() } else { format!("HTTP {}", resp.status()) }),
                        Err(e) => (false, format!("Koneksi gagal: {}", e)),
                    }
                }
                Err(e) => (false, format!("Client error: {}", e)),
            }
        }
    } else {
        (false, "URL sinkronisasi belum dikonfigurasi".to_string())
    };

    serde_json::to_string(&serde_json::json!({
        "gas_ok": gas_ok, "gas_error": gas_error,
    })).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn run_sync_now(state: State<'_, AppState>) -> Result<String, String> {
    let (cfg, changes, outbox_ids);
    {
        let db = state.db.lock().unwrap();
        let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
        cfg = client::SyncRuntimeConfig::load(&db.conn);
        let (c, ids) = client::sync_read_outbox(&db.conn).map_err(|e| e.to_string())?;
        changes = c;
        outbox_ids = ids;
    }

    let mut result = client::SyncResult { pushed: 0, pulled: 0, error: None };

    if cfg.is_ready() {
        if !changes.is_empty() {
            match client::sync_push_to_gas(changes, &cfg).await {
                Ok(n) => {
                    result.pushed = n;
                    let db = state.db.lock().unwrap();
                    if let Some(db) = db.as_ref() { let _ = client::sync_mark_sent(&db.conn, &outbox_ids); }
                }
                Err(e) => result.error = Some(e),
            }
        }

        match client::sync_pull_from_gas(&cfg).await {
            Ok(remote_changes) => {
                if !remote_changes.is_empty() {
                    let db = state.db.lock().unwrap();
                    if let Some(db) = db.as_ref() {
                        match client::sync_apply_remote(&db.conn, &remote_changes) {
                            Ok(n) => result.pulled = n,
                            Err(e) => result.error = Some(e),
                        }
                    }
                }
            }
            Err(e) => { if result.error.is_none() { result.error = Some(e); } }
        }
    }

    let mut s = state.sync.lock().unwrap();
    if let Some(ref err) = result.error { s.error = Some(err.clone()); } else { s.error = None; }
    s.last_sync_at = Some(chrono::Local::now().to_rfc3339());
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

pub fn start_background_sync(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            let state = match app_handle.try_state::<AppState>() { Some(s) => s, None => continue };

            let (cfg, changes, outbox_ids);
            {
                let db = state.db.lock().unwrap();
                let db = match db.as_ref() { Some(db) => db, None => continue };
                cfg = client::SyncRuntimeConfig::load(&db.conn);
                if !cfg.is_ready() { continue; }
                let (c, ids) = match client::sync_read_outbox(&db.conn) { Ok(x) => x, Err(_) => continue };
                changes = c; outbox_ids = ids;
            }

            let mut pushed = 0usize;
            let mut pulled = 0usize;

            if !changes.is_empty() {
                match client::sync_push_to_gas(changes, &cfg).await {
                    Ok(n) => {
                        pushed = n;
                        let db = state.db.lock().unwrap();
                        if let Some(db) = db.as_ref() { let _ = client::sync_mark_sent(&db.conn, &outbox_ids); }
                    }
                    Err(e) => { let mut s = state.sync.lock().unwrap(); s.error = Some(e); }
                }
            }

            match client::sync_pull_from_gas(&cfg).await {
                Ok(remote_changes) => {
                    if !remote_changes.is_empty() {
                        let db = state.db.lock().unwrap();
                        if let Some(db) = db.as_ref() {
                            match client::sync_apply_remote(&db.conn, &remote_changes) {
                                Ok(n) => pulled = n,
                                Err(e) => { let mut s = state.sync.lock().unwrap(); s.error = Some(e); }
                            }
                        }
                    }
                }
                Err(e) => { let mut s = state.sync.lock().unwrap(); s.error = Some(e); }
            }

            if pushed > 0 || pulled > 0 {
                let mut s = state.sync.lock().unwrap();
                s.error = None;
                s.last_sync_at = Some(chrono::Local::now().to_rfc3339());
            }
        }
    });
}
