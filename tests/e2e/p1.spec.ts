import { test, expect } from '@playwright/test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { launchApp, waitBookLoaded, waitForFile } from './helpers/app'
import { ensureGbkFixture, FIXTURES, GBK_TXT } from './helpers/fixtures'

// GBK 样本是 gitignore 的，CI 上不存在 —— 由测试自己生成，不依赖手工前置步骤
test.beforeAll(() => {
  ensureGbkFixture()
})

test('导入 GBK 编码的 TXT → 打开 → 中文不乱码', async () => {
  const app = await launchApp()
  try {
    await app.willImport(GBK_TXT)
    await app.page.getByRole('button', { name: /导入第一本书/ }).click()

    // 书名回落成文件名（TXT 没有元数据）
    await expect(app.page.getByText(/generated-gbk/)).toBeVisible({ timeout: 30_000 })

    // 打开。TXT 不渲染 iframe（只有 EPUB 走 epub.js 的 iframe），正文是
    // .txt-columns 下的一堆 <p>，每行一段，首行是章节标题
    await app.page.getByRole('button', { name: /打开《/ }).first().click()
    await waitBookLoaded(app.page)

    await expect(app.page.locator('.txt-columns p').first()).toContainText('第1章 测试章节1')
    // 乱码的典型特征是出现替换字符
    await expect(app.page.locator('.txt-columns')).not.toContainText('�')
  } finally {
    await app.close()
  }
})

test('调整字号 → 位置不跳变', async () => {
  const app = await launchApp()
  try {
    await app.willImport(FIXTURES.epub)
    await app.page.getByRole('button', { name: /导入第一本书/ }).click()
    await expect(app.page.getByText('Pride and Prejudice')).toBeVisible({ timeout: 30_000 })

    await app.page.getByRole('button', { name: /打开《Pride and Prejudice》/ }).click()
    await waitBookLoaded(app.page)

    // 先翻几页离开书首，否则「回到开头」也能骗过断言
    for (let i = 0; i < 5; i++) {
      await app.page.keyboard.press('ArrowRight')
      await app.page.waitForTimeout(150)
    }
    await app.page.waitForTimeout(1500)
    const before = (await app.readLibrary()).books[0].progress
    expect(before).not.toBeNull()

    // 改字号
    await app.page.getByRole('button', { name: '阅读设置' }).click()
    await app.page.getByLabel('增大字号').click()
    await app.page.getByLabel('关闭设置').click()
    await app.page.waitForTimeout(1500)

    const after = (await app.readLibrary()).books[0].progress
    // 位置不跳 —— 允许百分比有浮动（重排后页码会变），但章节不能变
    expect(after?.chapterTitle).toBe(before?.chapterTitle)
  } finally {
    await app.close()
  }
})

test('删除书籍 → 书架移除，books/ 下文件已清除', async () => {
  const app = await launchApp()
  try {
    await app.willImport(FIXTURES.epub)
    await app.alwaysConfirm()
    await app.page.getByRole('button', { name: /导入第一本书/ }).click()
    await expect(app.page.getByText('Pride and Prejudice')).toBeVisible({ timeout: 30_000 })

    await waitForFile(join(app.dataDir, 'library.json'))
    const book = (await app.readLibrary()).books[0]

    // 删除按钮在悬停时才显示
    await app.page.getByRole('button', { name: /打开《Pride and Prejudice》/ }).hover()
    await app.page.getByRole('button', { name: /删除《Pride and Prejudice》/ }).click()

    await expect(app.page.getByText(/还没有书/)).toBeVisible({ timeout: 15_000 })

    // 记录没了，文件也没了
    const lib = await app.readLibrary()
    expect(lib.books).toHaveLength(0)
    const files = await readdir(join(app.dataDir, 'books'))
    expect(files).not.toContain(book.fileName)
    expect(files.filter((f) => f.endsWith('.epub'))).toHaveLength(0)
  } finally {
    await app.close()
  }
})
