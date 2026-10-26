import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

// Os testes exercitam caminhos de erro de propósito; o logger não deve poluir
// a saída do Vitest. Cada teste pode restaurar os mocks com `vi.restoreAllMocks`.
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
