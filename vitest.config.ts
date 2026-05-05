import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environmentMatchGlobs: [
      // Component test files use jsdom (React Testing Library)
      ['src/app/**/*.test.tsx', 'jsdom'],
      ['src/components/**/*.test.tsx', 'jsdom'],
    ],
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
