use super::{Database, DbError};
use crate::db::models::{Tim, Legalitas, ActivityLog, AppSession, WorkSession, WorkflowEvent};
use rusqlite::{params, Connection};

impl Database {
    // Tim CRUD
    pub fn add_tim(&self, l: &Tim) -> Result<i64, DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO tim (name, role, department, is_active, weekly_target, notes, pin, wa_number, email, address, app, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                l.name,
                l.role,
                l.department,
                l.is_active,
                l.weekly_target,
                l.notes,
                l.pin,
                l.wa_number,
                l.email,
                l.address,
                l.app,
                l.created_at,
                now
            ]
        )?;
        let id = self.conn.last_insert_rowid();
        self.log_activity("tim", Some(id), "CREATE", &format!("Menambahkan anggota tim '{}'", l.name))?;
        Ok(id)
    }

    pub fn get_all_tim(&self) -> Result<Vec<Tim>, DbError> {
        let mut res = Vec::new();
        if self.app_name == "admin" {
            let mut stmt = self.conn.prepare("SELECT id, name, role, department, is_active, weekly_target, notes, pin, created_at, updated_at, wa_number, email, address, app FROM tim ORDER BY name ASC")?;
            let rows = stmt.query_map([], |row| {
                Ok(Tim {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    role: row.get(2)?,
                    department: row.get(3)?,
                    is_active: row.get(4)?,
                    weekly_target: row.get(5)?,
                    notes: row.get(6)?,
                    pin: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                    wa_number: row.get(10)?,
                    email: row.get(11)?,
                    address: row.get(12)?,
                    app: row.get(13)?,
                })
            })?;
            for r in rows {
                res.push(r?);
            }
        } else {
            let mut stmt = self.conn.prepare("SELECT id, name, role, department, is_active, weekly_target, notes, pin, created_at, updated_at, wa_number, email, address, app FROM tim WHERE app = ?1 OR app IS NULL OR app = '' ORDER BY name ASC")?;
            let rows = stmt.query_map(params![self.app_name], |row| {
                Ok(Tim {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    role: row.get(2)?,
                    department: row.get(3)?,
                    is_active: row.get(4)?,
                    weekly_target: row.get(5)?,
                    notes: row.get(6)?,
                    pin: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                    wa_number: row.get(10)?,
                    email: row.get(11)?,
                    address: row.get(12)?,
                    app: row.get(13)?,
                })
            })?;
            for r in rows {
                res.push(r?);
            }
        }
        Ok(res)
    }

    pub fn update_tim(&self, l: &Tim) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "UPDATE tim SET name = ?1, role = ?2, department = ?3, is_active = ?4, weekly_target = ?5, notes = ?6, pin = ?7, wa_number = ?8, email = ?9, address = ?10, app = ?11, updated_at = ?12 WHERE id = ?13",
            params![
                l.name,
                l.role,
                l.department,
                l.is_active,
                l.weekly_target,
                l.notes,
                l.pin,
                l.wa_number,
                l.email,
                l.address,
                l.app,
                now,
                l.id
            ]
        )?;
        self.log_activity("tim", l.id, "UPDATE", &format!("Memperbarui anggota tim '{}'", l.name))?;
        Ok(())
    }

    pub fn delete_tim(&self, id: i64) -> Result<(), DbError> {
        self.conn
            .execute("DELETE FROM tim WHERE id = ?1", params![id])?;
        self.log_activity("tim", Some(id), "DELETE", &format!("Menghapus anggota tim id={}", id))?;
        Ok(())
    }

    // WorkflowEvents CRUD
    pub fn add_workflow_event(&self, e: &WorkflowEvent) -> Result<i64, DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO workflow_events (naskah_id, event_name, completed_date, pic_name, notes, proof_path_or_link, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                e.naskah_id,
                e.event_name,
                e.completed_date,
                e.pic_name,
                e.notes,
                e.proof_path_or_link,
                e.status,
                now,
                now
            ]
        )?;
        let id = self.conn.last_insert_rowid();
        self.log_activity("workflow_event", Some(id), "CREATE", &format!("Menambahkan event '{}'", e.event_name))?;
        Ok(id)
    }

    pub fn get_workflow_events(&self, naskah_id: i64) -> Result<Vec<WorkflowEvent>, DbError> {
        let mut stmt = self.conn.prepare("SELECT id, naskah_id, event_name, completed_date, pic_name, notes, proof_path_or_link, status, created_at, updated_at FROM workflow_events WHERE naskah_id = ?1 ORDER BY id ASC")?;
        let rows = stmt.query_map(params![naskah_id], |row| {
            Ok(WorkflowEvent {
                id: row.get(0)?,
                naskah_id: row.get(1)?,
                event_name: row.get(2)?,
                completed_date: row.get(3)?,
                pic_name: row.get(4)?,
                notes: row.get(5)?,
                proof_path_or_link: row.get(6)?,
                status: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        let mut res = Vec::new();
        for r in rows {
            res.push(r?);
        }
        Ok(res)
    }

    pub fn update_workflow_event(&self, e: &WorkflowEvent) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();

        // Ambil status lama sebelum diupdate untuk audit trail
        let old_status: Option<String> = e.id.and_then(|eid| {
            self.conn
                .query_row("SELECT status FROM workflow_events WHERE id = ?1", params![eid], |row| row.get(0))
                .ok()
        });

        self.conn.execute(
            "UPDATE workflow_events SET completed_date = ?1, pic_name = ?2, notes = ?3, proof_path_or_link = ?4, status = ?5, updated_at = ?6 WHERE id = ?7",
            params![
                e.completed_date,
                e.pic_name,
                e.notes,
                e.proof_path_or_link,
                e.status,
                now,
                e.id
            ]
        )?;

        let new_status = &e.status;
        let old_val = old_status.as_deref().unwrap_or("-");
        self.log_activity_audit(
            "workflow_event", e.id, "UPDATE",
            &format!("Memperbarui event '{}'", e.event_name),
            None, None,
            Some(&format!("status: {}", old_val)),
            Some(&format!("status: {}", new_status)),
            Some("pub-ops"),
        )?;
        Ok(())
    }

    // Legalitas CRUD
    pub fn add_legalitas(&self, l: &Legalitas) -> Result<i64, DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO legalitas (naskah_id, judul_buku, nama_penulis, tipe, tanggal_pengajuan, keterangan, status, nomor_dokumen, tanggal_keluar, tanggal_revisi, pic_id, rejection_reason, proof_path_or_link, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                l.naskah_id,
                l.judul_buku,
                l.nama_penulis,
                l.tipe,
                l.tanggal_pengajuan,
                l.keterangan,
                l.status,
                l.nomor_dokumen,
                l.tanggal_keluar,
                l.tanggal_revisi,
                l.pic_id,
                l.rejection_reason,
                l.proof_path_or_link,
                l.created_at,
                now
            ]
        )?;
        let id = self.conn.last_insert_rowid();
        self.log_activity("legalitas", Some(id), "CREATE", &format!("Menambahkan legalitas '{}'", l.judul_buku))?;
        Ok(id)
    }

    pub fn get_legalitas(&self) -> Result<Vec<Legalitas>, DbError> {
        let mut stmt = self.conn.prepare("SELECT id, naskah_id, judul_buku, nama_penulis, tipe, tanggal_pengajuan, keterangan, status, nomor_dokumen, tanggal_keluar, tanggal_revisi, pic_id, rejection_reason, proof_path_or_link, created_at, updated_at FROM legalitas ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(Legalitas {
                id: row.get(0)?,
                naskah_id: row.get(1)?,
                judul_buku: row.get(2)?,
                nama_penulis: row.get(3)?,
                tipe: row.get(4)?,
                tanggal_pengajuan: row.get(5)?,
                keterangan: row.get(6)?,
                status: row.get(7)?,
                nomor_dokumen: row.get(8)?,
                tanggal_keluar: row.get(9)?,
                tanggal_revisi: row.get(10)?,
                pic_id: row.get(11)?,
                rejection_reason: row.get(12)?,
                proof_path_or_link: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;
        let mut res = Vec::new();
        for r in rows {
            res.push(r?);
        }
        Ok(res)
    }

    pub fn update_legalitas(&self, l: &Legalitas) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();

        // Ambil status lama sebelum diupdate untuk audit trail
        let old_status: Option<String> = l.id.and_then(|lid| {
            self.conn
                .query_row("SELECT status FROM legalitas WHERE id = ?1", params![lid], |row| row.get(0))
                .ok()
        });

        self.conn.execute(
            "UPDATE legalitas SET naskah_id = ?1, judul_buku = ?2, nama_penulis = ?3, tipe = ?4, tanggal_pengajuan = ?5, keterangan = ?6, status = ?7, nomor_dokumen = ?8, tanggal_keluar = ?9, tanggal_revisi = ?10, pic_id = ?11, rejection_reason = ?12, proof_path_or_link = ?13, updated_at = ?14 WHERE id = ?15",
            params![
                l.naskah_id,
                l.judul_buku,
                l.nama_penulis,
                l.tipe,
                l.tanggal_pengajuan,
                l.keterangan,
                l.status,
                l.nomor_dokumen,
                l.tanggal_keluar,
                l.tanggal_revisi,
                l.pic_id,
                l.rejection_reason,
                l.proof_path_or_link,
                now,
                l.id
            ]
        )?;

        let new_status = &l.status;
        let old_val = old_status.as_deref().unwrap_or("-");
        self.log_activity_audit(
            "legalitas", l.id, "UPDATE",
            &format!("Memperbarui legalitas '{}'", l.judul_buku),
            None, None,
            Some(&format!("status: {}", old_val)),
            Some(&format!("status: {}", new_status)),
            Some("pub-ops"),
        )?;
        Ok(())
    }

    pub fn delete_legalitas(&self, id: i64) -> Result<(), DbError> {
        self.conn
            .execute("DELETE FROM legalitas WHERE id = ?1", params![id])?;
        self.log_activity("legalitas", Some(id), "DELETE", &format!("Menghapus legalitas id={}", id))?;
        Ok(())
    }

    // Activity Log helper — mendukung audit trail karyawan
    pub fn log_activity(
        &self,
        entity_type: &str,
        entity_id: Option<i64>,
        action: &str,
        description: &str,
    ) -> Result<(), DbError> {
        self.log_activity_audit(entity_type, entity_id, action, description, None, None, None, None, None)
    }

    pub fn log_activity_audit(
        &self,
        entity_type: &str,
        entity_id: Option<i64>,
        action: &str,
        description: &str,
        performed_by: Option<i64>,
        performed_by_name: Option<&str>,
        old_value: Option<&str>,
        new_value: Option<&str>,
        module: Option<&str>,
    ) -> Result<(), DbError> {
        let created_at = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO activity_log (entity_type, entity_id, action, description, performed_by, performed_by_name, old_value, new_value, module, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![entity_type, entity_id, action, description, performed_by, performed_by_name, old_value, new_value, module, created_at],
        )?;
        Ok(())
    }

    pub fn get_activity_log(&self, limit: i64) -> Result<Vec<ActivityLog>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, entity_type, entity_id, action, description, performed_by, performed_by_name, old_value, new_value, module, created_at FROM activity_log ORDER BY created_at DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(ActivityLog {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                action: row.get(3)?,
                description: row.get(4)?,
                performed_by: row.get(5)?,
                performed_by_name: row.get(6)?,
                old_value: row.get(7)?,
                new_value: row.get(8)?,
                module: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;
        
        let mut res = Vec::new();
        for r in rows {
            res.push(r?);
        }
        Ok(res)
    }

    pub fn get_activity_log_filtered(
        &self,
        limit: i64,
        performed_by: Option<i64>,
        entity_type: Option<&str>,
        action: Option<&str>,
    ) -> Result<Vec<ActivityLog>, DbError> {
        let mut conditions: Vec<String> = Vec::new();
        if performed_by.is_some() { conditions.push("performed_by = ?2".to_string()); }
        if entity_type.is_some() { conditions.push("entity_type = ?3".to_string()); }
        if action.is_some() { conditions.push("action = ?4".to_string()); }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let sql = format!(
            "SELECT id, entity_type, entity_id, action, description, performed_by, performed_by_name, old_value, new_value, module, created_at FROM activity_log {} ORDER BY created_at DESC LIMIT ?1",
            where_clause
        );

        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(
            params![limit, performed_by, entity_type, action],
            |row| {
                Ok(ActivityLog {
                    id: row.get(0)?,
                    entity_type: row.get(1)?,
                    entity_id: row.get(2)?,
                    action: row.get(3)?,
                    description: row.get(4)?,
                    performed_by: row.get(5)?,
                    performed_by_name: row.get(6)?,
                    old_value: row.get(7)?,
                    new_value: row.get(8)?,
                    module: row.get(9)?,
                    created_at: row.get(10)?,
                })
            },
        )?;

        let mut res = Vec::new();
        for r in rows {
            res.push(r?);
        }
        Ok(res)
    }

    // Auth session management — login/logout karyawan lokal
    pub fn login_session(&self, tim_id: i64, tim_name: &str, tim_role: &str) -> Result<AppSession, DbError> {
        let now = chrono::Local::now().to_rfc3339();
        // Nonaktifkan sesi sebelumnya untuk aplikasi ini
        self.conn.execute(
            "UPDATE app_sessions SET is_active = 0, logout_at = ?1 WHERE is_active = 1 AND app = ?2",
            params![now, self.app_name],
        )?;
        // Buat sesi baru
        self.conn.execute(
            "INSERT INTO app_sessions (tim_id, tim_name, tim_role, login_at, is_active, app) VALUES (?1, ?2, ?3, ?4, 1, ?5)",
            params![tim_id, tim_name, tim_role, now, self.app_name],
        )?;
        let id = self.conn.last_insert_rowid();
        Ok(AppSession {
            id: Some(id),
            tim_id,
            tim_name: tim_name.to_string(),
            tim_role: tim_role.to_string(),
            login_at: now,
            logout_at: None,
            is_active: 1,
            app: Some(self.app_name.clone()),
        })
    }

    pub fn logout_session(&self) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "UPDATE app_sessions SET is_active = 0, logout_at = ?1 WHERE is_active = 1 AND app = ?2",
            params![now, self.app_name],
        )?;
        Ok(())
    }

    pub fn get_active_session(&self) -> Result<Option<AppSession>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, tim_id, tim_name, tim_role, login_at, logout_at, is_active, app FROM app_sessions WHERE is_active = 1 AND app = ?1 ORDER BY login_at DESC LIMIT 1"
        )?;
        let mut rows = stmt.query_map(params![self.app_name], |row| {
            Ok(AppSession {
                id: row.get(0)?,
                tim_id: row.get(1)?,
                tim_name: row.get(2)?,
                tim_role: row.get(3)?,
                login_at: row.get(4)?,
                logout_at: row.get(5)?,
                is_active: row.get(6)?,
                app: row.get(7)?,
            })
        })?;
        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    // Work Session management
    pub fn start_work_session(&self, tim_id: i64, start_time: &str) -> Result<i64, DbError> {
        let now = chrono::Local::now().to_rfc3339();
        // Tutup sesi kerja lama yang masih menggantung untuk tim_id ini
        let _ = self.conn.execute(
            "UPDATE work_hours SET end_time = ?1 WHERE tim_id = ?2 AND end_time IS NULL",
            params![now, tim_id],
        );
        self.conn.execute(
            "INSERT INTO work_hours (tim_id, start_time, end_time, duration_seconds, notes, created_at) VALUES (?1, ?2, NULL, 0, NULL, ?3)",
            params![tim_id, start_time, now]
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn stop_work_session(&self, id: i64, tim_id: i64, end_time: &str, duration_seconds: i64, notes: Option<&str>) -> Result<(), DbError> {
        self.conn.execute(
            "UPDATE work_hours SET end_time = ?1, duration_seconds = ?2, notes = ?3 WHERE id = ?4 AND tim_id = ?5",
            params![end_time, duration_seconds, notes, id, tim_id]
        )?;
        // Pastikan SEMUA sesi berstatus aktif untuk tim_id ini ditutup agar tidak meninggalkan sesi yatim (orphaned)
        let _ = self.conn.execute(
            "UPDATE work_hours SET end_time = ?1 WHERE tim_id = ?2 AND end_time IS NULL",
            params![end_time, tim_id],
        );
        Ok(())
    }

    pub fn get_active_work_session(&self, tim_id: i64) -> Result<Option<WorkSession>, DbError> {
        // Otomatis bersihkan sesi mati (zombie session yang tidak pernah mengirim heartbeat selama >60 detik)
        let _ = self.conn.execute(
            "UPDATE work_hours 
             SET end_time = COALESCE(last_heartbeat, start_time), 
                 duration_seconds = MAX(0, CAST(
                     (strftime('%s', COALESCE(last_heartbeat, start_time)) - strftime('%s', start_time)) 
                     AS INTEGER
                 )),
                 notes = COALESCE(notes, 'Auto-closed (heartbeat timeout)')
             WHERE tim_id = ?1 
               AND end_time IS NULL 
               AND (strftime('%s', 'now') - strftime('%s', COALESCE(last_heartbeat, start_time))) > 60",
            params![tim_id],
        );

        let mut stmt = self.conn.prepare(
            "SELECT id, tim_id, start_time, end_time, duration_seconds, notes, created_at FROM work_hours WHERE tim_id = ?1 AND end_time IS NULL ORDER BY id DESC LIMIT 1"
        )?;
        
        let mut rows = stmt.query_map(params![tim_id], |row| {
            Ok(WorkSession {
                id: Some(row.get(0)?),
                tim_id: row.get(1)?,
                start_time: row.get(2)?,
                end_time: row.get(3)?,
                duration_seconds: row.get(4)?,
                notes: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn get_work_sessions(&self, tim_id: i64, limit: i64) -> Result<Vec<WorkSession>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, tim_id, start_time, end_time, duration_seconds, notes, created_at FROM work_hours WHERE tim_id = ?1 ORDER BY id DESC LIMIT ?2"
        )?;
        
        let rows = stmt.query_map(params![tim_id, limit], |row| {
            Ok(WorkSession {
                id: Some(row.get(0)?),
                tim_id: row.get(1)?,
                start_time: row.get(2)?,
                end_time: row.get(3)?,
                duration_seconds: row.get(4)?,
                notes: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut res = Vec::new();
        for r in rows {
            res.push(r?);
        }
        Ok(res)
    }
}

pub fn sync_contacts_from_invoices(conn: &Connection) -> Result<(), DbError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM contacts WHERE type = 'customer'",
        [],
        |row| row.get(0)
    )?;
    
    if count > 0 {
        return Ok(());
    }
    
    let mut stmt = conn.prepare("SELECT file_path FROM invoices")?;
    let rows = stmt.query_map([], |row| {
        let file_path: Option<String> = row.get(0)?;
        Ok(file_path)
    })?;
    
    let created_at = chrono::Local::now().to_rfc3339();
    
    for row in rows {
        if let Ok(Some(file_path_str)) = row {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&file_path_str) {
                if let Some(customer_name) = v.get("customerName").and_then(|n| n.as_str()) {
                    let customer_name_trimmed = customer_name.trim();
                    if !customer_name_trimmed.is_empty() {
                        let customer_wa = v.get("customerWa").and_then(|w| w.as_str()).unwrap_or("");
                        let customer_address = v.get("customerAddress").and_then(|a| a.as_str()).unwrap_or("");
                        
                        let exists: i64 = conn.query_row(
                            "SELECT COUNT(*) FROM contacts WHERE name = ?1 AND type = 'customer'",
                            params![customer_name_trimmed],
                            |r| r.get(0)
                        )?;
                        
                        if exists == 0 {
                            conn.execute(
                                "INSERT INTO contacts (name, wa_number, email, address, type, created_at, updated_at) VALUES (?1, ?2, NULL, ?3, 'customer', ?4, ?4)",
                                params![customer_name_trimmed, customer_wa, customer_address, created_at]
                            )?;
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}
