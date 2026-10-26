// Packages the plugin for distribution: produces release/<id>-<version>.zip
// containing only what the installer needs — manifest.json at the archive root
// plus the built dist/ (and documentation/license/notices when present). Run
// `npm run package` (it builds first, then zips and writes a SHA-256 checksum).
// Cross-platform via adm-zip; no system `zip`.
//
// O ZIP é reproduzível: as entradas entram em ordem estável e com timestamp
// fixo. Dois builds do mesmo código geram o mesmo SHA-256 no mesmo Node, o que
// torna o checksum publicado verificável por quem reconstrói o pacote.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { assertVersionsSynced, fail, ok, readJson, root } from './lib.mjs';
import { validateManifest } from './validate-manifest.mjs';
import { verifySdk } from './verify-sdk.mjs';

validateManifest();
verifySdk();
const version = assertVersionsSynced();

const manifest = readJson('manifest.json');
const { id, main, ui } = manifest;

// Timestamp fixo (dentro da faixa do formato DOS, 1980–2107). Alterar este valor
// muda o checksum de todos os pacotes; não é para ser tocado sem motivo.
const FIXED_TIME = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));

// dist/ must exist. `npm run package` builds first, but guard for a bare run.
const distDir = path.join(root, 'dist');
if (!fs.existsSync(distDir)) {
  fail('dist/ não encontrado — rode `npm run build` antes.');
}

/** Arquivos de um diretório em ordem estável, com caminho POSIX relativo. */
function collectFiles(dir, prefix) {
  const files = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const absolute = path.join(dir, name);
    const entryName = `${prefix}/${name}`;
    if (fs.statSync(absolute).isDirectory()) {
      files.push(...collectFiles(absolute, entryName));
    } else {
      files.push({ absolute, entryName });
    }
  }
  return files;
}

const files = [
  { absolute: path.join(root, 'manifest.json'), entryName: 'manifest.json' },
  ...collectFiles(distDir, 'dist'),
];
for (const extra of ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  const absolute = path.join(root, extra);
  if (fs.existsSync(absolute)) files.push({ absolute, entryName: extra });
}

const zip = new AdmZip();
for (const file of files) {
  zip.addFile(file.entryName, fs.readFileSync(file.absolute));
}

// Sem isso, cada build grava a hora corrente e o SHA-256 muda sem o código mudar.
for (const entry of zip.getEntries()) {
  entry.header.time = FIXED_TIME;
}

// O instalador depende desses caminhos; falhar aqui evita publicar um ZIP que
// instala e não abre.
const entries = new Set(zip.getEntries().map((entry) => entry.entryName));
for (const required of ['manifest.json', main, ui]) {
  if (!entries.has(required)) fail(`ZIP sem o arquivo obrigatório: ${required}`);
}

const outDir = path.join(root, 'release');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${id}-${version}.zip`);
zip.writeZip(outFile);

const sha256 = createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
const checksumFile = `${outFile}.sha256`;
fs.writeFileSync(checksumFile, `${sha256}  ${path.basename(outFile)}\n`, 'utf-8');

// Relê o ZIP gravado: garante que o checksum publicado descreve o arquivo final.
const written = createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
if (written !== sha256) fail('o ZIP mudou depois de calculado o checksum');

ok(`pacote ${path.relative(root, outFile)} (${entries.size} arquivos)`);
console.log(`SHA-256 ${sha256}`);
