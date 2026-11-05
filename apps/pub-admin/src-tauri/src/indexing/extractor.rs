use std::path::Path;
use std::fs::File;
use std::io::Read;
use zip::ZipArchive;
use calamine::{Reader, Xlsx, open_workbook};

pub fn extract_text(path: &Path) -> Result<String, String> {
    let extension = path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    match extension.as_str() {
        "txt" | "md" | "json" => {
            let mut file = File::open(path).map_err(|e| e.to_string())?;
            let mut content = String::new();
            file.read_to_string(&mut content).map_err(|e| e.to_string())?;
            Ok(content)
        }
        "docx" => {
            extract_docx(path)
        }
        "xlsx" | "xls" => {
            extract_xlsx(path)
        }
        "pdf" => {
            extract_pdf(path)
        }
        _ => {
            // Fallback: baca metadata nama berkas saja jika bukan format dokumen teks
            Ok(path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string())
        }
    }
}

fn extract_docx(path: &Path) -> Result<String, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    let mut doc_file = archive.by_name("word/document.xml")
        .map_err(|e| format!("Bukan berkas Word valid: {}", e))?;
        
    let mut xml_content = String::new();
    doc_file.read_to_string(&mut xml_content).map_err(|e| e.to_string())?;
    
    // Parse tag w:t untuk mendapatkan teks naskah docx
    let mut text = String::new();
    let mut pos = 0;
    while let Some(start) = xml_content[pos..].find("<w:t") {
        let absolute_start = pos + start;
        if let Some(tag_end) = xml_content[absolute_start..].find(">") {
            let content_start = absolute_start + tag_end + 1;
            if let Some(end) = xml_content[content_start..].find("</w:t>") {
                let absolute_end = content_start + end;
                text.push_str(&xml_content[content_start..absolute_end]);
                text.push(' ');
                pos = absolute_end + 6;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    
    Ok(text)
}

fn extract_xlsx(path: &Path) -> Result<String, String> {
    let mut excel: Xlsx<std::io::BufReader<std::fs::File>> = open_workbook(path).map_err(|e: calamine::XlsxError| e.to_string())?;
    let mut text = String::new();
    for sheet in excel.sheet_names() {
        if let Ok(range) = excel.worksheet_range(&sheet) {
            for row in range.rows() {
                for cell in row {
                    let cell_str = cell.to_string();
                    if !cell_str.trim().is_empty() {
                        text.push_str(&cell_str);
                        text.push(' ');
                    }
                }
            }
        }
    }
    Ok(text)
}

fn extract_pdf(path: &Path) -> Result<String, String> {
    use flate2::read::ZlibDecoder;
    use std::io::Read;

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|e| e.to_string())?;

    let mut text = String::new();

    // Ekstrak teks dari aliran byte PDF (string literal di dalam tanda kurung)
    let extract_literal_strings = |data: &[u8], out: &mut String| {
        let mut i = 0;
        while i < data.len() {
            if data[i] == b'(' {
                // String literal PDF: (teks)
                i += 1;
                let mut current_str = Vec::new();
                while i < data.len() && data[i] != b')' {
                    if data[i] == b'\\' && i + 1 < data.len() {
                        i += 1;
                        current_str.push(data[i]);
                    } else {
                        current_str.push(data[i]);
                    }
                    i += 1;
                }
                if let Ok(s) = String::from_utf8(current_str) {
                    let cleaned: String = s.chars()
                        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '.' || *c == ',')
                        .collect();
                    if cleaned.len() > 2 {
                        out.push_str(&cleaned);
                        out.push(' ');
                    }
                }
            }
            i += 1;
        }
    };

    // Proses konten tidak terkompresi
    extract_literal_strings(&bytes, &mut text);

    // Cari dan dekompresi stream FlateDecode langsung pada byte slice murni (mencegah out-of-bounds panic & UTF-8 shift)
    let stream_tag = b"stream";
    let endstream_tag = b"endstream";
    let flate_tag_1 = b"/FlateDecode";
    let flate_tag_2 = b"/flatedecode";

    let mut search_pos = 0;
    while search_pos + stream_tag.len() < bytes.len() {
        if let Some(pos) = bytes[search_pos..]
            .windows(stream_tag.len())
            .position(|w| w == stream_tag)
        {
            let abs_stream_start = search_pos + pos;
            let lookback_start = abs_stream_start.saturating_sub(256);
            let header_area = &bytes[lookback_start..abs_stream_start];
            let is_flate = header_area.windows(flate_tag_1.len()).any(|w| w == flate_tag_1)
                || header_area.windows(flate_tag_2.len()).any(|w| w == flate_tag_2);

            let mut data_start = abs_stream_start + stream_tag.len();
            while data_start < bytes.len() && (bytes[data_start] == b' ' || bytes[data_start] == b'\r' || bytes[data_start] == b'\n') {
                data_start += 1;
            }

            if data_start >= bytes.len() {
                break;
            }

            if let Some(end_rel) = bytes[data_start..]
                .windows(endstream_tag.len())
                .position(|w| w == endstream_tag)
            {
                let mut data_end = data_start + end_rel;
                while data_end > data_start && (bytes[data_end - 1] == b' ' || bytes[data_end - 1] == b'\r' || bytes[data_end - 1] == b'\n') {
                    data_end -= 1;
                }

                if is_flate && data_end > data_start {
                    let stream_data = &bytes[data_start..data_end];
                    let mut decoder = ZlibDecoder::new(stream_data);
                    let mut decompressed = Vec::new();
                    if decoder.read_to_end(&mut decompressed).is_ok() {
                        extract_literal_strings(&decompressed, &mut text);
                    }
                }

                search_pos = data_start + end_rel + endstream_tag.len();
            } else {
                break;
            }
        } else {
            break;
        }
    }

    Ok(text)
}
