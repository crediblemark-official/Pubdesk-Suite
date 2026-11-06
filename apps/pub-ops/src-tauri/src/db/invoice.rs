use super::{Database, DbError};
use crate::db::models::Invoice;
use rusqlite::params;

impl Database {
    // Invoices
    pub fn add_invoice(&self, invoice: &Invoice) -> Result<i64, DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO invoices (created_at, customer_id, items_json, shipping_cost, admin_fee, total, export_format, file_path, sync_status, cloud_file_url, naskah_id, payment_status, paid_amount, remaining_amount, payment_notes, updated_at, customer_snapshot) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                invoice.created_at,
                invoice.customer_id,
                invoice.items_json,
                invoice.shipping_cost,
                invoice.admin_fee,
                invoice.total,
                invoice.export_format,
                invoice.file_path,
                invoice.sync_status.as_deref().unwrap_or("pending"),
                invoice.cloud_file_url,
                invoice.naskah_id,
                invoice.payment_status.as_deref().unwrap_or("Draft"),
                invoice.paid_amount,
                invoice.remaining_amount,
                invoice.payment_notes,
                now,
                invoice.customer_snapshot
            ]
        )?;
        let id = self.conn.last_insert_rowid();
        self.log_activity("invoice", Some(id), "CREATE", &format!("Membuat invoice total={}", invoice.total))?;
        Ok(id)
    }

    pub fn get_invoices(&self) -> Result<Vec<Invoice>, DbError> {
        let mut stmt = self.conn.prepare("SELECT id, created_at, customer_id, items_json, shipping_cost, admin_fee, total, export_format, file_path, sync_status, cloud_file_url, naskah_id, payment_status, paid_amount, remaining_amount, payment_notes, updated_at, customer_snapshot FROM invoices ORDER BY created_at DESC")?;
        let invoices = stmt.query_map([], |row| {
            let customer_id: Option<i64> = match row.get::<_, Option<i64>>(2) {
                Ok(val) => val,
                Err(_) => {
                    if let Ok(s) = row.get::<_, Option<String>>(2) {
                        s.and_then(|str_val| str_val.parse::<i64>().ok())
                    } else {
                        None
                    }
                }
            };
            let naskah_id: Option<i64> = match row.get::<_, Option<i64>>(11) {
                Ok(val) => val,
                Err(_) => {
                    if let Ok(s) = row.get::<_, Option<String>>(11) {
                        s.and_then(|str_val| str_val.parse::<i64>().ok())
                    } else {
                        None
                    }
                }
            };
            let paid_amount: f64 = match row.get::<_, Option<f64>>(13) {
                Ok(val) => val.unwrap_or(0.0),
                Err(_) => {
                    if let Ok(s) = row.get::<_, Option<String>>(13) {
                        s.and_then(|str_val| str_val.parse::<f64>().ok()).unwrap_or(0.0)
                    } else {
                        0.0
                    }
                }
            };
            let remaining_amount: f64 = match row.get::<_, Option<f64>>(14) {
                Ok(val) => val.unwrap_or(0.0),
                Err(_) => {
                    if let Ok(s) = row.get::<_, Option<String>>(14) {
                        s.and_then(|str_val| str_val.parse::<f64>().ok()).unwrap_or(0.0)
                    } else {
                        0.0
                    }
                }
            };

            Ok(Invoice {
                id: row.get(0)?,
                created_at: row.get(1)?,
                customer_id,
                items_json: row.get(3)?,
                shipping_cost: row.get::<_, Option<f64>>(4).unwrap_or(Some(0.0)).unwrap_or(0.0),
                admin_fee: row.get::<_, Option<f64>>(5).unwrap_or(Some(0.0)).unwrap_or(0.0),
                total: row.get::<_, Option<f64>>(6).unwrap_or(Some(0.0)).unwrap_or(0.0),
                export_format: row.get(7)?,
                file_path: row.get(8)?,
                sync_status: row.get(9)?,
                cloud_file_url: row.get(10)?,
                naskah_id,
                payment_status: row.get(12)?,
                paid_amount,
                remaining_amount,
                payment_notes: row.get(15)?,
                updated_at: row.get(16)?,
                customer_snapshot: row.get(17)?,
            })
        })?;

        let mut result = Vec::new();
        for invoice in invoices {
            result.push(invoice?);
        }
        Ok(result)
    }

    pub fn update_invoice_sync_status(
        &self,
        id: i64,
        sync_status: &str,
        cloud_file_url: &str,
    ) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();

        // Ambil sync_status lama untuk audit trail
        let old_sync: Option<String> = self.conn
            .query_row("SELECT sync_status FROM invoices WHERE id = ?1", params![id], |row| row.get(0))
            .ok();

        self.conn.execute(
            "UPDATE invoices SET sync_status = ?1, cloud_file_url = ?2, updated_at = ?3 WHERE id = ?4",
            params![sync_status, cloud_file_url, now, id],
        )?;

        let old_val = old_sync.as_deref().unwrap_or("-");
        self.log_activity_audit(
            "invoice", Some(id), "UPDATE",
            "Memperbarui status sinkronisasi invoice",
            None, None,
            Some(&format!("sync_status: {}", old_val)),
            Some(&format!("sync_status: {}", sync_status)),
            Some("pub-ops"),
        )?;
        Ok(())
    }

    pub fn update_sync_status(
        &self,
        table_name: &str,
        id: i64,
        sync_status: &str,
        cloud_file_url: Option<&str>,
    ) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();
        
        let allowed_tables = [
            "contacts", "books", "projects", "files", "tags", 
            "services", "penerbit", "naskah", "tim", "tasks", "legalitas", "invoices"
        ];
        if !allowed_tables.contains(&table_name) {
            return Err(DbError::Other(format!("Table '{}' not allowed for sync", table_name)));
        }

        if let Some(file_url) = cloud_file_url {
            let query = format!(
                "UPDATE {} SET sync_status = ?1, cloud_file_url = ?2, updated_at = ?3 WHERE id = ?4",
                table_name
            );
            self.conn.execute(&query, params![sync_status, file_url, now, id])?;
        } else {
            let query = format!(
                "UPDATE {} SET sync_status = ?1, updated_at = ?2 WHERE id = ?3",
                table_name
            );
            self.conn.execute(&query, params![sync_status, now, id])?;
        }

        self.log_activity_audit(
            table_name, Some(id), "UPDATE",
            &format!("Memperbarui status sinkronisasi cloud ke '{}'", sync_status),
            None, None,
            None,
            Some(&format!("sync_status: {}", sync_status)),
            Some("pub-ops"),
        )?;
        Ok(())
    }

    pub fn update_invoice(&self, invoice: &Invoice) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();
        // Ambil payment_status lama untuk audit trail
        let old_payment: Option<String> = invoice.id.and_then(|inv_id| {
            self.conn
                .query_row("SELECT payment_status FROM invoices WHERE id = ?1", params![inv_id], |row| row.get(0))
                .ok()
        });

        self.conn.execute(
            "UPDATE invoices SET customer_id = ?1, items_json = ?2, shipping_cost = ?3, admin_fee = ?4, total = ?5, export_format = ?6, file_path = ?7, sync_status = ?8, cloud_file_url = ?9, naskah_id = ?10, payment_status = ?11, paid_amount = ?12, remaining_amount = ?13, payment_notes = ?14, updated_at = ?15, customer_snapshot = ?16 WHERE id = ?17",
            params![
                invoice.customer_id,
                invoice.items_json,
                invoice.shipping_cost,
                invoice.admin_fee,
                invoice.total,
                invoice.export_format,
                invoice.file_path,
                invoice.sync_status.as_deref().unwrap_or("pending"),
                invoice.cloud_file_url,
                invoice.naskah_id,
                invoice.payment_status.as_deref().unwrap_or("Draft"),
                invoice.paid_amount,
                invoice.remaining_amount,
                invoice.payment_notes,
                now,
                invoice.customer_snapshot,
                invoice.id
            ]
        )?;

        let new_payment = invoice.payment_status.as_deref().unwrap_or("Draft");
        let old_val = old_payment.as_deref().unwrap_or("-");
        self.log_activity_audit(
            "invoice", invoice.id, "UPDATE",
            &format!("Memperbarui invoice total={}", invoice.total),
            None, None,
            Some(&format!("payment_status: {}", old_val)),
            Some(&format!("payment_status: {}", new_payment)),
            Some("pub-ops"),
        )?;
        Ok(())
    }

    pub fn delete_invoice(&self, id: i64) -> Result<(), DbError> {
        self.conn
            .execute("DELETE FROM invoices WHERE id = ?1", params![id])?;
        self.log_activity("invoice", Some(id), "DELETE", &format!("Menghapus invoice id={}", id))?;
        Ok(())
    }
}
