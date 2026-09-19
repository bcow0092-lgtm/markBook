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
    // 测试按运行环境分目录：tests/main 放主进程侧、tests/renderer 放渲染
    // 进程侧。对应地 tsconfig.node.json 只检查 tests/main、tsconfig.web.json
    // 只检查 tests/renderer —— 混在一起的话，渲染进程代码会在无 DOM 的 lib
    // 下被误报（FileReader 之类找不到）。
    //
    // 需要 DOM 的测试在文件顶部加 `// @vitest-environment jsdom` 单独切换，
    // 不全局开 jsdom：它的环境启动开销很大（实测一个文件多花 40 秒）。
    environment: 'node',
    include: ['tests/main/**/*.test.ts', 'tests/renderer/**/*.test.ts', 'tests/renderer/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    passWithNoTests: true,
  },
})
