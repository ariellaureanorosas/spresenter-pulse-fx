// Gera a mídia do README a partir do próprio código do plugin.
//
// O painel é a UI React de `src/ui/` servida localmente, com um host falso que
// só responde ao `requestState` com um estado plausível. Cada print é o cartão
// real (`section.pfx-card`), recortado pelo kicker. Nada aqui é captura de tela
// do aplicativo: o README rotula como "renderização".
//
// Uso: npm run media
// Requer o Chromium do Playwright: npx playwright install chromium

import { mkdir, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { build as viteBuild } from 'vite';

const root = resolve(import.meta.dirname, '..');
const mediaDir = join(root, 'docs/media');
const buildDir = join(root, '.media');

// O painel é uma coluna estreita; 660 px evita a margem escura nas laterais e
// 2× mantém o texto legível no tamanho em que o README exibe.
const PANEL_WIDTH = 660;
const PANEL_HEIGHT = 2400;
const SCALE = 2;

const SECTIONS = [
  { file: 'panel-destino.png', kicker: 'Destino' },
  { file: 'panel-movimento.png', kicker: 'Movimento' },
  { file: 'panel-composicao.png', kicker: 'Composição' },
  { file: 'panel-protecao.png', kicker: 'Proteção' },
  { file: 'panel-execucao.png', kicker: 'Execução' },
  { file: 'panel-automacao.png', kicker: 'Automação' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function serveUi() {
  const uiDir = join(root, 'dist/ui');
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = join(uiDir, pathname);
    if (!file.startsWith(uiDir)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

function panelState() {
  const startedAt = Date.now() - 4200;
  return {
    revision: 12,
    params: {
      mode: 'pulse',
      color: '#a5b4fc',
      target: 'vignette',
      intensity: 78,
      decayMs: 320,
      frequencyHz: 0.9,
      flashWidth: 50,
      thickness: 58,
      softness: 62,
      safetyLock: true,
    },
    selection: { output: '1', layer: 2 },
    applied: true,
    layerOccupied: false,
    layerOccupiedByUs: true,
    layerDisabled: false,
    effects: [{ output: '1', layer: 2, mode: 'pulse', startedAt, owner: 'ui' }],
    selectedEffect: { output: '1', layer: 2, mode: 'pulse', startedAt, owner: 'ui' },
    appliedTargets: [{ output: '1', layer: 2, effect: 'pulse' }],
    lastClamp: null,
    ready: true,
    outputs: [
      { index: 1, name: 'Projetor principal', width: 1920, height: 1080, disabledLayers: [] },
    ],
    layers: [
      { index: 1, name: 'Base' },
      { index: 2, name: 'Efeitos' },
      { index: 3, name: 'Avisos' },
    ],
  };
}

async function renderPanel(browser) {
  const server = await serveUi();
  const { port } = server.address();
  const page = await browser.newPage({
    viewport: { width: PANEL_WIDTH, height: PANEL_HEIGHT },
    deviceScaleFactor: SCALE,
  });

  await page.addInitScript((state) => {
    window.addEventListener('message', (event) => {
      const envelope = event.data;
      if (envelope?.__spresenter !== true) return;
      if (envelope.data?.type !== 'requestState') return;
      window.postMessage({ __spresenter: true, data: { type: 'state', state } }, '*');
    });
  }, panelState());

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pfx-app');

  // A janela precisa ser tão alta quanto o conteúdo: o painel rola dentro de
  // `.pfx-app`, e um recorte fora da viewport sairia vazio.
  const contentHeight = await page.evaluate(() =>
    Math.ceil(document.querySelector('.pfx-app').scrollHeight),
  );
  await page.setViewportSize({ width: PANEL_WIDTH, height: Math.min(contentHeight + 24, 4000) });
  await page.waitForTimeout(400);

  // Congela a prévia no pico do ciclo (50%). `animation-delay` não serve: o
  // tempo já decorrido desde a montagem entra na conta e o quadro sai no fim da
  // animação. A Web Animations API fixa o progresso exatamente.
  await page.waitForSelector('.pfx-preview-sheet');
  await page.evaluate(() => {
    for (const sheet of document.querySelectorAll('.pfx-preview-sheet')) {
      for (const animation of sheet.getAnimations()) {
        animation.pause();
        const timing = animation.effect.getComputedTiming();
        if (typeof timing.duration === 'number') {
          animation.currentTime = timing.duration * 0.5;
        }
      }
    }
  });
  await page.waitForTimeout(250);

  const previewOpacity = await page.evaluate(() =>
    Number(getComputedStyle(document.querySelector('.pfx-preview-sheet')).opacity),
  );
  if (!(previewOpacity > 0.1)) {
    throw new Error(`prévia saiu apagada (opacidade ${previewOpacity}); não gere mídia vazia`);
  }

  const card = (kicker) => page.locator(`section.pfx-card:has(.pfx-kicker:text-is("${kicker}"))`);

  const expected = SECTIONS.length + 1;
  const found = await page.locator('section.pfx-card').count();
  if (found !== expected) {
    throw new Error(`esperava ${expected} cartões no painel, encontrei ${found}`);
  }

  // Herói: topo do painel até o fim do cartão de prévia.
  const preview = card('Prévia local');
  if ((await preview.count()) !== 1) throw new Error('cartão "Prévia local" não encontrado');
  const previewBox = await preview.boundingBox();
  const heroHeight = Math.ceil(previewBox.y + previewBox.height + 12);
  await page.screenshot({
    path: join(mediaDir, 'panel.png'),
    clip: { x: 0, y: 0, width: PANEL_WIDTH, height: heroHeight },
  });

  for (const section of SECTIONS) {
    const locator = card(section.kicker);
    const count = await locator.count();
    if (count !== 1) {
      throw new Error(`esperava 1 cartão "${section.kicker}", encontrei ${count}`);
    }
    const box = await locator.boundingBox();
    const margin = 10;
    await page.screenshot({
      path: join(mediaDir, section.file),
      clip: {
        x: Math.max(0, Math.floor(box.x - margin)),
        y: Math.max(0, Math.floor(box.y - margin)),
        width: Math.min(PANEL_WIDTH, Math.ceil(box.width + margin * 2)),
        height: Math.ceil(box.height + margin * 2),
      },
    });
  }

  await page.close();
  server.close();
  return { heroHeight };
}

async function renderTargets(browser, bundle) {
  const tileWidth = 480;
  const tileHeight = 270;
  const page = await browser.newPage({ viewport: { width: 1600, height: 560 } });
  const variants = [
    {
      label: 'Tela cheia',
      params: { mode: 'pulse', target: 'full', intensity: 90, color: '#ffffff' },
    },
    {
      label: 'Vinheta',
      params: {
        mode: 'pulse',
        target: 'vignette',
        intensity: 85,
        thickness: 55,
        softness: 60,
        color: '#a5b4fc',
      },
    },
    {
      label: 'Moldura',
      params: {
        mode: 'pulse',
        target: 'frame',
        intensity: 90,
        thickness: 45,
        softness: 55,
        color: '#fcd34d',
      },
    },
  ];

  const tiles = variants.map((variant) => ({
    label: variant.label,
    params: { ...variant.params, decayMs: 320, frequencyHz: 0.9, flashWidth: 50, safetyLock: true },
  }));

  await page.setContent(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><style>
  body { margin:0; background:#05070a; color:#e5eaf0;
         font:500 19px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { min-height:100vh; box-sizing:border-box; padding:40px;
         display:grid; grid-template-columns:repeat(3,${tileWidth}px);
         gap:32px; place-content:center; justify-content:center; }
  figure { margin:0; }
  .tile { width:${tileWidth}px; height:${tileHeight}px; border-radius:14px; overflow:hidden;
          box-shadow:0 22px 60px rgba(0,0,0,.55); outline:1px solid rgba(255,255,255,.09); }
  iframe { display:block; width:100%; height:100%; border:0; }
  figcaption { margin-top:16px; text-align:center; color:#b8c4d4; }
</style></head>
<body><main></main></body></html>`);

  await page.addScriptTag({ content: bundle });

  // Cada alvo é renderizado em um iframe do tamanho de uma saída 16:9, para que
  // as unidades `vmin` da moldura meçam o palco certo — igual ao overlay real.
  const documents = await page.evaluate(
    ({ items, backdrop }) =>
      items.map((item) => {
        const overlay = PFXMedia.buildOverlayHtml(item.params, { token: `target-${item.label}` });
        return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
          html,body{margin:0;height:100%;${backdrop}}
          .stage{position:relative;width:100%;height:100%;overflow:hidden;}
        </style></head><body><div class="stage">${overlay}</div></body></html>`;
      }),
    {
      items: tiles,
      backdrop:
        'background:radial-gradient(120% 90% at 50% 38%,#26303c 0%,#151b23 55%,#0a0e13 100%);',
    },
  );

  await page.evaluate(
    ({ items, docs }) => {
      const main = document.querySelector('main');
      items.forEach((item, index) => {
        const figure = document.createElement('figure');
        const tile = document.createElement('div');
        tile.className = 'tile';
        const frame = document.createElement('iframe');
        frame.setAttribute('title', item.label);
        frame.srcdoc = docs[index];
        tile.append(frame);
        const caption = document.createElement('figcaption');
        caption.textContent = item.label;
        figure.append(tile, caption);
        main.append(figure);
      });
    },
    { items: tiles, docs: documents },
  );

  await page.waitForTimeout(700);
  // Pausa no pico do ciclo (metade de 1/0,9 s) e espera a pintura.
  for (const frame of await page.$$('iframe')) {
    const inner = await frame.contentFrame();
    await inner.evaluate(() => {
      const sheet = document.querySelector('.pfx-sheet');
      sheet.style.animationPlayState = 'paused';
      sheet.style.animationDelay = '-611ms';
    });
  }
  await page.waitForTimeout(150);

  await page.screenshot({ path: join(mediaDir, 'targets.png') });
  await page.close();
}

async function main() {
  await mkdir(mediaDir, { recursive: true });
  await rm(buildDir, { recursive: true, force: true });

  await viteBuild({ configFile: join(root, 'vite.media.config.ts'), logLevel: 'warn' });
  const bundle = await readFile(join(buildDir, 'overlay.js'), 'utf8');

  // A UI compilada é servida localmente; o build é o mesmo do pacote.
  await viteBuild({ configFile: join(root, 'vite.ui.config.ts'), logLevel: 'warn' });

  const browser = await chromium.launch();
  const { heroHeight } = await renderPanel(browser);
  console.log(`panel.png: ${PANEL_WIDTH}×${heroHeight} (2×)`);
  for (const section of SECTIONS) console.log(`${section.file}: ${section.kicker}`);

  await renderTargets(browser, bundle);
  console.log('targets.png: 1600×560');

  await browser.close();
  await rm(buildDir, { recursive: true, force: true });
}

await main();
