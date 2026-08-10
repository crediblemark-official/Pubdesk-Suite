use tauri::State;
use crate::AppState;
use crate::db::{AppSession, WorkSession, ActivityLog};

#[tauri::command]
pub async fn login_user(state: State<'_, AppState>, tim_id: i64, pin: String) -> Result<AppSession, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database tidak diinisialisasi")?;
    let tim_list = db.get_all_tim().map_err(|e| e.to_string())?;
    let member = tim_list.into_iter().find(|t| t.id == Some(tim_id))
        .ok_or_else(|| "Anggota tim tidak ditemukan".to_string())?;
    if let Some(expected_pin) = &member.pin {
        if !expected_pin.is_empty() && *expected_pin != pin {
            return Err("PIN salah".to_string());
        }
    }
    let session = db.login_session(tim_id, &member.name, &member.role).map_err(|e| e.to_string())?;
    let _ = db.log_activity_audit("session", None, "LOGIN", &format!("Karyawan '{}' login ke sistem", member.name), Some(tim_id), Some(&member.name), None, None, Some("auth"));
    drop(db_guard);
    let mut active = state.active_session.lock().unwrap();
    *active = Some(session.clone());
    Ok(session)
}

#[tauri::command]
pub async fn logout_user(state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database tidak diinisialisasi")?;
    {
        let active = state.active_session.lock().unwrap();
        if let Some(ref session) = *active {
            let _ = db.log_activity_audit("session", None, "LOGOUT", &format!("Karyawan '{}' logout dari sistem", session.tim_name), Some(session.tim_id), Some(&session.tim_name), None, None, Some("auth"));
        }
    }
    db.logout_session().map_err(|e| e.to_string())?;
    drop(db_guard);
    let mut active = state.active_session.lock().unwrap();
    *active = None;
    Ok(())
}

#[tauri::command]
pub async fn get_current_user(state: State<'_, AppState>) -> Result<Option<AppSession>, String> {
    {
        let active = state.active_session.lock().unwrap();
        if active.is_some() {
            return Ok(active.clone());
        }
    }
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database tidak diinisialisasi")?;
    let session = db.get_active_session().map_err(|e| e.to_string())?;
    
    drop(db_guard);

    if let Some(ref s) = session {
        let mut active = state.active_session.lock().unwrap();
        *active = Some(s.clone());
    }
    Ok(session)
}

