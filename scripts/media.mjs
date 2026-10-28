// Gera a mídia do README a partir do próprio código do plugin.
//
// O overlay vem de `buildOverlayHtml` (o mesmo caminho usado em produção) e o
// painel é a UI React de `src/ui/` servida localmente, com um host falso que só
// responde ao `requestState` com um estado plausível. Nada aqui é captura de
// tela do aplicativo: o README rotula como "renderização".
//
// Uso: npm run media
// Requer o Chromium do Playwright: npx playwright install chromium

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import gifenc from 'gifenc';
import { chromium } from 'playwright';
import { build as viteBuild } from 'vite';

const { GIFEncoder, applyPalette, quantize } = gifenc;

const root = resolve(import.meta.dirname, '..');
const mediaDir = join(root, 'docs/media');
const buildDir = join(root, '.media');

const WIDTH = 640;
const HEIGHT = 360;
const FPS = 20;

// Palco neutro: escuro o bastante para o flash e a vinheta aparecerem sem
// simular conteúdo de uma apresentação real.
const BACKDROP =
  'background:radial-gradient(120% 90% at 50% 38%,#26303c 0%,#151b23 55%,#0a0e13 100%);';

const SHOTS = [
  {
    file: 'hit.gif',
    label: 'Hit',
    params: {
      mode: 'hit',
      color: '#ffffff',
      target: 'full',
      intensity: 92,
      decayMs: 1400,
      frequencyHz: 2,
      flashWidth: 50,
      thickness: 35,
      softness: 50,
      safetyLock: true,
    },
    durationMs: 1500,
  },
  {
    file: 'strobe.gif',
    label: 'Strobe',
    params: {
      mode: 'strobe',
      color: '#f5f3ff',
      target: 'full',
      intensity: 88,
      decayMs: 320,
      frequencyHz: 3,
      flashWidth: 38,
      thickness: 35,
      softness: 50,
      safetyLock: true,
    },
    durationMs: 2000,
  },
  {
    file: 'pulse.gif',
    label: 'Pulse',
    params: {
      mode: 'pulse',
      color: '#a5b4fc',
      target: 'vignette',
      intensity: 80,
      decayMs: 320,
      frequencyHz: 0.9,
      flashWidth: 50,
      thickness: 58,
      softness: 62,
      safetyLock: true,
    },
    durationMs: 2400,
  },
];

function rgbaFromPng(page, pngBuffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let binary = '';
    const chunk = 0x8000;
    for (let index = 0; index < data.length; index += chunk) {
      binary += String.fromCharCode.apply(null, data.subarray(index, index + chunk));
    }
    return btoa(binary);
  }, pngBuffer.toString('base64'));
}

async function renderGif(page, shot) {
  await page.evaluate(
    ({ params, backdrop }) => {
      const stage = document.getElementById('stage');
      stage.style.cssText = `position:relative;width:${stage.clientWidth}px;height:${stage.clientHeight}px;overflow:hidden;${backdrop}`;
      stage.innerHTML = PFXMedia.buildOverlayHtml(params, { token: 'media' });
      const sheet = stage.querySelector('.pfx-sheet');
      sheet.style.animationPlayState = 'paused';
      sheet.style.animationDelay = '0ms';
    },
    { params: shot.params, backdrop: BACKDROP },
  );

  const frameCount = Math.round((shot.durationMs / 1000) * FPS);
  const frameDelay = Math.round(1000 / FPS);
  const frames = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    await page.evaluate(
      (delay) => {
        const sheet = document.querySelector('#stage .pfx-sheet');
        sheet.style.animationDelay = `${delay}ms`;
      },
      -Math.round((frame / FPS) * 1000),
    );

    const png = await page.screenshot({
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    const rgba = await rgbaFromPng(page, png);
    frames.push(new Uint8Array(Buffer.from(rgba, 'base64')));
  }

  // Paleta única para toda a animação: uma paleta por frame faria o fundo
  // "tremer" entre os quadros.
  const sample = Buffer.concat(
    frames.filter((_, index) => index % 4 === 0).map((frame) => Buffer.from(frame)),
  );
  const palette = quantize(new Uint8Array(sample), 256, { format: 'rgb565' });

  const gif = GIFEncoder();
  for (const frame of frames) {
    gif.writeFrame(applyPalette(frame, palette, 'rgb565'), WIDTH, HEIGHT, {
      palette,
      delay: frameDelay,
    });
  }
  gif.finish();

  const bytes = gif.bytes();
  await writeFile(join(mediaDir, shot.file), bytes);
  return { bytes: bytes.length, frames: frames.length };
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
    viewport: { width: 1100, height: 900 },
    deviceScaleFactor: 1,
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
  // Deixe a prévia animar até um instante visível do ciclo.
  await page.waitForTimeout(1200);

  // O painel rola dentro de `.pfx-app` (height:100%). Ajuste a janela à altura
  // real do conteúdo para capturar tudo, sem cortar um cartão no meio.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const height = await page.evaluate(() =>
      Math.ceil(document.querySelector('.pfx-app').scrollHeight),
    );
    await page.setViewportSize({ width: 1100, height: Math.min(height, 2200) });
    await page.waitForTimeout(250);
  }
  const size = page.viewportSize();
  await page.screenshot({ path: join(mediaDir, 'panel.png') });
  await page.close();
  server.close();
  return size;
}

async function main() {
  await mkdir(mediaDir, { recursive: true });
  await rm(buildDir, { recursive: true, force: true });

  await viteBuild({ configFile: join(root, 'vite.media.config.ts'), logLevel: 'warn' });
  const bundle = await readFile(join(buildDir, 'overlay.js'), 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    html,body { margin:0; background:#05070a; }
    #stage { position:relative; width:${WIDTH}px; height:${HEIGHT}px; overflow:hidden; }
  </style></head><body><div id="stage"></div></body></html>`);
  await page.addScriptTag({ content: bundle });

  for (const shot of SHOTS) {
    const result = await renderGif(page, shot);
    console.log(`${shot.file}: ${result.frames} quadros, ${(result.bytes / 1024).toFixed(0)} KB`);
  }
  await page.close();

  await renderTargets(browser, bundle);
  console.log('targets.png: 1600×560');

  try {
    // A UI compilada é servida localmente; o build é o mesmo do pacote.
    await viteBuild({ configFile: join(root, 'vite.ui.config.ts'), logLevel: 'warn' });
    const size = await renderPanel(browser);
    console.log(`panel.png: ${size.width}×${size.height}`);
  } catch (error) {
    console.warn(`panel.png não gerado: ${error.message.split('\n')[0]}`);
  }

  await browser.close();
  await rm(buildDir, { recursive: true, force: true });
}

await main();
