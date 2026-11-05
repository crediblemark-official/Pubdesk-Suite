mod db;
mod watcher;
pub mod indexing;
pub mod commands;
pub mod sync;

use db::*;
use watcher::WatcherManager;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, State};
use std::net::TcpListener;
use std::io::{Read, Write};

pub struct SyncState {
    pub enabled: bool,
    pub workspace_id: Option<String>,
    pub master_key: Option<[u8; 32]>,
    pub last_sync_at: Option<String>,
    pub error: Option<String>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            enabled: false,
            workspace_id: None,
            master_key: None,
            last_sync_at: None,
            error: None,
        }
    }
}

pub struct AppState {
    pub db: Mutex<Option<Database>>,
    pub active_session: Mutex<Option<AppSession>>,
    pub db_path: Mutex<Option<PathBuf>>,
    pub sync: Mutex<SyncState>,
}

pub struct WatcherState {
    pub manager: Mutex<Option<WatcherManager>>,
}

#[tauri::command]
async fn init_database(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    watcher_state: State<'_, WatcherState>,
) -> Result<(), String> {
    let db_path = get_db_path(&app_handle).map_err(|e| e.to_string())?;
    init_db(&db_path).map_err(|e| e.to_string())?;

    *state.db_path.lock().unwrap() = Some(db_path.clone());

    let db = Database::new(&db_path, db::APP_NAME).map_err(|e| e.to_string())?;
    *state.db.lock().unwrap() = Some(db);

    if let Ok(conn) = rusqlite::Connection::open(&db_path) {
        if let Ok(cfg) = sync::engine::get_sync_config(&conn) {
            let mut s = state.sync.lock().unwrap();
            s.enabled = cfg.enabled;
            s.workspace_id = cfg.workspace_id;
        }
    }

    let watch_folders = {
        let db_lock = state.db.lock().unwrap();
        let db = db_lock.as_ref().ok_or("Database tidak terinisialisasi")?;
        db.get_watch_folders().map_err(|e| e.to_string())?
    };
    let paths: Vec<std::path::PathBuf> = watch_folders
        .iter()
        .map(|f| std::path::PathBuf::from(&f.path))
        .collect();

    let manager = WatcherManager::new(app_handle.clone());
    let mut manager_lock = watcher_state.manager.lock().unwrap();
    *manager_lock = Some(manager);

    if let Some(manager) = manager_lock.as_mut() {
        let _ = manager.start(paths);
    }

    Ok(())
}

