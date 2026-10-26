// Valida o manifest.json contra o contrato do Spresenter antes de empacotar.
// Falha com mensagem acionável; não depende do build (só verifica arquivos
// referenciados quando dist/ já existe).
import fs from 'node:fs';
import path from 'node:path';
import { fail, ok, readJson, root, runAsScript, SEMVER } from './lib.mjs';

/** Escopos documentados e realmente usados pelo plugin. */
const ALLOWED_PERMISSIONS = new Set(['outputs:read', 'outputs:write', 'live:read', 'live:write']);
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateManifest() {
  const manifest = readJson('manifest.json');
  const pkg = readJson('package.json');
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };

  check(ID_PATTERN.test(manifest.id ?? ''), 'id deve seguir o padrão com.exemplo.plugin');
  check(isNonEmptyString(manifest.name), 'name é obrigatório');
  check(isNonEmptyString(manifest.description), 'description é obrigatória');
  check(isNonEmptyString(manifest.author), 'author é obrigatório');
  check(SEMVER.test(manifest.version ?? ''), 'version deve ser SemVer (x.y.z)');
  check(SEMVER.test(manifest.minAppVersion ?? ''), 'minAppVersion deve ser SemVer (x.y.z)');
  check(SEMVER.test(manifest.sdk ?? ''), 'sdk deve ser SemVer (x.y.z)');
  check(typeof manifest.background === 'boolean', 'background deve ser booleano');
  check(
    isNonEmptyString(manifest.main) && manifest.main.endsWith('.js'),
    'main deve apontar para um .js',
  );
  check(
    isNonEmptyString(manifest.ui) && manifest.ui.endsWith('.html'),
    'ui deve apontar para um .html',
  );

  check(Array.isArray(manifest.permissions), 'permissions deve ser um array');
  if (Array.isArray(manifest.permissions)) {
    check(manifest.permissions.length > 0, 'permissions não pode ser vazio');
    check(
      new Set(manifest.permissions).size === manifest.permissions.length,
      'permissions contém duplicatas',
    );
    for (const permission of manifest.permissions) {
      check(
        ALLOWED_PERMISSIONS.has(permission),
        `permission desconhecida: ${permission} (permitidas: ${[...ALLOWED_PERMISSIONS].join(', ')})`,
      );
    }
  }

  check(Array.isArray(manifest.panels) && manifest.panels.length > 0, 'panels não pode ser vazio');
  if (Array.isArray(manifest.panels)) {
    for (const [index, panel] of manifest.panels.entries()) {
      check(isNonEmptyString(panel?.id), `panels[${index}].id é obrigatório`);
      check(isNonEmptyString(panel?.title), `panels[${index}].title é obrigatório`);
      check(isNonEmptyString(panel?.icon), `panels[${index}].icon é obrigatório`);
    }
  }

  check(manifest.id === pkg.name, 'manifest.id deve ser igual a package.json name');
  check(manifest.version === pkg.version, 'manifest.version deve ser igual a package.json version');

  // main/ui só podem ser conferidos depois do build.
  const distDir = path.join(root, 'dist');
  if (fs.existsSync(distDir)) {
    const mainFile = path.join(root, manifest.main ?? '');
    const uiFile = path.join(root, manifest.ui ?? '');
    check(fs.existsSync(mainFile), `arquivo main não encontrado: ${manifest.main}`);
    check(fs.existsSync(uiFile), `arquivo ui não encontrado: ${manifest.ui}`);
  }

  if (errors.length > 0) {
    fail(`manifest.json inválido:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  }

  ok(
    `manifest.json válido — ${manifest.id} ${manifest.version}, Spresenter ≥ ${manifest.minAppVersion}, SDK ${manifest.sdk}`,
  );
  return manifest;
}

runAsScript(import.meta.url, validateManifest);
