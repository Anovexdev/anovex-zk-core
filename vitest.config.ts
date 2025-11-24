import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/.cache/**',
      '**/dist/**',
      '**/build/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.cache/**',
        'dist/**',
        '**/*.test.ts',
        'client/**',
        'deploy-final.cjs',
        'update-repo.cjs',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
