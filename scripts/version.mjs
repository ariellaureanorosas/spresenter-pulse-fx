// Fonte única de versão: manifest.json.
// `check` falha se os três arquivos divergirem; `set` atualiza todos de uma vez.
import {
  assertVersionsSynced,
  fail,
  ok,
  readJson,
  runAsScript,
  SEMVER,
  writeJson,
} from './lib.mjs';

function usage() {
  console.error('uso: node scripts/version.mjs <check|set> [versão]');
  process.exit(1);
}

export function checkVersion() {
  const version = assertVersionsSynced();
  ok(`versão sincronizada: ${version}`);
  return version;
}

export function setVersion(next) {
  if (!next) usage();
  if (!SEMVER.test(next)) fail(`versão inválida: "${next}" — use SemVer (x.y.z)`);

  const current = assertVersionsSynced();
  if (current === next) {
    ok(`versão já é ${next}`);
    return next;
  }

  const manifest = readJson('manifest.json');
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');

  manifest.version = next;
  pkg.version = next;
  lock.version = next;
  if (lock.packages?.['']) lock.packages[''].version = next;

  writeJson('manifest.json', manifest);
  writeJson('package.json', pkg);
  writeJson('package-lock.json', lock);

  const written = assertVersionsSynced();
  ok(`versão ${current} → ${written} em manifest.json, package.json e package-lock.json`);
  console.log('Próximos passos: atualize o CHANGELOG.md e rode `npm run verify`.');
  return written;
}

runAsScript(import.meta.url, () => {
  const [, , command, value] = process.argv;
  if (command === 'check') checkVersion();
  else if (command === 'set') setVersion(value);
  else usage();
});