#[tauri::command]
pub async fn start_work_session(state: State<'_, AppState>, start_time: String) -> Result<i64, String> {
    let current_tim_id = {
        let active = state.active_session.lock().unwrap();
        active.as_ref().map(|s| s.tim_id).ok_or_else(|| "Pengguna belum login".to_string())?
    };
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.start_work_session(current_tim_id, &start_time).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_work_session(state: State<'_, AppState>, id: i64, end_time: String, duration_seconds: i64, notes: Option<String>) -> Result<(), String> {
    let current_tim_id = {
        let active = state.active_session.lock().unwrap();
        active.as_ref().map(|s| s.tim_id).ok_or_else(|| "Pengguna belum login".to_string())?
    };
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.stop_work_session(id, current_tim_id, &end_time, duration_seconds, notes.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn heartbeat_work_session(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let current_tim_id = {
        let active = state.active_session.lock().unwrap();
        active.as_ref().map(|s| s.tim_id).ok_or_else(|| "Pengguna belum login".to_string())?
    };
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.heartbeat_work_session(id, current_tim_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_work_session(state: State<'_, AppState>) -> Result<Option<WorkSession>, String> {
    let current_tim_id = {
        let active = state.active_session.lock().unwrap();
        active.as_ref().map(|s| s.tim_id).ok_or_else(|| "Pengguna belum login".to_string())?
    };
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.get_active_work_session(current_tim_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_work_sessions(state: State<'_, AppState>, limit: i64) -> Result<Vec<WorkSession>, String> {
    let current_tim_id = {
        let active = state.active_session.lock().unwrap();
        active.as_ref().map(|s| s.tim_id).ok_or_else(|| "Pengguna belum login".to_string())?
    };
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.get_work_sessions(current_tim_id, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_activity_log(state: State<'_, AppState>, limit: i64) -> Result<Vec<ActivityLog>, String> {
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.get_activity_log(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_activity_log_filtered(
    state: State<'_, AppState>,
    limit: i64,
    performed_by: Option<i64>,
    entity_type: Option<String>,
    action: Option<String>,
) -> Result<Vec<ActivityLog>, String> {
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.get_activity_log_filtered(
        limit,
        performed_by,
        entity_type.as_deref(),
        action.as_deref(),
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn call_gas_api(
    url: String,
    method: String,
    payload_json: Option<String>,
) -> Result<String, String> {
    println!("[GAS API] Memulai call: {} {}", method, url);
    if let Some(ref payload) = payload_json {
        println!("[GAS API] Panjang payload: {} bytes, pratinjau: {}", payload.len(), &payload[..payload.len().min(150)]);
    }

    // Untuk GAS: POST diproses server, lalu server redirect 302 ke URL echo.
    // Kita perlu: 1) POST tanpa follow redirect, 2) ambil Location, 3) GET ke Location.
    // Untuk GET: langsung follow redirect.
    let client_no_redirect = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| {
            println!("[GAS API] Gagal membuat HTTP client no-redirect: {}", e);
            format!("Gagal membuat HTTP client: {}", e)
        })?;

    let client_follow = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| {
            println!("[GAS API] Gagal membuat HTTP client follow: {}", e);
            format!("Gagal membuat HTTP client: {}", e)
        })?;

    if method.to_uppercase() == "POST" {
        let body = payload_json.unwrap_or_default();
        // Step 1: POST tanpa follow redirect
        let post_resp = client_no_redirect
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .body(body)
            .send()
            .await
            .map_err(|e| {
                println!("[GAS API] POST ke {} gagal: {}", url, e);
                format!("Request POST gagal: {}", e)
            })?;

        let post_status = post_resp.status();
        println!("[GAS API] Status respon POST awal: {}", post_status);

        // Step 2: Jika redirect (302/303), ambil Location dan GET ke sana
        if post_status.is_redirection() {
            let location = post_resp
                .headers()
                .get("location")
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| {
                    println!("[GAS API] Deteksi redirect tetapi header Location kosong");
                    "GAS redirect tanpa Location header".to_string()
                })?
                .to_string();

            println!("[GAS API] Mengikuti redirect ke Location: {}", location);

            let get_resp = client_follow
                .get(&location)
                .header("Accept", "application/json")
                .send()
                .await
                .map_err(|e| {
                    println!("[GAS API] GET ke redirect URL gagal: {}", e);
                    format!("Request GET ke redirect URL gagal: {}", e)
                })?;

            let get_status = get_resp.status();
            println!("[GAS API] Status respon redirect GET: {}", get_status);

            let text = get_resp.text().await
                .map_err(|e| {
                    println!("[GAS API] Gagal membaca teks respon redirect: {}", e);
                    format!("Gagal membaca response redirect: {}", e)
                })?;
            println!("[GAS API] Sukses. Panjang respon: {} karakter", text.len());
            return Ok(text);
        }

        // Tidak ada redirect — baca response POST langsung
        if !post_status.is_success() {
            let text = post_resp.text().await.unwrap_or_default();
            println!("[GAS API] POST gagal tanpa redirect, status: {}, respon: {}", post_status, text);
            return Err(format!("POST gagal status {}: {}", post_status, &text[..text.len().min(300)]));
        }
        let text = post_resp.text().await
            .map_err(|e| {
                println!("[GAS API] Gagal membaca teks respon POST langsung: {}", e);
                format!("Gagal membaca response POST: {}", e)
            })?;
        println!("[GAS API] Sukses (Tanpa redirect). Panjang respon: {} karakter", text.len());
        Ok(text)
    } else {
        // GET: langsung follow redirect
        let resp = client_follow
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| {
                println!("[GAS API] Request GET ke {} gagal: {}", url, e);
                format!("Request GET gagal: {}", e)
            })?;

        let status = resp.status();
        println!("[GAS API] Status respon GET: {}", status);

        let text = resp.text().await
            .map_err(|e| {
                println!("[GAS API] Gagal membaca teks respon GET: {}", e);
                format!("Gagal membaca response GET: {}", e)
            })?;

        if !status.is_success() {
            println!("[GAS API] GET gagal dengan status: {}, respon: {}", status, text);
            return Err(format!("GET gagal status {}: {}", status, &text[..text.len().min(300)]));
        }
        println!("[GAS API] Sukses GET. Panjang respon: {} karakter", text.len());
        Ok(text)
    }
}

#[tauri::command]
pub async fn seed_sample_data(state: State<'_, AppState>, options: crate::db::sample_data::SeedOptions) -> Result<String, String> {
    let db = state.db.lock().map_err(|_| "Failed to lock database".to_string())?;
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    if db.app_name != "admin" {
        return Err("Fitur memuat data sample hanya diperbolehkan melalui aplikasi PubAdmin".to_string());
    }
    crate::db::sample_data::seed_sample_data(&db.conn, options, &db.app_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_workflow_data(state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|_| "Failed to lock database".to_string())?;
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    if db.app_name != "admin" {
        return Err("Fitur reset data hanya diperbolehkan melalui aplikasi PubAdmin".to_string());
    }
    crate::db::sample_data::reset_workflow_data(&db.conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_total_data(state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|_| "Failed to lock database".to_string())?;
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    if db.app_name != "admin" {
        return Err("Fitur reset data hanya diperbolehkan melalui aplikasi PubAdmin".to_string());
    }
    crate::db::sample_data::reset_total_data(&db.conn, &db.app_name).map_err(|e| e.to_string())
}
