// Utilitários compartilhados pelos scripts de verificação/empacotamento.
// Sem dependências: roda em Node 22+ puro.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** SemVer estrito, sem `v` e sem build metadata. */
export const SEMVER = /^\d+\.\d+\.\d+$/;

export function fail(message) {
  console.error(`\u2716 ${message}`);
  process.exit(1);
}

export function ok(message) {
  console.log(`\u2714 ${message}`);
}

export function readJson(relativePath) {
  const file = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`não foi possível ler ${relativePath}: ${error.message}`);
  }
}

export function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Garante manifest.json === package.json === package-lock.json. */
export function assertVersionsSynced() {
  const manifest = readJson('manifest.json');
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  const versions = {
    'manifest.json': manifest.version,
    'package.json': pkg.version,
    'package-lock.json': lock.version,
    'package-lock.json#packages[""]': lock.packages?.['']?.version,
  };
  const unique = new Set(Object.values(versions));
  if (unique.size !== 1 || !SEMVER.test(String(manifest.version))) {
    const detail = Object.entries(versions)
      .map(([file, version]) => `  ${file}: ${version ?? '(ausente)'}`)
      .join('\n');
    fail(`versões divergentes ou inválidas:\n${detail}`);
  }
  return manifest.version;
}

/** Executa `main` apenas quando o módulo é o entrypoint (não em import). */
export function runAsScript(importMetaUrl, main) {
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
  const self = fileURLToPath(importMetaUrl);
  const isEntry =
    process.platform === 'win32' ? entry.toLowerCase() === self.toLowerCase() : entry === self;
  if (isEntry) main();
}
