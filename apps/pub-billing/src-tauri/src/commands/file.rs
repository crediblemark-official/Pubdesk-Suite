use tauri::State;
use crate::{AppState, WatcherState};
use crate::db::{File, WatchFolder};
use tauri::Emitter;
use tauri::Manager;

#[tauri::command]
pub async fn get_files(state: State<'_, AppState>) -> Result<Vec<File>, String> {
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.get_files().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_file(state: State<'_, AppState>, file: File) -> Result<i64, String> {
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.add_file(&file).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_file(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.delete_file(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_file(state: State<'_, AppState>, file: File) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.update_file(&file).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_file_physically(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    use std::fs::File as StdFile;
    use std::io::Write;

    let mut file = StdFile::create(path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn write_binary_file_base64(path: String, base64_content: String) -> Result<(), String> {
    use std::fs::File as StdFile;
    use std::io::Write;
    use base64::prelude::*;

    let bytes = BASE64_STANDARD
        .decode(base64_content.trim())
        .map_err(|e| format!("Invalid base64: {}", e))?;

    let mut file = StdFile::create(path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct AppConfig {
    pub work_files_dir: Option<String>,
}

fn get_config_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("app_config.json"))
}

fn load_app_config(app_handle: &tauri::AppHandle) -> AppConfig {
    if let Ok(config_path) = get_config_path(app_handle) {
        if config_path.exists() {
            if let Ok(file_content) = std::fs::read_to_string(&config_path) {
                if let Ok(config) = serde_json::from_str::<AppConfig>(&file_content) {
                    return config;
                }
            }
        }
    }
    AppConfig::default()
}

#[tauri::command]
pub fn get_custom_work_dir(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let config = load_app_config(&app_handle);
    Ok(config.work_files_dir)
}

#[tauri::command]
pub fn set_custom_work_dir(app_handle: tauri::AppHandle, path: Option<String>) -> Result<(), String> {
    let mut config = load_app_config(&app_handle);
    if let Some(ref p) = path {
        if p.trim().is_empty() {
            config.work_files_dir = None;
        } else {
            let path_buf = std::path::PathBuf::from(p);
            if !path_buf.exists() || !path_buf.is_dir() {
                return Err("Direktori tidak ditemukan atau bukan folder valid".to_string());
            }
            config.work_files_dir = Some(p.trim().to_string());
        }
    } else {
        config.work_files_dir = None;
    }

    let config_path = get_config_path(&app_handle)?;
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json_str = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&config_path, json_str).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn create_physical_file(app_handle: tauri::AppHandle, filename: String, bytes: Vec<u8>, folder: String) -> Result<String, String> {
    use tauri::Manager;
    use std::fs::File as StdFile;
    use std::io::Write;
    use std::path::PathBuf;

    let config = load_app_config(&app_handle);
    
    let base_dir = if let Some(ref custom_dir) = config.work_files_dir {
        if !custom_dir.trim().is_empty() {
            PathBuf::from(custom_dir)
        } else {
            app_handle
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?
        }
    } else {
        app_handle
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
    };
    
    let target_dir = base_dir.join(&folder);
    std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    
    let file_path = target_dir.join(&filename);
    
    let mut file = StdFile::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_physical_file_base64(app_handle: tauri::AppHandle, filename: String, base64_content: String, folder: String) -> Result<String, String> {
    use tauri::Manager;
    use std::fs::File as StdFile;
    use std::io::Write;
    use std::path::PathBuf;
    use base64::prelude::*;

    let bytes = BASE64_STANDARD
        .decode(base64_content.trim())
        .map_err(|e| format!("Invalid base64: {}", e))?;

    let config = load_app_config(&app_handle);
    
    let base_dir = if let Some(ref custom_dir) = config.work_files_dir {
        if !custom_dir.trim().is_empty() {
            PathBuf::from(custom_dir)
        } else {
            app_handle
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?
        }
    } else {
        app_handle
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
    };
    
    let target_dir = base_dir.join(&folder);
    std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    
    let file_path = target_dir.join(&filename);
    
    let mut file = StdFile::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn check_file_exists(path: String) -> Result<bool, String> {
    use std::path::Path;
    let path_buf = Path::new(&path);
    if path_buf.exists() {
        return Ok(true);
    }
    if path.contains('\u{2215}') {
        let alt_path = path.replace('\u{2215}', "-");
        if Path::new(&alt_path).exists() {
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
pub async fn copy_file_physically(src: String, dest: String) -> Result<(), String> {
    use std::path::Path;
    let mut target_src = src.clone();
    if !Path::new(&target_src).exists() && target_src.contains('\u{2215}') {
        let alt = target_src.replace('\u{2215}', "-");
        if Path::new(&alt).exists() {
            target_src = alt;
        }
    }
    if !Path::new(&target_src).exists() {
        return Err(format!("Berkas sumber tidak ditemukan di sistem: {}", src));
    }
    std::fs::copy(&target_src, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_file_physically(path: String) -> Result<(), String> {
    use std::path::Path;
    let mut target_path = path.clone();
    if !Path::new(&target_path).exists() && target_path.contains('\u{2215}') {
        let alt = target_path.replace('\u{2215}', "-");
        if Path::new(&alt).exists() {
            target_path = alt;
        }
    }
    if !Path::new(&target_path).exists() {
        return Err(format!("Berkas fisik tidak ditemukan di sistem: {}", path));
    }
    tauri_plugin_opener::open_path(&target_path, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_file_location_physically(path: String) -> Result<(), String> {
    use std::path::Path;
    let mut target_path = path.clone();
    if !Path::new(&target_path).exists() && target_path.contains('\u{2215}') {
        let alt = target_path.replace('\u{2215}', "-");
        if Path::new(&alt).exists() {
            target_path = alt;
        }
    }
    if !Path::new(&target_path).exists() {
        if let Some(parent) = Path::new(&target_path).parent() {
            if parent.exists() {
                return tauri_plugin_opener::open_path(parent, None::<&str>).map_err(|e| e.to_string());
            }
        }
        return Err(format!("Berkas fisik atau lokasinya tidak ditemukan di sistem: {}", path));
    }
    tauri_plugin_opener::reveal_item_in_dir(&target_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_watch_folders(state: State<'_, AppState>) -> Result<Vec<WatchFolder>, String> {
    let db = state.db.lock().unwrap();
    let db = db.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.get_watch_folders().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_watch_folder(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    watcher_state: State<'_, WatcherState>,
    path: String
) -> Result<String, String> {
    let (path_abs, paths) = {
        let db_lock = state.db.lock().unwrap();
        let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
        
        let path_buf = std::path::PathBuf::from(&path);
        if !path_buf.exists() || !path_buf.is_dir() {
            return Err("Folder tidak ditemukan atau bukan merupakan direktori valid".to_string());
        }

        let path_abs = path_buf.canonicalize()
            .map_err(|e| format!("Gagal memetakan path absolut: {}", e))?
            .to_string_lossy().to_string();

        db.add_watch_folder(&path_abs).map_err(|e| e.to_string())?;

        let watch_folders = db.get_watch_folders().map_err(|e| e.to_string())?;
        let paths: Vec<std::path::PathBuf> = watch_folders.iter().map(|f| std::path::PathBuf::from(&f.path)).collect();
        
        (path_abs, paths)
    }; // db_lock dilepas secara otomatis di sini!

    let app_handle_clone = app_handle.clone();
    let path_abs_clone = path_abs.clone();
    
    std::thread::spawn(move || {
        let _ = crate::watcher::scan_directory_recursive(&app_handle_clone, std::path::Path::new(&path_abs_clone));
        let _ = app_handle_clone.emit("local-files-changed", ());
    });

    let mut manager_lock = watcher_state.manager.lock().unwrap();
    if let Some(manager) = manager_lock.as_mut() {
        manager.start(paths)?;
    }

    Ok(format!("Folder {} berhasil didaftarkan dan dipantau", path_abs))
}

#[tauri::command]
pub async fn remove_watch_folder(
    state: State<'_, AppState>,
    watcher_state: State<'_, WatcherState>,
    id: i64
) -> Result<(), String> {
    let paths = {
        let db_lock = state.db.lock().unwrap();
        let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
        
        let folders = db.get_watch_folders().map_err(|e| e.to_string())?;
        if let Some(target) = folders.iter().find(|f| f.id == Some(id)) {
            let _ = db.delete_files_by_prefix(&target.path);
        }

        db.delete_watch_folder(id).map_err(|e| e.to_string())?;

        let watch_folders = db.get_watch_folders().map_err(|e| e.to_string())?;
        let paths: Vec<std::path::PathBuf> = watch_folders.iter().map(|f| std::path::PathBuf::from(&f.path)).collect();
        paths
    }; // db_lock dilepas secara otomatis di sini!

    let mut manager_lock = watcher_state.manager.lock().unwrap();
    if let Some(manager) = manager_lock.as_mut() {
        manager.start(paths)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_file_metadata(
    state: State<'_, AppState>,
    file_id: i64,
) -> Result<crate::indexing::pipeline::FileMetadataPayload, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
    crate::indexing::pipeline::get_file_metadata(db, file_id)
}

#[tauri::command]
pub async fn get_related_files(
    state: State<'_, AppState>,
    file_id: i64,
) -> Result<Vec<crate::indexing::pipeline::RelatedFileInfo>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
    crate::indexing::pipeline::get_related_files(db, file_id)
}

#[tauri::command]
pub async fn record_file_access(
    state: State<'_, AppState>,
    file_id: i64,
) -> Result<(), String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
    crate::indexing::pipeline::record_file_access(db, file_id)
}

#[tauri::command]
pub async fn global_semantic_search(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<crate::indexing::pipeline::SearchResultInfo>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
    crate::indexing::pipeline::global_semantic_search(db, &query)
}

#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_file_tag(
    state: State<'_, AppState>,
    file_id: i64,
    tag: String
) -> Result<(), String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.add_file_tag(file_id, &tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_file_tag(
    state: State<'_, AppState>,
    file_id: i64,
    tag: String
) -> Result<(), String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.remove_file_tag(file_id, &tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_file_tags(
    state: State<'_, AppState>,
    file_id: i64
) -> Result<Vec<String>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.get_file_tags(file_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_tags(
    state: State<'_, AppState>
) -> Result<Vec<String>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.get_all_tags().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_file_tags(
    state: State<'_, AppState>
) -> Result<std::collections::HashMap<i64, Vec<String>>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("Database tidak diinisialisasi")?;
    db.get_all_file_tags().map_err(|e| e.to_string())
}
