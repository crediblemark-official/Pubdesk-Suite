/**
 * Cloudflare Worker - PubDesk Sync Gateway & Reverse Proxy
 * 
 * Worker ini berfungsi sebagai perantara (gateway) cerdas antara aplikasi desktop PubDesk
 * dengan Google Apps Script (Google Sheets & Google Drive).
 * 
 * Keuntungan menggunakan Worker ini:
 * 1. Mengubah URL GAS yang panjang dan rumit menjadi URL Worker yang rapi (misal: https://pubdesk-sync.workers.dev).
 * 2. Menangani HTTP 302/307 Redirect dari Google Apps Script secara otomatis dan transparan.
 * 3. Menangani Cross-Origin Resource Sharing (CORS) secara penuh.
 * 4. Menyimpan Token Keamanan (AUTH_TOKEN) di sisi server/Worker sehingga pengguna di PC lain
 *    cukup memasukkan URL Worker tanpa perlu repot mengetik token rahasia.
 */

// Target default URL Google Apps Script milik Anda
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbznI3Q4IqjG1T3BvduLlymBJUaMaNdDNjj4OF9krkfjUsXIvAamD8emMcZedwd5El0e2g/exec";
const DEFAULT_AUTH_TOKEN = "PubDesk_Secret_Token_2026";

/**
 * Standard CORS headers
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Max-Age": "86400",
};

/**
 * Helper untuk response JSON dengan CORS
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    // 1. Handle preflight CORS OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Ambil konfigurasi dari Environment Variables jika ada, atau gunakan default
    const targetGasUrl = (env.GAS_URL || DEFAULT_GAS_URL).trim();
    const secretToken = (env.AUTH_TOKEN || DEFAULT_AUTH_TOKEN).trim();

    const url = new URL(request.url);

    // 2. Health check & Root endpoint
    if ((url.pathname === "/" || url.pathname === "/health") && request.method === "GET" && !url.searchParams.has("action")) {
      return jsonResponse({
        status: "online",
        service: "PubDesk Sync Gateway (Cloudflare Worker)",
        version: "1.0.0",
        target_gas_configured: Boolean(targetGasUrl),
        timestamp: new Date().toISOString(),
        message: "PubDesk Sync Gateway aktif dan siap melayani sinkronisasi desktop suite."
      });
    }

    try {
      // 3. Handle GET Request
      if (request.method === "GET") {
        const gasTarget = new URL(targetGasUrl);

        // Teruskan semua search params dari incoming request
        for (const [key, val] of url.searchParams.entries()) {
          gasTarget.searchParams.set(key, val);
        }

        // Jika auth_token tidak disertakan pada query params, suntikkan token default
        if (!gasTarget.searchParams.has("auth_token") || !gasTarget.searchParams.get("auth_token")) {
          gasTarget.searchParams.set("auth_token", secretToken);
        }

        // Panggil Google Apps Script (redirect: "follow" otomatis mengikuti 302 redirect Google)
        const gasResp = await fetch(gasTarget.toString(), {
          method: "GET",
          headers: {
            "Accept": "application/json, text/plain, */*",
            "User-Agent": "PubDesk-Sync-Gateway/1.0"
          },
          redirect: "follow",
        });

        const text = await gasResp.text();

        // Cek jika Google mengembalikan HTML error alih-alih JSON
        if (text.trim().startsWith("<") && (text.includes("Exception") || text.includes("Pengecualian") || text.includes("Error"))) {
          return jsonResponse({
            status: "error",
            message: "Google Apps Script mengembalikan error HTML. Pastikan deployment berstatus 'Anyone'.",
            detail: text.slice(0, 300)
          }, 502);
        }

        return new Response(text, {
          status: gasResp.status,
          headers: {
            ...corsHeaders,
            "Content-Type": gasResp.headers.get("content-type") || "application/json; charset=utf-8",
          },
        });
      }

      // 4. Handle POST Request
      if (request.method === "POST") {
        let payload = {};
        const textBody = await request.text();
        if (textBody && textBody.trim().length > 0) {
          try {
            payload = JSON.parse(textBody);
          } catch (e) {
            return jsonResponse({
              status: "error",
              message: "Invalid JSON payload pada body request."
            }, 400);
          }
        }

        // Jika request hanya untuk tes koneksi { "action": "test" }
        if (payload.action === "test") {
          try {
            // Uji langsung ke GAS endpoint
            const testUrl = new URL(targetGasUrl);
            testUrl.searchParams.set("action", "get_invoices");
            testUrl.searchParams.set("auth_token", secretToken);

            const ping = await fetch(testUrl.toString(), {
              method: "GET",
              redirect: "follow"
            });

            if (ping.ok) {
              return jsonResponse({
                status: "success",
                message: "Koneksi ke Cloudflare Worker dan Google Apps Script berhasil!",
                gas_status: ping.status
              });
            } else {
              return jsonResponse({
                status: "error",
                message: `Cloudflare terhubung, namun GAS mengembalikan status ${ping.status}`
              }, 502);
            }
          } catch (err) {
            return jsonResponse({
              status: "error",
              message: `Gagal menghubungi Google Apps Script: ${err.message || String(err)}`
            }, 502);
          }
        }

        // Suntikkan token otentikasi jika belum ada di body
        if (!payload.auth_token || typeof payload.auth_token !== "string" || payload.auth_token.trim() === "") {
          payload.auth_token = secretToken;
        }

        // Teruskan request POST ke Google Apps Script
        const gasResp = await fetch(targetGasUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "User-Agent": "PubDesk-Sync-Gateway/1.0"
          },
          body: JSON.stringify(payload),
          redirect: "follow",
        });

        const respText = await gasResp.text();

        // Handle respons HTML jika terjadi kegagalan sistem internal Google
        if (respText.trim().startsWith("<") && (respText.includes("Exception") || respText.includes("Pengecualian") || respText.includes("Error"))) {
          return jsonResponse({
            status: "error",
            message: "Google Apps Script mengembalikan error HTML.",
            detail: respText.slice(0, 300)
          }, 502);
        }

        return new Response(respText, {
          status: gasResp.status,
          headers: {
            ...corsHeaders,
            "Content-Type": gasResp.headers.get("content-type") || "application/json; charset=utf-8",
          },
        });
      }

      // Method tidak didukung
      return jsonResponse({ status: "error", message: `Method ${request.method} tidak didukung.` }, 405);

    } catch (err) {
      return jsonResponse({
        status: "error",
        message: "Internal Gateway Error pada Cloudflare Worker",
        error: err.message || String(err)
      }, 500);
    }
  }
};
