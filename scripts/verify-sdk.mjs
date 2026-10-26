// Confere a integridade e a identidade do SDK vendorizado antes do build.
// O tarball é a única fonte de tipos do host; um arquivo trocado mudaria o
// contrato sem alterar o código.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fail, ok, readJson, root, runAsScript } from './lib.mjs';

const SDK_FILE = 'sdk/spresenter-plugin-sdk.tgz';
const CHECKSUM_FILE = `${SDK_FILE}.sha256`;
const EXPECTED_NAME = '@spresenter/plugin-sdk';
const EXPECTED_DEPENDENCY = `file:${SDK_FILE}`;

function tarEntry(buffer, wanted) {
  let offset = 0;
  let longName = null;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const cString = (start, length) =>
      buffer.toString('utf8', start, start + length).replace(/\0.*$/s, '');
    const name = cString(offset, 100);
    const prefix = cString(offset + 345, 155);
    const size = Number.parseInt(cString(offset + 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    const fullName = longName ?? (prefix ? `${prefix}/${name}` : name);

    if (type === 'L') {
      longName = buffer.toString('utf8', dataStart, dataEnd).replace(/\0.*$/s, '');
    } else {
      longName = null;
      if (fullName === wanted) return buffer.toString('utf8', dataStart, dataEnd);
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return null;
}

export function verifySdk() {
  const sdkPath = path.join(root, SDK_FILE);
  const checksumPath = path.join(root, CHECKSUM_FILE);

  if (!fs.existsSync(sdkPath)) fail(`SDK vendorizado ausente: ${SDK_FILE}`);
  if (!fs.existsSync(checksumPath)) fail(`checksum ausente: ${CHECKSUM_FILE}`);

  const actual = createHash('sha256').update(fs.readFileSync(sdkPath)).digest('hex');
  const expected = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0].toLowerCase();
  if (actual !== expected) {
    fail(`SHA-256 do SDK não confere:\n  esperado: ${expected}\n  obtido:   ${actual}`);
  }

  let tarball;
  try {
    tarball = zlib.gunzipSync(fs.readFileSync(sdkPath));
  } catch (error) {
    fail(`SDK não é um .tgz válido: ${error.message}`);
  }

  const raw = tarEntry(tarball, 'package/package.json');
  if (!raw) fail('package/package.json não encontrado dentro do SDK');

  let sdkPackage;
  try {
    sdkPackage = JSON.parse(raw);
  } catch (error) {
    fail(`package.json do SDK inválido: ${error.message}`);
  }

  if (sdkPackage.name !== EXPECTED_NAME) {
    fail(`SDK inesperado: name=${sdkPackage.name} (esperado ${EXPECTED_NAME})`);
  }
  if (sdkPackage.license !== 'MIT') {
    fail(`licença do SDK inesperada: ${sdkPackage.license} (esperado MIT)`);
  }

  const manifest = readJson('manifest.json');
  const pkg = readJson('package.json');
  if (manifest.sdk !== sdkPackage.version) {
    fail(`manifest.sdk=${manifest.sdk} difere do SDK vendorizado (${sdkPackage.version})`);
  }
  if (pkg.dependencies?.[EXPECTED_NAME] !== EXPECTED_DEPENDENCY) {
    fail(
      `package.json deve depender de ${EXPECTED_NAME} via "${EXPECTED_DEPENDENCY}" ` +
        `(atual: ${pkg.dependencies?.[EXPECTED_NAME] ?? 'ausente'})`,
    );
  }

  ok(`SDK ${sdkPackage.name}@${sdkPackage.version} íntegro (${actual.slice(0, 12)}…)`);
  return sdkPackage;
}

runAsScript(import.meta.url, verifySdk);
