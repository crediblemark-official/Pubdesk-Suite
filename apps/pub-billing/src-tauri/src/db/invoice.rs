use super::{Database, DbError};
use crate::db::models::{Invoice, InvoiceTimelineItem};
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
            Ok(Invoice {
                id: row.get(0)?,
                created_at: row.get(1)?,
                customer_id: row.get(2)?,
                items_json: row.get(3)?,
                shipping_cost: row.get(4)?,
                admin_fee: row.get(5)?,
                total: row.get(6)?,
                export_format: row.get(7)?,
                file_path: row.get(8)?,
                sync_status: row.get(9)?,
                cloud_file_url: row.get(10)?,
                naskah_id: row.get(11)?,
                payment_status: row.get(12)?,
                paid_amount: row.get(13)?,
                remaining_amount: row.get(14)?,
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
        self.conn.execute(
            "UPDATE invoices SET sync_status = ?1, cloud_file_url = ?2, updated_at = ?3 WHERE id = ?4",
            params![sync_status, cloud_file_url, now, id],
        )?;
        self.log_activity("invoice", Some(id), "UPDATE", "Memperbarui status sinkronisasi invoice")?;
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

        self.log_activity(table_name, Some(id), "UPDATE", &format!("Memperbarui status sinkronisasi cloud ke '{}'", sync_status))?;
        Ok(())
    }

    pub fn update_invoice(&self, invoice: &Invoice) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();

        // Cek perubahan payment_status untuk dicatat di timeline
        let old_payment_status: Option<String> = invoice.id.and_then(|id| {
            self.conn
                .query_row(
                    "SELECT payment_status FROM invoices WHERE id = ?1",
                    params![id],
                    |row| row.get::<_, Option<String>>(0),
                )
                .ok()
                .flatten()
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

        // Log perubahan payment_status
        let new_payment_status = invoice.payment_status.as_deref().unwrap_or("Draft");
        if let Some(ref old) = old_payment_status {
            if old != new_payment_status {
                self.log_activity_audit(
                    "invoice",
                    invoice.id,
                    "PAYMENT_CHANGE",
                    &format!("Mengubah status pembayaran dari '{}' menjadi '{}'", old, new_payment_status),
                    None, None,
                    Some(old.as_str()),
                    Some(new_payment_status),
                    None,
                )?;
            }
        }

        self.log_activity("invoice", invoice.id, "UPDATE", &format!("Memperbarui invoice total={}", invoice.total))?;
        Ok(())
    }

    pub fn get_invoice_timeline(&self, invoice_id: i64) -> Result<Vec<InvoiceTimelineItem>, DbError> {
        let mut results: Vec<InvoiceTimelineItem> = Vec::new();

        // 1. Ambil data invoice untuk entry awal
        if let Ok(created_at) = self.conn.query_row(
            "SELECT created_at FROM invoices WHERE id = ?1",
            params![invoice_id],
            |row| row.get::<_, String>(0),
        ) {
            results.push(InvoiceTimelineItem {
                id: None,
                action: "CREATE".to_string(),
                description: "Invoice dibuat".to_string(),
                old_value: None,
                new_value: None,
                performed_by_name: None,
                created_at: created_at.clone(),
            });
        }

        // 2. Ambil semua aktivitas dari activity_log untuk invoice ini
        let mut stmt = self.conn.prepare(
            "SELECT id, action, description, old_value, new_value, performed_by_name, created_at
             FROM activity_log
             WHERE entity_type = 'invoice' AND entity_id = ?1
             ORDER BY created_at ASC"
        ).map_err(|e| DbError::Other(e.to_string()))?;

        let rows = stmt.query_map(params![invoice_id], |row| {
            Ok(InvoiceTimelineItem {
                id: Some(row.get(0)?),
                action: row.get(1)?,
                description: row.get(2)?,
                old_value: row.get(3)?,
                new_value: row.get(4)?,
                performed_by_name: row.get(5)?,
                created_at: row.get(6)?,
            })
        }).map_err(|e| DbError::Other(e.to_string()))?;

        for row in rows.flatten() {
            // Hindari duplikasi dengan entry CREATE dari langkah 1
            if !results.iter().any(|r| r.id == row.id && r.action == "CREATE") {
                results.push(row);
            }
        }

        // 3. Jika ada updated_at, pastikan ada entry UPDATE
        if let Ok(updated_at) = self.conn.query_row(
            "SELECT updated_at FROM invoices WHERE id = ?1 AND updated_at IS NOT NULL",
            params![invoice_id],
            |row| row.get::<_, String>(0),
        ) {
            if !results.iter().any(|r| r.created_at == updated_at && r.action == "UPDATE") {
                results.push(InvoiceTimelineItem {
                    id: None,
                    action: "UPDATE".to_string(),
                    description: "Invoice diperbarui".to_string(),
                    old_value: None,
                    new_value: None,
                    performed_by_name: None,
                    created_at: updated_at,
                });
            }
        }

        // Urutkan berdasarkan created_at ASC
        results.sort_by(|a, b| a.created_at.cmp(&b.created_at));

        Ok(results)
    }

    pub fn delete_invoice(&self, id: i64) -> Result<(), DbError> {
        self.conn
            .execute("DELETE FROM invoices WHERE id = ?1", params![id])?;
        self.log_activity("invoice", Some(id), "DELETE", &format!("Menghapus invoice id={}", id))?;
        Ok(())
    }
}
