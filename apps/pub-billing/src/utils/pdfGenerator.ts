import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function generateInvoicePDFBytes(elementId: string): Promise<Uint8Array> {
  const originalElement = document.getElementById(elementId);
  if (!originalElement) {
    throw new Error(`Elemen pratinjau dengan ID "${elementId}" tidak ditemukan di DOM.`);
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.width = '595px';
  container.style.height = '842px';
  container.style.overflow = 'hidden';
  container.style.background = '#ffffff';
  document.body.appendChild(container);

  try {
    const clonedElement = originalElement.cloneNode(true) as HTMLDivElement;

    clonedElement.style.transform = 'none';
    clonedElement.style.top = '0';
    clonedElement.style.left = '0';
    clonedElement.style.position = 'static';
    clonedElement.style.margin = '0';
    clonedElement.style.boxShadow = 'none';
    clonedElement.style.borderRadius = '0';

    // Hapus elemen yang tidak perlu dicetak (seperti banner peringatan UI)
    clonedElement.querySelectorAll('[data-no-print="true"], .no-print').forEach(el => el.remove());

    // Hapus <img>, SVG <image> + nonaktifkan CSS backgroundImage yang pakai url()
    // (watermark pakai data:image/svg+xml — di WebKitGTK bikin canvas taint)
    // Kecualikan gambar berbasis Base64 Data URI (data:) agar tanda tangan/logo tetap tercetak
    clonedElement.querySelectorAll('*').forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'img' || tag === 'image') {
        const src = el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('xlink:href') || '';
        if (!src.startsWith('data:')) {
          el.remove();
        }
      }
      const htmlEl = el as HTMLElement;
      if (htmlEl.style?.backgroundImage && htmlEl.style.backgroundImage.includes('url(')) {
        htmlEl.style.backgroundImage = 'none';
      }
    });

    container.appendChild(clonedElement);

    // ── PRELOAD FONT: Pastikan Montserrat (header SVG) & Playball (tanda tangan) ter-load ────
    // Arial adalah system font — tidak perlu load eksplisit.
    // Montserrat dipakai di header/footer SVG → harus dipastikan ter-load sebelum pre-render.
    try {
      await document.fonts.ready;
      await Promise.allSettled([
        document.fonts.load('700 12px Montserrat'),
        document.fonts.load('800 12px Montserrat'),
        document.fonts.load('900 12px Montserrat'),
        document.fonts.load('400 12px Playball'),
      ]);
    } catch {
      // Tidak memblokir proses jika font API tidak tersedia
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    // ── LANGKAH 1: Pre-render SVG inline → PNG beresolusi tinggi ────────────────────────────
    // Masalah: html2canvas merender SVG path di resolusi CSS (1x) lalu upscale → blur + jagged.
    // Solusi:
    //   A) Set intrinsic SVG size ke 2x → resolusi tajam tanpa membebani GPU & memori WebView2
    //   B) Gunakan Blob URL (bukan data: URI) → tidak taint canvas di WebKitGTK/WebView2
    //   C) drawImage langsung ke canvas 2x tanpa ctx.scale (canvas sudah di ukuran target)
    const RENDER_SCALE = 2;
    const svgEls = Array.from(clonedElement.querySelectorAll<SVGSVGElement>('svg'));
    let svgPreRenderOk = false;

    await Promise.all(svgEls.map(svg => new Promise<void>(resolve => {
      const rect = svg.getBoundingClientRect();
      const svgW = rect.width > 0 ? rect.width : (svg.clientWidth || 595);
      const svgH = rect.height > 0 ? rect.height : (svg.clientHeight || 80);

      // Set intrinsic size ke 4x → browser render SVG vector di resolusi penuh (bukan upscale)
      const hiW = Math.round(svgW * RENDER_SCALE);
      const hiH = Math.round(svgH * RENDER_SCALE);
      svg.setAttribute('width', String(hiW));
      svg.setAttribute('height', String(hiH));

      const svgData = new XMLSerializer().serializeToString(svg);

      // Blob URL: same-origin → tidak taint canvas (vs data: URI yang bisa taint di WebKitGTK)
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const blobUrl = URL.createObjectURL(blob);

      const imgLoader = new Image();
      imgLoader.onload = () => {
        try {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = hiW;
          offCanvas.height = hiH;
          const ctx = offCanvas.getContext('2d');
          if (ctx) {
            // Render langsung di ukuran 4x — tidak pakai ctx.scale agar tidak upscale bitmap
            ctx.drawImage(imgLoader, 0, 0, hiW, hiH);
          }
          // toDataURL aman karena Blob URL tidak taint canvas
          const pngUri = offCanvas.toDataURL('image/png');

          const replacement = document.createElement('img');
          replacement.src = pngUri;
          // Tampilkan di ukuran CSS asli (agar layout tidak berubah)
          replacement.style.cssText = `display:block;width:${svgW}px;height:${svgH}px;`;
          svg.parentNode?.replaceChild(replacement, svg);
          svgPreRenderOk = true;
        } catch {
          // SecurityError fallback: lanjut ke LANGKAH 2
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
        resolve();
      };
      imgLoader.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      imgLoader.src = blobUrl;
    })));

    // ── LANGKAH 2 (Fallback): Strip SVG filter attributes saja ─────────────────────────────
    // Jika Blob URL toDataURL masih SecurityError, strip hanya `filter` attribute.
    // clip-path TIDAK dihapus agar bentuk masking geometris tetap konsisten.
    // Tanpa filter, html2canvas render flat path → warna konsisten antara header & footer.
    if (!svgPreRenderOk) {
      clonedElement.querySelectorAll<Element>('svg [filter]').forEach(el => el.removeAttribute('filter'));
      clonedElement.querySelectorAll('svg defs filter').forEach(el => el.remove());
    }

    // ── LANGKAH 3: Watermark transparansi ───────────────────────────────────────────────────
    clonedElement.querySelectorAll<HTMLElement>('*').forEach(el => {
      const pos = (el.style.position || getComputedStyle(el).position);
      if (pos === 'absolute' && el.style.opacity && parseFloat(el.style.opacity) < 1) {
        const rawOp = parseFloat(el.style.opacity);
        const wmOpacity = Math.max(rawOp, 0.22);

        const rgbToRGBA = (str: string, alpha: number): string | null => {
          const m = str.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
          if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
          return null;
        };

        el.querySelectorAll<HTMLElement>('*').forEach(inner => {
          const cs = getComputedStyle(inner);
          const fg = cs.color;
          if (fg && fg !== 'transparent' && !fg.includes('rgba(0,0,0,0)')) {
            const rgba = rgbToRGBA(fg, wmOpacity);
            if (rgba) inner.style.color = rgba;
          }
          const bg = cs.backgroundColor;
          if (bg && bg !== 'transparent' && !bg.includes('rgba(0,0,0,0)') && !bg.includes('rgba(0, 0, 0, 0)')) {
            const rgba = rgbToRGBA(bg, wmOpacity);
            if (rgba) inner.style.backgroundColor = rgba;
          }
          const bc = cs.borderColor;
          const bw = cs.borderWidth;
          if (bc && bw && bw !== '0px' && bc !== 'transparent' && !bc.includes('rgba(0,0,0,0)')) {
            const rgba = rgbToRGBA(bc, wmOpacity);
            if (rgba) inner.style.borderColor = rgba;
          }
          const sh = cs.boxShadow;
          if (sh && sh !== 'none') {
            inner.style.boxShadow = sh.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_, r, g, b) => {
              return `rgba(${r},${g},${b},${wmOpacity})`;
            });
          }
        });

        // Reset opacity parent ke 1 agar tidak terjadi akumulasi transparansi ganda (double-compounding)
        el.style.opacity = '1';
      }
    });

    const pageElements = clonedElement.querySelectorAll<HTMLElement>('.a4-page');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    // Jika ditemukan elemen .a4-page (baik 1 halaman maupun lebih), gunakan targets tersebut.
    // Jika tidak ada (fallback), baru gunakan clonedElement.
    const targets: HTMLElement[] = pageElements.length > 0
      ? Array.from(pageElements)
      : [clonedElement];

    for (let i = 0; i < targets.length; i++) {
      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }
      // Skala 2x menghasilkan resolusi tajam (~150-200 DPI) tanpa memicu lonjakan memori OOM WebView2
      const captureCanvas = await html2canvas(targets[i], {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = captureCanvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 595, 842);
    }

    const arrayBuffer = pdf.output('arraybuffer');
    return new Uint8Array(arrayBuffer);
  } catch (err) {
    console.error('[PDF Gen] Gagal memproses html2canvas:', err);
    throw err;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Konversi Uint8Array ke Base64 secara hemat memori (chunked)
 * Mencegah error Maximum call stack size dan lonjakan memori V8 heap
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Menyimpan berkas biner ke path disk via Tauri secara aman
 * Menggunakan Base64 string untuk menghindari serialisasi jutaan angka JSON IPC
 */
export async function saveBinaryFileSafely(path: string, bytes: Uint8Array): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  const base64Content = uint8ArrayToBase64(bytes);
  try {
    await invoke('write_binary_file_base64', { path, base64Content });
  } catch (err) {
    console.warn('[saveBinaryFileSafely] Base64 command gagal, mencoba fallback Array.from:', err);
    await invoke('write_binary_file', { path, bytes: Array.from(bytes) });
  }
}

