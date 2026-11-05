# ⚡ PubDesk Cloudflare Worker Sync Gateway

Cloudflare Worker ini berfungsi sebagai *reverse proxy* dan *API Gateway* di depan **Google Apps Script** untuk aplikasi desktop **PubDesk Suite**.

---

## 🎯 Mengapa Menggunakan Cloudflare Worker?

1. **URL Rapi & Pendek:**
   Menggantikan URL Google Apps Script yang panjang (`https://script.google.com/macros/s/AKfycb.../exec`) menjadi URL Worker yang rapi (misal: `https://pubdesk-sync.namamu.workers.dev`).
2. **Setup Cepat di PC Lain Tanpa Token:**
   Worker telah menyimpan token rahasia secara otomatis. Di aplikasi desktop lain, staf **hanya perlu memasukkan URL Cloudflare Worker saja** tanpa perlu repot mengetik token keamanan.
3. **Penanganan Redirect 302 Otomatis:**
   Google Apps Script selalu me-*redirect* request POST dengan status 302. Cloudflare Worker menyelesaikannya langsung di level edge CDN dan mengembalikan data bersih (HTTP 200).
4. **CORS Penuh & Latensi Sangat Rendah:**
   Didukung jaringan global Cloudflare dengan header CORS terbuka (`*`).

---

## 🚀 Cara Pasang / Deploy (Pilih Salah Satu)

### Cara 1: Lewat Web Dashboard Cloudflare (Paling Mudah, Tanpa Install Apapun)

1. Buka [dash.cloudflare.com](https://dash.cloudflare.com) dan login (buat akun gratis jika belum punya).
2. Di menu samping kiri, klik **Workers & Pages** → klik tombol **Create Application** → pilih **Create Worker**.
3. Beri nama worker Anda, misalnya: `pubdesk-sync` → klik **Deploy**.
4. Setelah dibuat, klik tombol **Edit Code** (atau **Quick Edit**).
5. Hapus kode contoh bawaan, lalu **copy-paste seluruh kode dari file `worker.js`** ke editor tersebut.
6. Klik **Save and Deploy**.
7. Selesai! Salin URL worker Anda (misalnya: `https://pubdesk-sync.<subdomain>.workers.dev`).

---

### Cara 2: Lewat Terminal Menggunakan Wrangler CLI

Jika Anda terbiasa dengan terminal / command-line:

```bash
cd cloudflare-worker

# Login ke akun Cloudflare Anda
npx wrangler login

# Deploy langsung ke Cloudflare Workers
npx wrangler deploy
```

---

## 💻 Penggunaan di Aplikasi PubDesk

1. Buka aplikasi **`pub-admin`** (atau menu Sinkronisasi di aplikasi manapun).
2. Masuk ke **Pengaturan** → **Google Apps Script / Sinkronisasi Cloud**.
3. Buka kunci edit, lalu pada kolom **URL Sinkronisasi**, masukkan URL Cloudflare Worker Anda:
   ```text
   https://pubdesk-sync.<subdomain>.workers.dev
   ```
4. Kolom **Token** dapat dikosongkan (atau isi sembarang), karena Worker sudah otomatis mengelola token otentikasi.
5. Klik **💾 Simpan Konfigurasi Baru** lalu klik **🔌 Uji Koneksi**.
