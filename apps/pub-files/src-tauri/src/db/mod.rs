pub mod error;
pub mod models;
pub mod schema;

pub mod file;
pub mod session;

pub mod wrapper;

// Modul database SQLite untuk aplikasi PubDesk
pub use error::DbError;
pub use models::*;
pub use wrapper::PubhubConnection as Connection;
use std::path::PathBuf;
use tauri::Manager;

pub const APP_NAME: &str = "files";

/// Returns the shared PubHub database path used by all apps in the monorepo.
/// Uses the OS local data directory (e.g. %LOCALAPPDATA% / ~/.local/share)
/// so that pub-billing, pub-ops, pub-admin and pub-files open the same file.
pub fn get_db_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, DbError> {
    let local_data_dir = app_handle
        .path()
        .local_data_dir()
        .map_err(|_| DbError::PathError)?;

    let shared_dir = local_data_dir.join("PubHub");
    std::fs::create_dir_all(&shared_dir)?;
    Ok(shared_dir.join("pubhub.db"))
}

pub fn init_db(db_path: &PathBuf) -> Result<(), DbError> {
    let conn = rusqlite::Connection::open(db_path)?;
    let _ = conn.execute("PRAGMA journal_mode=WAL;", []);
    let _ = conn.execute("PRAGMA busy_timeout = 5000;", []);
    let _ = conn.execute("PRAGMA foreign_keys = ON;", []);
    schema::create_tables(&conn)?;
    
    // Bersihkan / auto-close sesi jam kerja yang mati (unclosed session akibat PC shutdown/crash)
    let _ = conn.execute(
        "UPDATE work_hours 
         SET end_time = COALESCE(last_heartbeat, start_time), 
             duration_seconds = CAST(
                 (strftime('%s', COALESCE(last_heartbeat, start_time)) - strftime('%s', start_time)) 
                 AS INTEGER
             ),
             notes = 'Auto-closed (system shutdown/crash)'
         WHERE end_time IS NULL 
           AND (last_heartbeat IS NULL OR (strftime('%s', 'now') - strftime('%s', last_heartbeat)) > 60)",
        []
    );
    
    Ok(())
}

pub struct Database {
    pub(crate) conn: Connection,
    pub(crate) app_name: String,
}

impl Database {
    pub fn new(db_path: &PathBuf, app_name: &str) -> Result<Self, DbError> {
        let conn = rusqlite::Connection::open(db_path)?;
        let _ = conn.execute("PRAGMA journal_mode=WAL;", []);
        let _ = conn.execute("PRAGMA busy_timeout = 5000;", []);
        let _ = conn.execute("CREATE TABLE IF NOT EXISTS _sync_skip (val INTEGER)", []);
        Ok(Self {
            conn: Connection::from(conn),
            app_name: app_name.to_string(),
        })
    }
}
