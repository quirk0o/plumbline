import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    // Test files legitimately use <img> in next/image mocks; the no-img-element
    // rule exists to enforce next/image in production code, not test stubs.
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Test build dir (NEXT_DIST_DIR=.next-test, used by dev:test / Playwright):
    ".next-test/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Git worktrees — their build artifacts must not be linted
    ".worktrees/**",
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
