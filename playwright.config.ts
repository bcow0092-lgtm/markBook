import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // Electron 启动 + 首屏渲染要几秒，再加操作，60s 有余
  timeout: 60_000,
  // 每个用例都要起一个 Electron 进程、争 GPU，并发跑容易互相干扰
  workers: 1,
  fullyParallel: false,
  // 不用 html reporter —— 它要另开浏览器才看得了，CI 上没意义
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
})
