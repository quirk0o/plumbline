import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'
import { config } from 'dotenv'

config({ path: '.env.test' })

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
    clearMocks: true,
    setupFiles: ['./src/test/setup.ts'],
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    exclude: ['node_modules'],
    server: {
      deps: {
        inline: ['next-auth', '@auth/core'],
      },
    },
  },
})
