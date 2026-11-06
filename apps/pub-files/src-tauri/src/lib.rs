mod db;
mod watcher;
pub mod indexing;
pub mod commands;

use db::*;
use watcher::WatcherManager;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, State};
use std::net::TcpListener;
use std::io::{Read, Write};

pub struct AppState {
    pub db: Mutex<Option<Database>>,
    pub active_session: Mutex<Option<AppSession>>,
    pub db_path: Mutex<Option<PathBuf>>,
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
        })
        .manage(WatcherState {
            manager: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            init_database,
            start_oauth_server,
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
            commands::file::check_file_exists,
            commands::file::copy_file_physically,
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
            // Session / Auth commands
            commands::session::get_tim,
            commands::session::login_user,
            commands::session::logout_user,
            commands::session::get_current_user,
            commands::session::start_work_session,
            commands::session::stop_work_session,
            commands::session::get_active_work_session,
            commands::session::get_work_sessions,
            commands::session::get_activity_log,
            commands::session::get_activity_log_filtered,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