/**
 * Membuat berkas fisik di folder penyimpanan aplikasi PubDesk secara aman via Base64
 */
export async function createPhysicalFileSafely(filename: string, bytes: Uint8Array, folder: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  const base64Content = uint8ArrayToBase64(bytes);
  try {
    return await invoke<string>('create_physical_file_base64', { filename, base64Content, folder });
  } catch (err) {
    console.warn('[createPhysicalFileSafely] Base64 command gagal, mencoba fallback Array.from:', err);
    return await invoke<string>('create_physical_file', { filename, bytes: Array.from(bytes), folder });
  }
}

export async function downloadPDFBytes(bytes: Uint8Array, defaultFileName: string): Promise<boolean> {
  const isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__);

  if (isTauri) {
    try {
      const { save, ask } = await import('@tauri-apps/plugin-dialog');
      const { openPath } = await import('@tauri-apps/plugin-opener');

      const filePath = await save({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        defaultPath: defaultFileName
      });

      if (!filePath) {
        return false;
      }

      await saveBinaryFileSafely(filePath, bytes);

      try {
        const shouldOpen = await ask('PDF berhasil disimpan. Apakah Anda ingin langsung membukanya?', {
          title: 'Buka PDF',
          kind: 'info',
          okLabel: 'Buka',
          cancelLabel: 'Tutup'
        });

        if (shouldOpen) {
          await openPath(filePath);
        }
      } catch (dialogErr) {
        console.warn('Gagal menampilkan dialog konfirmasi buka PDF:', dialogErr);
      }

      return true;
    } catch (err) {
      console.error('Gagal menyimpan PDF via Tauri:', err);
      throw err;
    }
  } else {
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
    return true;
  }
}
