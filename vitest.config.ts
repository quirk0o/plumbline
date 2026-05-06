import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // next-auth imports 'next/server' without extension; map it to the actual file
      'next/server': resolve('./node_modules/next/server.js'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    environmentMatchGlobs: [
      ['src/app/**/*.test.tsx', 'jsdom'],
      ['src/components/**/*.test.tsx', 'jsdom'],
    ],
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules'],
    server: {
      deps: {
        inline: ['next-auth', '@auth/core'],
      },
    },
  },
})
