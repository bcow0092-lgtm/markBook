import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
    },
  },
  test: {
    // 数据层测试跑在 node 环境；组件测试在具体文件顶部用
    // `// @vitest-environment jsdom` 单独切换
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    // M1 早期任务还没有测试文件，不加这一项 `npm run test` 会以非零退出
    passWithNoTests: true,
  },
})
