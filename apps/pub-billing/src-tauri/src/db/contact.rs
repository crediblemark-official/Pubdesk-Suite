use super::{Database, DbError};
use crate::db::models::{Contact, Penulis};
use rusqlite::params;

impl Database {
    // Contacts (unified — sebelumnya terpisah contacts + penulis)
    pub fn add_contact(&self, contact: &Contact) -> Result<i64, DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO contacts (name, wa_number, email, address, job, institution, data_source, email_valid, wa_valid, needs_review, followup_status, notes, type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                contact.name,
                contact.wa_number,
                contact.email,
                contact.address,
                contact.job,
                contact.institution,
                contact.data_source,
                contact.email_valid,
                contact.wa_valid,
                contact.needs_review,
                contact.followup_status,
                contact.notes,
                contact.r#type,
                contact.created_at,
                now
            ]
        )?;
        let id = self.conn.last_insert_rowid();
        self.log_activity("contact", Some(id), "CREATE", &format!("Menambahkan kontak '{}'", contact.name))?;
        Ok(id)
    }

    pub fn get_contacts(&self) -> Result<Vec<Contact>, DbError> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, wa_number, email, address, job, institution, data_source, email_valid, wa_valid, needs_review, followup_status, notes, type, created_at, updated_at FROM contacts")?;
        let contacts = stmt.query_map([], |row| {
            let wa_number: Option<String> = match row.get::<_, Option<String>>(2) {
                Ok(val) => val,
                Err(_) => {
                    if let Ok(n) = row.get::<_, Option<i64>>(2) {
                        n.map(|num| num.to_string())
                    } else {
                        None
                    }
                }
            };
            Ok(Contact {
                id: row.get(0)?,
                name: row.get(1)?,
                wa_number,
                email: row.get(3)?,
                address: row.get(4)?,
                job: row.get(5)?,
                institution: row.get(6)?,
                data_source: row.get(7)?,
                email_valid: row.get(8)?,
                wa_valid: row.get(9)?,
                needs_review: row.get(10)?,
                followup_status: row.get(11)?,
                notes: row.get(12)?,
                r#type: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;

        let mut result = Vec::new();
        for contact in contacts {
            result.push(contact?);
        }
        Ok(result)
    }

    pub fn update_contact(&self, contact: &Contact) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "UPDATE contacts SET name = ?1, wa_number = ?2, email = ?3, address = ?4, job = ?5, institution = ?6, data_source = ?7, email_valid = ?8, wa_valid = ?9, needs_review = ?10, followup_status = ?11, notes = ?12, type = ?13, updated_at = ?14 WHERE id = ?15",
            params![
                contact.name,
                contact.wa_number,
                contact.email,
                contact.address,
                contact.job,
                contact.institution,
                contact.data_source,
                contact.email_valid,
                contact.wa_valid,
                contact.needs_review,
                contact.followup_status,
                contact.notes,
                contact.r#type,
                now,
                contact.id
            ],
        )?;
        self.log_activity("contact", contact.id, "UPDATE", &format!("Memperbarui kontak '{}'", contact.name))?;
        Ok(())
    }

    pub fn delete_contact(&self, id: i64) -> Result<(), DbError> {
        self.conn
            .execute("DELETE FROM contacts WHERE id = ?1", params![id])?;
        self.log_activity("contact", Some(id), "DELETE", &format!("Menghapus kontak id={}", id))?;
        Ok(())
    }

    // Penulis CRUD
    pub fn add_penulis(&self, p: &Penulis) -> Result<i64, DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO contacts (name, email, wa_number, address, job, institution, data_source, email_valid, wa_valid, followup_status, notes, type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'penulis', ?12, ?13)",
            params![
                p.name, p.email, p.wa_number, p.address, p.job, p.institution,
                p.data_source, p.email_valid, p.wa_valid, p.followup_status, p.notes, p.created_at, now
            ]
        )?;
        let id = self.conn.last_insert_rowid();
        self.log_activity("contact", Some(id), "CREATE", &format!("Menambahkan penulis '{}'", p.name))?;
        Ok(id)
    }

    pub fn get_penulis(&self) -> Result<Vec<Penulis>, DbError> {
        let mut stmt = self.conn.prepare("SELECT id, name, email, wa_number, address, job, institution, data_source, email_valid, wa_valid, followup_status, notes, created_at, updated_at FROM contacts WHERE type IN ('penulis','both') ORDER BY name ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(Penulis {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                wa_number: row.get(3)?,
                address: row.get(4)?,
                job: row.get(5)?,
                institution: row.get(6)?,
                data_source: row.get(7)?,
                email_valid: row.get(8)?,
                wa_valid: row.get(9)?,
                followup_status: row.get(10)?,
                notes: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })?;
        let mut res = Vec::new();
        for r in rows {
            res.push(r?);
        }
        Ok(res)
    }

    pub fn update_penulis(&self, p: &Penulis) -> Result<(), DbError> {
        let now = chrono::Local::now().to_rfc3339();
        self.conn.execute(
            "UPDATE contacts SET name = ?1, email = ?2, wa_number = ?3, address = ?4, job = ?5, institution = ?6, data_source = ?7, email_valid = ?8, wa_valid = ?9, followup_status = ?10, notes = ?11, updated_at = ?12 WHERE id = ?13",
            params![
                p.name, p.email, p.wa_number, p.address, p.job, p.institution,
                p.data_source, p.email_valid, p.wa_valid, p.followup_status, p.notes, now, p.id
            ]
        )?;
        self.log_activity("contact", p.id, "UPDATE", &format!("Memperbarui penulis '{}'", p.name))?;
        Ok(())
    }

    pub fn delete_penulis(&self, id: i64) -> Result<(), DbError> {
        self.conn
            .execute("DELETE FROM contacts WHERE id = ?1", params![id])?;
        self.log_activity("contact", Some(id), "DELETE", &format!("Menghapus penulis id={}", id))?;
        Ok(())
    }
}
