import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/spresenter.d.ts', 'src/ui/main.tsx'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
        'src/shared/**': { lines: 85, functions: 85, branches: 80, statements: 85 },
      },
    },
  },
});
