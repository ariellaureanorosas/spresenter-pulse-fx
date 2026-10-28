// Entrada do build de mídia: expõe o gerador de overlay para o Playwright.
// Só funções puras de `src/shared/`, sem host e sem DOM.
import { buildOverlayHtml } from '../src/shared/overlay';
import { DEFAULT_PARAMS } from '../src/shared/params';

export { buildOverlayHtml, DEFAULT_PARAMS };
