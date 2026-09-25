import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'release/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 主进程、preload 与共享类型跑在 Node 里
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/shared/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  // 渲染进程跑在浏览器里
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  // 测试与构建脚本跑在 Node 里（样本生成器用了 Buffer），
  // 不给它们设 globals 会被 no-undef 全量报错
  {
    files: ['tests/**/*.{ts,mjs,js}', 'scripts/**/*.mjs', '*.config.{ts,mjs,js}', 'eslint.config.mjs'],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,mjs,js}', 'scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
