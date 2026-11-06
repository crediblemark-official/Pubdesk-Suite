import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = path.resolve(__dirname, '..');

// 1. Dapatkan versi saat ini dari root package.json
const rootPkgPath = path.join(rootDir, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const currentVersion: string = rootPkg.version;

// 2. Tentukan versi baru dari argumen CLI
const arg = process.argv[2]?.trim().toLowerCase();
let newVersion = '';

if (!arg || arg === 'patch') {
  const parts = currentVersion.split('.').map(n => parseInt(n, 10));
  parts[2] = (parts[2] || 0) + 1;
  newVersion = parts.join('.');
} else if (arg === 'minor') {
  const parts = currentVersion.split('.').map(n => parseInt(n, 10));
  parts[1] = (parts[1] || 0) + 1;
  parts[2] = 0;
  newVersion = parts.join('.');
} else if (arg === 'major') {
  const parts = currentVersion.split('.').map(n => parseInt(n, 10));
  parts[0] = (parts[0] || 0) + 1;
  parts[1] = 0;
  parts[2] = 0;
  newVersion = parts.join('.');
} else if (/^v?\d+\.\d+\.\d+/.test(arg)) {
  newVersion = arg.replace(/^v/, '');
} else {
  console.error(`❌ Argumen tidak valid: "${arg}".`);
  console.log(`Penggunaan:`);
  console.log(`  bun run bump          -> Naikkan patch (contoh: 0.1.30 -> 0.1.31)`);
  console.log(`  bun run bump minor    -> Naikkan minor (contoh: 0.1.30 -> 0.2.0)`);
  console.log(`  bun run bump major    -> Naikkan major (contoh: 0.1.30 -> 1.0.0)`);
  console.log(`  bun run bump 0.1.35   -> Set versi spesifik`);
  process.exit(1);
}

console.log(`🚀 Bumping version: ${currentVersion} -> ${newVersion}`);

// 3. Kumpulkan semua target berkas yang menyimpan versi
const targetFiles = [
  'package.json',
  'packages/shared-types/package.json',
  'packages/shared-ui/package.json',
  'packages/shared-utils/package.json',
  'packages/shared-db-rust/Cargo.toml',
  'apps/pub-admin/package.json',
  'apps/pub-admin/src-tauri/Cargo.toml',
  'apps/pub-admin/src-tauri/tauri.conf.json',
  'apps/pub-billing/package.json',
  'apps/pub-billing/src-tauri/Cargo.toml',
  'apps/pub-billing/src-tauri/tauri.conf.json',
  'apps/pub-files/package.json',
  'apps/pub-files/src-tauri/Cargo.toml',
  'apps/pub-files/src-tauri/tauri.conf.json',
  'apps/pub-ops/package.json',
  'apps/pub-ops/src-tauri/Cargo.toml',
  'apps/pub-ops/src-tauri/tauri.conf.json',
];

let updatedCount = 0;

for (const relPath of targetFiles) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️ Berkas tidak ditemukan: ${relPath}`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  // Ganti versi sesuai format berkas
  let newContent = content;
  if (relPath.endsWith('package.json') || relPath.endsWith('tauri.conf.json')) {
    newContent = content.replace(
      new RegExp(`"version"\\s*:\\s*"${currentVersion.replace(/\./g, '\\.')}"`),
      `"version": "${newVersion}"`
    );
  } else if (relPath.endsWith('Cargo.toml')) {
    newContent = content.replace(
      new RegExp(`version\\s*=\\s*"${currentVersion.replace(/\./g, '\\.')}"`),
      `version = "${newVersion}"`
    );
  }

  if (newContent !== content) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`  ✓ ${relPath}`);
    updatedCount++;
  } else {
    console.log(`  - ${relPath} (sudah versi ${newVersion} atau tidak berubah)`);
  }
}

console.log(`\n✨ Berhasil memperbarui ${updatedCount} berkas ke v${newVersion}!`);
console.log(`\nPerintah berikutnya untuk commit, tag, dan rilis:`);
console.log(`  git commit -am "release: bump version to v${newVersion}"`);
console.log(`  git tag v${newVersion}`);
console.log(`  git tag pub-desktop-v${newVersion}`);
console.log(`  git push origin main --tags\n`);