#[tauri::command]
async fn get_sync_config_command(
    app_handle: tauri::AppHandle,
) -> Result<sync::types::SyncConfig, String> {
    let db_path = get_db_path(&app_handle).map_err(|e| e.to_string())?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    sync::engine::get_sync_config(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_sync_enabled(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    let db_path = get_db_path(&app_handle).map_err(|e| e.to_string())?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO p2p_config (key, value) VALUES ('sync_enabled', ?1)",
        [if enabled { "true" } else { "false" }],
    )
    .map_err(|e| e.to_string())?;

    state.sync.lock().unwrap().enabled = enabled;

    if !enabled {
        let mut s = state.sync.lock().unwrap();
        s.master_key = None;
    }

    Ok(())
}

#[tauri::command]
async fn create_sync_workspace(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    admin_pin: String,
) -> Result<String, String> {
    let db_path = get_db_path(&app_handle).map_err(|e| e.to_string())?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    let ws = sync::engine::create_workspace(&conn, &admin_pin)?;

    {
        let mut s = state.sync.lock().unwrap();
        s.enabled = true;
        s.workspace_id = Some(ws.clone());
    }

    Ok(ws)
}

#[tauri::command]
async fn join_sync_workspace(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    invite_code: String,
    employee_pin: String,
) -> Result<String, String> {
    let db_path = get_db_path(&app_handle).map_err(|e| e.to_string())?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    let ws = sync::engine::join_workspace(&conn, &invite_code, &employee_pin)?;

    {
        let mut s = state.sync.lock().unwrap();
        s.enabled = true;
        s.workspace_id = Some(ws.clone());
    }

    Ok(ws)
}

#[tauri::command]
async fn unlock_sync(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    pin: String,
) -> Result<String, String> {
    let db_path = get_db_path(&app_handle).map_err(|e| e.to_string())?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    let master = sync::engine::unlock_master_key(&conn, &pin)?;

    {
        let mut s = state.sync.lock().unwrap();
        s.master_key = Some(master);
        s.error = None;
    }

    let ws = state.sync.lock().unwrap().workspace_id.clone().unwrap_or_default();
    Ok(ws)
}

#[tauri::command]
async fn lock_sync(state: State<'_, AppState>) -> Result<(), String> {
    let mut s = state.sync.lock().unwrap();
    s.master_key = None;
    Ok(())
}

#[tauri::command]
async fn reset_sync_workspace(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_path = get_db_path(&app_handle).map_err(|e| e.to_string())?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;

    let _ = conn.execute(
        "DELETE FROM p2p_config WHERE key IN ('sync_enabled', 'sync_workspace_id', 'sync_admin_setup')",
        [],
    );
    let _ = conn.execute(
        "DELETE FROM crypto_vault WHERE key = 'master_key_sealed'",
        [],
    );

    let mut s = state.sync.lock().unwrap();
    s.enabled = false;
    s.workspace_id = None;
    s.master_key = None;
    s.error = None;
    s.last_sync_at = None;

    Ok(())
}

#[tauri::command]
async fn create_employee_invite(
    app_handle: tauri::AppHandle,
    admin_pin: String,
    employee_pin: String,
) -> Result<String, String> {
    let db_path = get_db_path(&app_handle).map_err(|e| e.to_string())?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    sync::engine::create_employee_invite(&conn, &admin_pin, &employee_pin)
}

#[tauri::command]
async fn get_sync_status(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<sync::types::SyncStatus, String> {
    let db_path = get_db_path(&app_handle).map_err(|e| e.to_string())?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;

    let (enabled, workspace_id, last_sync_at, error) = {
        let s = state.sync.lock().unwrap();
        (
            s.enabled,
            s.workspace_id.clone(),
            s.last_sync_at.clone(),
            s.error.clone(),
        )
    };

    sync::engine::build_sync_status(&conn, enabled, workspace_id, last_sync_at, error)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn start_oauth_server(app_handle: tauri::AppHandle, port: u16) -> Result<String, String> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .map_err(|e| format!("Gagal mendengarkan di port: {}", e))?;

    listener.set_nonblocking(true).map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let start_time = std::time::Instant::now();
        loop {
            if start_time.elapsed().as_secs() > 300 {
                break;
            }

            match listener.accept() {
                Ok((mut stream, _addr)) => {
                    let mut buffer = [0; 2048];
                    if let Ok(size) = stream.read(&mut buffer) {
                        let request = String::from_utf8_lossy(&buffer[..size]);

                        if let Some(code_pos) = request.find("code=") {
                            let after_code = &request[code_pos + 5..];
                            let end_pos = after_code.find(' ').or_else(|| after_code.find('&')).unwrap_or(after_code.len());
                            let auth_code = &after_code[..end_pos];

                            let _ = app_handle.emit("gdrive-oauth-code", auth_code.to_string());

                            let response_body = "
                                <html>
                                <head><title>Login Sukses</title></head>
                                <body style='font-family: sans-serif; text-align: center; padding-top: 60px; background-color: #f3f4f6; color: #1f2937;'>
                                    <div style='display: inline-block; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-top: 4px solid #10b981;'>
                                        <h1 style='color: #10b981; margin-bottom: 12px;'>Login Google Drive Berhasil!</h1>
                                        <p style='font-size: 15px; margin-bottom: 24px;'>Akun Google Anda berhasil dihubungkan ke PubDesk.</p>
                                        <p style='color: #6b7280; font-size: 13px;'>Anda dapat menutup jendela browser ini sekarang dan kembali ke aplikasi.</p>
                                    </div>
                                </body>
                                </html>
                            ";
                            let response = format!(
                                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n{}",
                                response_body.len(),
                                response_body
                            );
                            let _ = stream.write_all(response.as_bytes());
                            let _ = stream.flush();
                            break;
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                Err(_) => {
                    break;
                }
            }
        }
    });

    Ok("Server dimulai".to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            db: Mutex::new(None),
            active_session: Mutex::new(None),
            db_path: Mutex::new(None),
            sync: Mutex::new(SyncState::default()),
        })
        .manage(WatcherState {
            manager: Mutex::new(None),
        })
        .setup(|app| {
            let handle = app.handle().clone();
            commands::sync_config::start_background_sync(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            init_database,
            start_oauth_server,
            get_sync_config_command,
            set_sync_enabled,
            create_sync_workspace,
            join_sync_workspace,
            unlock_sync,
            lock_sync,
            reset_sync_workspace,
            create_employee_invite,
            get_sync_status,
            commands::sync_config::get_sync_config_full,
            commands::sync_config::set_sync_config,
            commands::sync_config::test_sync_connection,
            commands::sync_config::run_sync_now,
            // Book commands
            commands::book::get_books,
            commands::book::add_book,
            commands::book::delete_book,
            commands::book::update_book,
            // Service commands
            commands::invoice::get_services,
            commands::invoice::add_service,
            commands::invoice::update_service,
            commands::invoice::delete_service,
            // Contact commands
            commands::contact::get_contacts,
            commands::contact::add_contact,
            commands::contact::update_contact,
            commands::contact::delete_contact,
            commands::contact::get_penulis,
            commands::contact::add_penulis,
            commands::contact::update_penulis,
            commands::contact::delete_penulis,
            commands::contact::get_penerbit,
            commands::contact::add_penerbit,
            commands::contact::update_penerbit,
            commands::contact::delete_penerbit,
            commands::contact::get_tim,
            commands::contact::add_tim,
            commands::contact::update_tim,
            commands::contact::delete_tim,
            // Invoice commands
            commands::invoice::get_invoices,
            commands::invoice::add_invoice,
            commands::invoice::update_invoice,
            commands::invoice::delete_invoice,
            commands::invoice::update_invoice_sync_status,
            commands::invoice::update_sync_status,
            // File commands
            commands::file::get_files,
            commands::file::add_file,
            commands::file::delete_file,
            commands::file::update_file,
            commands::file::create_physical_file,
            commands::file::create_physical_file_base64,
            commands::file::write_binary_file,
            commands::file::write_binary_file_base64,
            commands::file::open_file_physically,
            commands::file::open_file_location_physically,
            commands::file::get_custom_work_dir,
            commands::file::set_custom_work_dir,
            commands::file::get_watch_folders,
            commands::file::add_watch_folder,
            commands::file::remove_watch_folder,
            commands::file::get_file_metadata,
            commands::file::get_related_files,
            commands::file::record_file_access,
            commands::file::global_semantic_search,
            commands::file::add_file_tag,
            commands::file::remove_file_tag,
            commands::file::get_file_tags,
            commands::file::get_all_tags,
            commands::file::get_all_file_tags,
            commands::file::read_file_bytes,
            // Workflow commands
            commands::workflow::get_naskah,
            commands::workflow::add_naskah,
            commands::workflow::update_naskah,
            commands::workflow::delete_naskah,
            commands::workflow::get_legalitas,
            commands::workflow::add_legalitas,
            commands::workflow::update_legalitas,
            commands::workflow::delete_legalitas,
            commands::workflow::get_tasks,
            commands::workflow::add_task,
            commands::workflow::update_task,
            commands::workflow::delete_task,
            commands::workflow::get_workflow_templates,
            commands::workflow::add_workflow_template,
            commands::workflow::add_task_history,
            commands::workflow::get_task_history,
            commands::workflow::get_all_task_history,
            commands::workflow::update_task_status,
            commands::workflow::get_task_blockers,
            commands::workflow::add_task_blocker,
            commands::workflow::resolve_task_blocker,
            commands::workflow::get_task_approvals,
            commands::workflow::request_approval,
            commands::workflow::decide_approval,
            commands::workflow::import_alur_naskah_batch,
            // Session / Auth / Utility commands
            commands::session::login_user,
            commands::session::logout_user,
            commands::session::get_current_user,
            commands::session::start_work_session,
            commands::session::stop_work_session,
            commands::session::get_active_work_session,
            commands::session::get_work_sessions,
            commands::session::get_activity_log,
            commands::session::get_activity_log_filtered,
            commands::session::call_gas_api,
            commands::session::seed_sample_data,
            commands::session::reset_workflow_data,
            commands::session::reset_total_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
