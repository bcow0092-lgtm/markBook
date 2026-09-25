import { test, expect } from '@playwright/test'
import { launchApp } from './helpers/app'

test('能启动应用、隔离数据、看到空书架', async () => {
  const app = await launchApp()
  try {
    // 空态文案来自 ShelfPage
    await expect(app.page.getByText(/还没有书/)).toBeVisible()
    // 数据落在隔离目录里，不碰真实书架
    expect(app.dataDir).toContain('mark-reader-e2e-')
  } finally {
    await app.close()
  }
})
