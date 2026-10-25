// Packages the plugin for distribution: produces release/<id>-<version>.zip
// containing only what the installer needs — manifest.json at the archive root
// plus the built dist/ (and documentation/license/notices when present). Run
// `npm run package` (it builds first, then zips and writes a SHA-256 checksum).
// Cross-platform via adm-zip; no system `zip`.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'manifest.json');
const packagePath = path.join(root, 'package.json');

if (!fs.existsSync(manifestPath)) {
  console.error('manifest.json not found in', root);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
const { id, version } = manifest;
if (!id || !version) {
  console.error('manifest.json must define "id" and "version".');
  process.exit(1);
}
if (packageJson.version !== version) {
  console.error(
    `Version mismatch: manifest.json has ${version}, package.json has ${packageJson.version}.`,
  );
  process.exit(1);
}

// dist/ must exist. `npm run package` builds first, but guard for a bare run.
const distDir = path.join(root, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const zip = new AdmZip();
zip.addLocalFile(manifestPath); // manifest.json at the archive root
zip.addLocalFolder(distDir, 'dist'); // built code.js + ui/
for (const extra of ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  const p = path.join(root, extra);
  if (fs.existsSync(p)) zip.addLocalFile(p);
}

const outDir = path.join(root, 'release');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${id}-${version}.zip`);
zip.writeZip(outFile);

const sha256 = createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
const checksumFile = `${outFile}.sha256`;
fs.writeFileSync(checksumFile, `${sha256}  ${path.basename(outFile)}\n`, 'utf-8');

console.log(`Packaged ${path.relative(root, outFile)}`);
console.log(`SHA-256 ${sha256}`);
