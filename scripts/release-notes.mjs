// Extrai as notas de release de CHANGELOG.md para release/notes.md.
//
// A seção `## [x.y.z]` precisa existir: um release sem notas é um release sem
// contexto para quem instala. Com `--tag`, valida que a tag publicada é
// exatamente `v<manifest.version>` — evita publicar o ZIP de outra versão.
import fs from 'node:fs';
import path from 'node:path';
import { assertVersionsSynced, fail, ok, root, runAsScript } from './lib.mjs';

function parseArgs(argv) {
  const args = { tag: null, out: 'release/notes.md' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--tag') args.tag = argv[++index] ?? null;
    else if (value === '--out') args.out = argv[++index] ?? args.out;
    else if (value.startsWith('--tag=')) args.tag = value.slice('--tag='.length);
    else if (value.startsWith('--out=')) args.out = value.slice('--out='.length);
    else fail(`argumento desconhecido: ${value}`);
  }
  return args;
}

/** Corpo da seção `## [version]`, normalizado para um release. */
export function extractReleaseNotes(version) {
  const changelogPath = path.join(root, 'CHANGELOG.md');
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const lines = changelog.split(/\r?\n/);
  const heading = `## [${version}]`;
  const start = lines.findIndex((line) => line.trimStart().startsWith(heading));
  if (start === -1) {
    fail(`CHANGELOG.md não tem a seção "${heading}". Adicione as notas antes do release.`);
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    // Próxima versão ou bloco de links de comparação no rodapé.
    if (/^## \[/.test(lines[index]) || /^\[[^\]]+\]:\s*\S+/.test(lines[index])) {
      end = index;
      break;
    }
  }

  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .replace(/^\s*---\s*$/gm, '')
    .trim();

  if (!body) fail(`a seção "${heading}" do CHANGELOG.md está vazia.`);
  return `${body}\n`;
}

export function writeReleaseNotes({ tag = null, out = 'release/notes.md' } = {}) {
  const version = assertVersionsSynced();

  if (tag) {
    const normalized = tag.startsWith('v') ? tag.slice(1) : tag;
    if (normalized !== version) {
      fail(`tag ${tag} não corresponde à versão do manifest (${version}).`);
    }
  }

  const notes = extractReleaseNotes(version);
  const outFile = path.join(root, out);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, notes, 'utf8');

  ok(`notas de ${version} gravadas em ${out}`);
  return { version, notes, outFile };
}

runAsScript(import.meta.url, () => {
  const args = parseArgs(process.argv.slice(2));
  writeReleaseNotes(args);
});
