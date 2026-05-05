import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    environmentMatchGlobs: [
      ['src/app/**/*.test.tsx', 'jsdom'],
      ['src/components/**/*.test.tsx', 'jsdom'],
    ],
    environment: 'node',
    exclude: ['node_modules', 'e2e/**', '.next/**'],
  },
})
