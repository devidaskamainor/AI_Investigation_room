import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['server/**/*.test.js', 'shared/**/*.test.js', 'client/**/*.test.{js,jsx}'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['server/src/services/**/*.js', 'server/src/middleware/**/*.js', 'shared/**/*.js'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
